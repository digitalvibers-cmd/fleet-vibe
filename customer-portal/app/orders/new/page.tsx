"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Calendar,
  FileText,
  Send,
} from "lucide-react";
import Header from "@/components/Header";
import PlaceAutocompleteInput, {
  type PlaceData,
} from "@/components/PlaceAutocompleteInput";

interface LocationEntry {
  id: string;
  place: PlaceData | null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyLocation(): LocationEntry {
  return { id: generateId(), place: null };
}

function addLocation(
  list: LocationEntry[],
  setList: (v: LocationEntry[]) => void
) {
  setList([...list, emptyLocation()]);
}

function removeLocation(
  list: LocationEntry[],
  setList: (v: LocationEntry[]) => void,
  id: string
) {
  if (list.length <= 1) return;
  setList(list.filter((l) => l.id !== id));
}

function LocationFields({
  label,
  color,
  list,
  setList,
}: {
  label: string;
  color: string;
  list: LocationEntry[];
  setList: (v: LocationEntry[]) => void;
}) {
  const setPlace = useCallback(
    (id: string, place: PlaceData | null) => {
      setList(list.map((l) => (l.id === id ? { ...l, place } : l)));
    },
    [list, setList]
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="space-y-3">
        {list.map((loc, i) => (
          <div
            key={loc.id}
            className="rounded-xl border border-border bg-white p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {label} {list.length > 1 ? i + 1 : ""}
              </span>
              {list.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLocation(list, setList, loc.id)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <PlaceAutocompleteInput
              selectedPlace={loc.place}
              onSelect={(place) => setPlace(loc.id, place)}
              placeholder={`Pretražite ${label.toLowerCase()} adresu...`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => addLocation(list, setList)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  const router = useRouter();

  const [pickups, setPickups] = useState<LocationEntry[]>([emptyLocation()]);
  const [dropoffs, setDropoffs] = useState<LocationEntry[]>([emptyLocation()]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validPickups = pickups.filter((p) => p.place?.street1);
    const validDropoffs = dropoffs.filter((d) => d.place?.street1);

    if (validPickups.length === 0 || validDropoffs.length === 0) {
      setError("Izaberite najmanje jednu adresu preuzimanja i jednu adresu isporuke.");
      return;
    }

    setSubmitting(true);

    try {
      const buildPlace = (loc: LocationEntry) => {
        const p = loc.place!;
        return {
          name: p.name,
          address: p.address,
          street1: p.street1,
          city: p.city,
          province: p.province,
          country: p.country || "RS",
          postal_code: p.postal_code,
          neighborhood: p.neighborhood,
          building: p.building,
          location: p.location,
        };
      };

      const payload: Record<string, unknown> = {};

      if (validPickups.length === 1 && validDropoffs.length === 1) {
        payload.pickup = buildPlace(validPickups[0]);
        payload.dropoff = buildPlace(validDropoffs[0]);
      } else {
        const waypoints = [
          ...validPickups.map(buildPlace),
          ...validDropoffs.map(buildPlace),
        ];
        payload.waypoints = waypoints;
      }

      const orderData: Record<string, unknown> = {
        payload,
        notes: notes || undefined,
        scheduled_at: scheduledAt || undefined,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || "Kreiranje narudžbine nije uspelo.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Greška u mreži. Pokušajte ponovo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-muted/30">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-lg font-bold font-heading">Nova narudžbina za dostavu</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Locations */}
          <div className="space-y-6">
            <LocationFields
              label="Preuzimanje"
              color="bg-green-500"
              list={pickups}
              setList={setPickups}
            />
            <LocationFields
              label="Isporuka"
              color="bg-red-500"
              list={dropoffs}
              setList={setDropoffs}
            />
          </div>

          {/* Scheduled date */}
          <div className="rounded-2xl border border-border bg-white p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-primary" />
              Zakazivanje dostave (opciono)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-border bg-white p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              Napomene (opciono)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Posebna uputstva, detalji o paketu, itd."
              className="w-full resize-none rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[25px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Kreiranje narudžbine..." : "Kreiraj narudžbinu"}
          </button>
        </form>
      </main>
    </div>
  );
}
