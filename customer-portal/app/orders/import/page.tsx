"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle,
    XCircle,
    ArrowLeft,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import Header from "@/components/Header";
import BulkOrderPreviewTable from "@/components/BulkOrderPreviewTable";
import { parseOrdersFromExcel, type ParsedOrder } from "@/lib/excel-import";

type Step = "upload" | "preview" | "results";

interface ImportResults {
    succeeded: number;
    failed: { rowIndex: number; error: string }[];
}

export default function ImportOrdersPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>("upload");
    const [dragging, setDragging] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [results, setResults] = useState<ImportResults | null>(null);

    const validOrders = orders.filter((o) => o.isValid);

    const processFile = useCallback(async (file: File) => {
        setParseError(null);
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            setParseError("Molimo učitajte Excel fajl (.xlsx ili .xls).");
            return;
        }
        try {
            const buffer = await file.arrayBuffer();
            const { orders: parsed, totalRows } = parseOrdersFromExcel(buffer);
            if (totalRows === 0) {
                setParseError("Excel fajl ne sadrži podatke. Proverite da li ste koristili tačan predložak.");
                return;
            }
            setOrders(parsed);
            setStep("preview");
        } catch {
            setParseError("Greška pri čitanju fajla. Proverite da li je fajl ispravan Excel format.");
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleConfirm = async () => {
        setImporting(true);
        setImportProgress(0);

        try {
            const res = await fetch("/api/orders/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orders: validOrders }),
            });

            if (res.status === 401) {
                router.push("/login");
                return;
            }

            const data = await res.json();
            setResults({
                succeeded: data.succeeded?.length ?? 0,
                failed: data.failed ?? [],
            });
            setStep("results");
        } catch {
            setParseError("Greška pri kreiranju porudžbina. Pokušajte ponovo.");
        } finally {
            setImporting(false);
        }
    };

    const reset = () => {
        setStep("upload");
        setOrders([]);
        setResults(null);
        setParseError(null);
        setImportProgress(0);
    };

    return (
        <div className="flex min-h-full flex-col">
            <Header />

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
                {/* Back link */}
                <button
                    onClick={() => (step === "preview" ? reset() : router.push("/dashboard"))}
                    className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {step === "preview" ? "Nazad na upload" : "Nazad na dashboard"}
                </button>

                <div className="mb-6">
                    <h1 className="text-xl font-semibold">Uvoz porudžbina iz Excel-a</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Učitajte Excel fajl sa listom porudžbina. Svaki red kreira jednu porudžbinu.
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
                        <div>
                            <p className="mb-1 font-medium text-foreground">Preuzimanje</p>
                            <ul className="space-y-0.5">
                                <li><span className="text-red-500">*</span> Adresa preuzimanja</li>
                                <li><span className="text-red-500">*</span> Grad preuzimanja</li>
                                <li className="text-muted-foreground/70">Naziv preuzimanja (opciono)</li>
                                <li className="text-muted-foreground/70">Poštanski broj preuzimanja (opciono)</li>
                            </ul>
                        </div>
                        <div>
                            <p className="mb-1 font-medium text-foreground">Dostava</p>
                            <ul className="space-y-0.5">
                                <li><span className="text-red-500">*</span> Adresa dostave</li>
                                <li><span className="text-red-500">*</span> Grad dostave</li>
                                <li className="text-muted-foreground/70">Naziv dostave (opciono)</li>
                                <li className="text-muted-foreground/70">Poštanski broj dostave (opciono)</li>
                                <li className="text-muted-foreground/70">Napomene (opciono)</li>
                                <li className="text-muted-foreground/70">Zakazano YYYY-MM-DD HH:mm (opciono)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* ── Step 1: Upload ── */}
                {step === "upload" && (
                    <div className="space-y-4">
                        {/* Template download */}
                        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">Nemate predložak?</p>
                                <p className="text-xs text-muted-foreground">Preuzmite Excel predložak sa ispravnim kolonama</p>
                            </div>
                            <a
                                href="/api/orders/template"
                                download
                                className="flex items-center gap-1.5 rounded-xl border border-primary px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/5"
                            >
                                <Download className="h-4 w-4" />
                                Preuzmite predložak
                            </a>
                        </div>

                        {/* Drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
                                dragging
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50 hover:bg-muted/20"
                            }`}
                        >
                            <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
                            <p className="text-sm font-medium">Prevucite Excel fajl ovde</p>
                            <p className="mt-1 text-xs text-muted-foreground">ili kliknite za odabir (.xlsx, .xls)</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        {parseError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                {parseError}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 2: Preview ── */}
                {step === "preview" && (
                    <div className="space-y-5">
                        <BulkOrderPreviewTable orders={orders} />

                        {validOrders.length === 0 && (
                            <div className="flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                Nema validnih porudžbina. Ispravite greške u Excel fajlu i učitajte ponovo.
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={reset}
                                className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-muted"
                            >
                                Učitaj drugi fajl
                            </button>
                            {validOrders.length > 0 && (
                                <button
                                    onClick={handleConfirm}
                                    disabled={importing}
                                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Kreiranje{importProgress > 0 ? ` ${importProgress}/${validOrders.length}` : "..."}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Kreiraj {validOrders.length} porudžbin{validOrders.length === 1 ? "u" : validOrders.length < 5 ? "e" : "a"}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 3: Results ── */}
                {step === "results" && results && (
                    <div className="space-y-5">
                        {results.succeeded > 0 && (
                            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
                                <CheckCircle className="h-6 w-6 shrink-0 text-green-600" />
                                <div>
                                    <p className="font-medium text-green-800">
                                        {results.succeeded} porudžbin{results.succeeded === 1 ? "a kreirana" : results.succeeded < 5 ? "e kreirane" : "a kreirano"} uspešno
                                    </p>
                                    <p className="text-sm text-green-700">
                                        Vidljive su u Fleetvibe konzoli i dostupne za raspored.
                                    </p>
                                </div>
                            </div>
                        )}

                        {results.failed.length > 0 && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <XCircle className="h-5 w-5 text-red-600" />
                                    <p className="font-medium text-red-800">
                                        {results.failed.length} porudžbin{results.failed.length === 1 ? "a nije kreirana" : results.failed.length < 5 ? "e nisu kreirane" : "a nije kreirano"}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    {results.failed.map((f) => (
                                        <p key={f.rowIndex} className="text-sm text-red-700">
                                            Red {f.rowIndex}: {f.error}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/dashboard")}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
                            >
                                Idi na dashboard
                            </button>
                            <button
                                onClick={reset}
                                className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-muted"
                            >
                                Uvezi ponovo
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
