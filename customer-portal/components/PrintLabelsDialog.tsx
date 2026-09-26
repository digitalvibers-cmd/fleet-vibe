"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { DEFAULT_LABEL_ROWS, LABEL_ROW_OPTIONS, isLabelRows, type LabelRows } from "@/lib/label-layouts";

const STORAGE_KEY = "flybox.labelRows";

function readSavedRows(): LabelRows {
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return isLabelRows(saved) ? saved : DEFAULT_LABEL_ROWS;
  } catch {
    return DEFAULT_LABEL_ROWS;
  }
}

function saveRows(rows: LabelRows) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(rows));
  } catch {
    // storage unavailable (private mode) — the choice just isn't remembered
  }
}

// Serbian plural: 1/21/31 → one, 2-4/22-24 → few, everything else (incl. 11-14) → many.
function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Rendered only while open (the dashboard mounts it on demand), so state initializes on each open.
interface PrintLabelsDialogProps {
  selectedCount: number;
  printing: boolean;
  onClose: () => void;
  onConfirm: (rows: LabelRows) => void;
}

export default function PrintLabelsDialog({ selectedCount, printing, onClose, onConfirm }: PrintLabelsDialogProps) {
  const [rows, setRows] = useState<LabelRows>(readSavedRows);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const perSheet = rows * 2;
  const sheets = Math.ceil(selectedCount / perSheet);

  function handleConfirm() {
    saveRows(rows);
    onConfirm(rows);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-labels-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="print-labels-title" className="text-base font-semibold">
            Štampa nalepnica
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
            title="Zatvori"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Koliko nalepnica želite na jednoj A4 strani?
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Raspored nalepnica">
          {LABEL_ROW_OPTIONS.map((option) => {
            const selected = option === rows;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRows(option)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                {/* Mini A4 sheet preview */}
                <div
                  className="grid aspect-[210/297] w-12 grid-cols-2 gap-[2px] rounded-sm border border-border bg-white p-[3px]"
                  style={{ gridTemplateRows: `repeat(${option}, minmax(0, 1fr))` }}
                  aria-hidden="true"
                >
                  {Array.from({ length: option * 2 }).map((_, i) => (
                    <div key={i} className={selected ? "bg-primary/40" : "bg-muted-foreground/25"} />
                  ))}
                </div>
                <div className="text-center leading-tight">
                  <div className="text-sm font-semibold">{option * 2} po strani</div>
                  <div className="text-xs text-muted-foreground">2 × {option}</div>
                </div>
              </button>
            );
          })}
        </div>

        {rows >= 6 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Manje nalepnice koriste sitniji font i adrese u jednom redu.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selectedCount} {plural(selectedCount, "nalepnica", "nalepnice", "nalepnica")} · {sheets}{" "}
            {plural(sheets, "strana", "strane", "strana")}
          </span>
          <button
            onClick={handleConfirm}
            disabled={printing || selectedCount === 0}
            className="flex items-center gap-1.5 rounded-[25px] bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {printing ? "Priprema..." : "Štampaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
