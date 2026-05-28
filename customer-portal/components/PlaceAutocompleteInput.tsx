"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Search,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import loadGoogleMaps from "@/lib/google-maps";
import { latinToCyrillic, hasLatinChars } from "@/lib/serbian-translit";

const SERBIA_BOUNDS = {
  south: 42.23,
  west: 18.83,
  north: 46.19,
  east: 23.01,
};

export interface PlaceData {
  name: string;
  address: string;
  street1: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  neighborhood: string;
  building: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  meta: {
    google_place_id: string;
    formatted_address: string;
  };
}

type SyncStatus =
  | "empty"
  | "validating"
  | "valid"
  | "stale"
  | "not_found"
  | "error";

interface PlaceAutocompleteInputProps {
  selectedPlace: PlaceData | null;
  placeholder?: string;
  onSelect: (place: PlaceData | null) => void;
  disabled?: boolean;
}

function extractPlaceData(
  place: google.maps.places.PlaceResult
): PlaceData {
  const components = place.address_components || [];

  const getComponent = (type: string, useShort = false) => {
    const comp = components.find((c) => c.types.includes(type));
    return comp ? (useShort ? comp.short_name : comp.long_name) : "";
  };

  const streetNumber = getComponent("street_number");
  const streetName = getComponent("route");
  const city =
    getComponent("locality") || getComponent("administrative_area_level_2");
  const neighborhood =
    getComponent("neighborhood") ||
    getComponent("sublocality_level_1") ||
    getComponent("sublocality");
  const province = getComponent("administrative_area_level_1");
  const country = getComponent("country", true);
  const postalCode = getComponent("postal_code");

  let street1 = "";
  if (streetNumber && streetName) {
    street1 = `${streetName} ${streetNumber}`;
  } else if (streetName) {
    street1 = streetName;
  } else if (place.formatted_address) {
    const parts = place.formatted_address.split(",");
    street1 = parts[0]?.trim() || place.formatted_address;
  }

  const lat = place.geometry!.location!.lat();
  const lng = place.geometry!.location!.lng();

  return {
    name: street1 || place.name || "",
    address: place.formatted_address || "",
    street1,
    city,
    province,
    country,
    postal_code: postalCode,
    neighborhood,
    building: streetNumber,
    location: {
      type: "Point",
      coordinates: [lng, lat],
    },
    meta: {
      google_place_id: place.place_id || "",
      formatted_address: place.formatted_address || "",
    },
  };
}

