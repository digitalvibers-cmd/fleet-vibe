"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import loadGoogleMaps from "@/lib/google-maps";

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
  placeholder = "Search address...",
  onSelect,
  disabled = false,
}: PlaceAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

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
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place?.geometry) return;

      setLoading(true);
      try {
        const data = extractPlaceData(place);
        onSelect(data);
      } finally {
        setLoading(false);
      }
    });
  }, [mapsReady, onSelect]);

  // Load Google Maps SDK
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((err) => console.error("Google Maps load error:", err));
  }, []);

  // Bind autocomplete when input is available and maps are ready
  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  // Auto-focus search input when clearing selection
  useEffect(() => {
    if (!selectedPlace && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [selectedPlace]);

  const displayAddress = selectedPlace
    ? selectedPlace.street1 && selectedPlace.city
      ? `${selectedPlace.street1}, ${selectedPlace.city}`
      : selectedPlace.street1 || selectedPlace.address || selectedPlace.name
    : "";

  if (selectedPlace) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm" title={displayAddress}>
          {displayAddress}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              autocompleteRef.current = null;
              onSelect(null);
            }}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <input
        ref={(el) => {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          if (el && mapsReady && !autocompleteRef.current) {
            initAutocomplete();
          }
        }}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