export default function PlaceAutocompleteInput({
  selectedPlace,
  placeholder = "Pretražite adresu...",
  onSelect,
  disabled = false,
}: PlaceAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const lastGeocodedQueryRef = useRef<string>("");
  const justPickedFromAutocompleteRef = useRef(false);

  const [mapsReady, setMapsReady] = useState(false);
  const initialFormatted =
    selectedPlace?.meta?.formatted_address || selectedPlace?.address || "";
  const [inputValue, setInputValue] = useState<string>(initialFormatted);
  const [lastValidPlace, setLastValidPlace] = useState<PlaceData | null>(
    selectedPlace
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    selectedPlace ? "valid" : "empty"
  );

  const runGeocode = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        setSyncStatus("empty");
        return;
      }
      const lowered = trimmed.toLowerCase();
      if (lowered === lastGeocodedQueryRef.current) return;

      const mySeq = ++requestSeqRef.current;
      setSyncStatus("validating");

      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }

      const queryForGeocoder = hasLatinChars(trimmed)
        ? latinToCyrillic(trimmed)
        : trimmed;

      try {
        const { results } = await geocoderRef.current.geocode({
          address: queryForGeocoder,
          componentRestrictions: { country: "rs" },
          bounds: SERBIA_BOUNDS,
          region: "RS",
        });

        if (mySeq !== requestSeqRef.current) return;
        lastGeocodedQueryRef.current = lowered;

        if (!results || results.length === 0) {
          setSyncStatus("not_found");
          return;
        }

        const top = results[0] as unknown as google.maps.places.PlaceResult;
        if (!top.geometry?.location) {
          setSyncStatus("not_found");
          return;
        }

        const data = extractPlaceData(top);
        setLastValidPlace(data);
        onSelect(data);
        setSyncStatus("valid");
      } catch (err) {
        if (mySeq !== requestSeqRef.current) return;
        lastGeocodedQueryRef.current = lowered;
        const code = (err as { code?: string } | undefined)?.code;
        if (code === "ZERO_RESULTS") {
          setSyncStatus("not_found");
        } else {
          setSyncStatus("error");
        }
      }
    },
    [onSelect]
  );

  const initAutocomplete = useCallback(() => {
    const input = inputRef.current;
    if (!input || !mapsReady || autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(input, {
      types: ["address"],
      fields: [
        "address_components",
        "formatted_address",
        "geometry",
        "name",
        "place_id",
      ],
      componentRestrictions: { country: ["rs"] },
      bounds: new google.maps.LatLngBounds(
        { lat: SERBIA_BOUNDS.south, lng: SERBIA_BOUNDS.west },
        { lat: SERBIA_BOUNDS.north, lng: SERBIA_BOUNDS.east }
      ),
      strictBounds: false,
    });

    autocompleteRef.current.addListener("place_changed", async () => {
      const place = autocompleteRef.current!.getPlace();

      if (place?.geometry) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        requestSeqRef.current++;

        const data = extractPlaceData(place);
        const formatted = data.meta.formatted_address || data.address;
        justPickedFromAutocompleteRef.current = true;
        setInputValue(formatted);
        setLastValidPlace(data);
        onSelect(data);
        lastGeocodedQueryRef.current = formatted.trim().toLowerCase();
        setSyncStatus("valid");
        return;
      }

      const raw = (input.value || "").trim();
      if (!raw) {
        setSyncStatus("empty");
        return;
      }
      await runGeocode(raw);
    });
  }, [mapsReady, onSelect, runGeocode]);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((err) => console.error("Google Maps load error:", err));
  }, []);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPlace === null && lastValidPlace !== null) {
      setInputValue("");
      setLastValidPlace(null);
      setSyncStatus("empty");
      lastGeocodedQueryRef.current = "";
      requestSeqRef.current++;
    } else if (selectedPlace && !lastValidPlace) {
      const formatted =
        selectedPlace.meta?.formatted_address || selectedPlace.address || "";
      setInputValue(formatted);
      setLastValidPlace(selectedPlace);
      setSyncStatus("valid");
      lastGeocodedQueryRef.current = formatted.trim().toLowerCase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace]);

  const handleUserTyping = useCallback(
    (next: string) => {
      if (justPickedFromAutocompleteRef.current) {
        justPickedFromAutocompleteRef.current = false;
        return;
      }
      const trimmed = next.trim();
      if (!trimmed) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        requestSeqRef.current++;
        setLastValidPlace(null);
        onSelect(null);
        setSyncStatus("empty");
        lastGeocodedQueryRef.current = "";
        return;
      }
      setSyncStatus(lastValidPlace ? "stale" : "validating");
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runGeocode(trimmed);
      }, 500);
    },
    [lastValidPlace, onSelect, runGeocode]
  );

  const handleClear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    requestSeqRef.current++;
    setInputValue("");
    setLastValidPlace(null);
    onSelect(null);
    setSyncStatus("empty");
    lastGeocodedQueryRef.current = "";
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onSelect]);

  const renderLeadingIcon = () => {
    if (syncStatus === "validating") {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
    if (syncStatus === "valid") {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    if (syncStatus === "stale" || syncStatus === "not_found") {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    if (syncStatus === "error") {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    return <Search className="h-4 w-4 text-muted-foreground" />;
  };

  const borderClass = (() => {
    if (syncStatus === "valid") {
      return "border-emerald-300 focus:border-emerald-500";
    }
    if (syncStatus === "stale" || syncStatus === "not_found") {
      return "border-amber-300 focus:border-amber-500";
    }
    if (syncStatus === "error") {
      return "border-destructive focus:border-destructive";
    }
    return "border-border focus:border-primary";
  })();

  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {renderLeadingIcon()}
        </div>
        <input
          ref={(el) => {
            (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            if (el && mapsReady && !autocompleteRef.current) {
              initAutocomplete();
            }
          }}
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setInputValue(next);
            handleUserTyping(next);
          }}
          onBlur={() => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
              void runGeocode(inputValue);
            }
          }}
          className={`w-full rounded-lg border py-2 pl-9 pr-9 text-sm outline-none ${borderClass}`}
        />
        {inputValue.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Obriši adresu"
            className="absolute inset-y-0 right-2 my-auto flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {syncStatus === "not_found" && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Adresa nije pronađena. Pokušajte detaljnije (ulica + broj + grad).</span>
        </div>
      )}
      {syncStatus === "stale" && lastValidPlace && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          Validira se… Poslednje pronađeno: {lastValidPlace.meta.formatted_address || lastValidPlace.address}
        </div>
      )}
      {syncStatus === "error" && (
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Greška pri proveri adrese. Pokušajte ponovo.</span>
        </div>
      )}
    </div>
  );
}
