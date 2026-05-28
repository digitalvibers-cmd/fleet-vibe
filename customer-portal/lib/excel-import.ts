import * as XLSX from "xlsx";

export interface ParsedOrder {
    rowIndex: number;
    pickupName: string;
    pickupAddress: string;
    pickupCity: string;
    pickupPostal: string;
    dropoffName: string;
    dropoffAddress: string;
    dropoffCity: string;
    dropoffPostal: string;
    notes: string;
    scheduledAt: string | null;
    codAmount: string;
    recipientPhone: string;
    isValid: boolean;
    validationErrors: string[];
}

export interface ParseResult {
    orders: ParsedOrder[];
    totalRows: number;
}

const COLUMN_MAP: Record<string, keyof ParsedOrder> = {
    "Naziv preuzimanja": "pickupName",
    "Adresa preuzimanja": "pickupAddress",
    "Grad preuzimanja": "pickupCity",
    "Poštanski broj preuzimanja": "pickupPostal",
    "Naziv dostave": "dropoffName",
    "Adresa dostave": "dropoffAddress",
    "Grad dostave": "dropoffCity",
    "Poštanski broj dostave": "dropoffPostal",
    "Napomene": "notes",
    "Zakazano (YYYY-MM-DD HH:mm)": "scheduledAt",
    "Cena otkupa (RSD)": "codAmount",
    "Broj telefona primaoca": "recipientPhone",
};

function parseScheduledAt(raw: unknown): string | null {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;

    // Try direct ISO parse
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // Try YYYY-MM-DD HH:mm
    const match = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
    if (match) {
        const parsed = new Date(`${match[1]}T${match[2]}:00`);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }

    return null;
}

export function parseOrdersFromExcel(buffer: ArrayBuffer): ParseResult {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
    });

    const orders: ParsedOrder[] = rows.map((row, idx) => {
        const order: Partial<ParsedOrder> = {
            rowIndex: idx + 2, // 1-based, row 1 is header
            pickupName: "",
            pickupAddress: "",
            pickupCity: "",
            pickupPostal: "",
            dropoffName: "",
            dropoffAddress: "",
            dropoffCity: "",
            dropoffPostal: "",
            notes: "",
            scheduledAt: null,
            codAmount: "",
            recipientPhone: "",
            validationErrors: [],
        };

        for (const [colName, field] of Object.entries(COLUMN_MAP)) {
            if (colName in row) {
                if (field === "scheduledAt") {
                    order.scheduledAt = parseScheduledAt(row[colName]);
                } else {
                    (order as Record<string, unknown>)[field] = String(row[colName] ?? "").trim();
                }
            }
        }

        const errors: string[] = [];
        if (!order.pickupAddress) errors.push("Adresa preuzimanja je obavezna");
        if (!order.pickupCity) errors.push("Grad preuzimanja je obavezan");
        if (!order.dropoffAddress) errors.push("Adresa dostave je obavezna");
        if (!order.dropoffCity) errors.push("Grad dostave je obavezan");
        if (order.codAmount && !/^\d+$/.test(order.codAmount)) {
            errors.push("Cena otkupa mora biti ceo broj (npr. 1500)");
        }
        if (
            order.recipientPhone &&
            order.recipientPhone.replace(/\D/g, "").length < 6
        ) {
            errors.push("Broj telefona primaoca nije validan (mora sadržati najmanje 6 cifara)");
        }

        return {
            ...(order as ParsedOrder),
            isValid: errors.length === 0,
            validationErrors: errors,
        };
    });

    return { orders, totalRows: rows.length };
}

export const TEMPLATE_COLUMNS = Object.keys(COLUMN_MAP);
export const TEMPLATE_EXAMPLES = [
    {
        "Naziv preuzimanja": "Magacin A",
        "Adresa preuzimanja": "Bulevar Kralja Aleksandra 1",
        "Grad preuzimanja": "Beograd",
        "Poštanski broj preuzimanja": "11000",
        "Naziv dostave": "Marko Petrović",
        "Adresa dostave": "Knez Mihailova 35",
        "Grad dostave": "Beograd",
        "Poštanski broj dostave": "11000",
        "Napomene": "Zvoniti na interfon",
        "Zakazano (YYYY-MM-DD HH:mm)": "2025-05-20 10:00",
        "Cena otkupa (RSD)": "1500",
        "Broj telefona primaoca": "+381641234567",
    },
    {
        "Naziv preuzimanja": "Magacin A",
        "Adresa preuzimanja": "Bulevar Kralja Aleksandra 1",
        "Grad preuzimanja": "Beograd",
        "Poštanski broj preuzimanja": "11000",
        "Naziv dostave": "Ana Jovanović",
        "Adresa dostave": "Vojvode Stepe 12",
        "Grad dostave": "Novi Sad",
        "Poštanski broj dostave": "21000",
        "Napomene": "",
        "Zakazano (YYYY-MM-DD HH:mm)": "",
        "Cena otkupa (RSD)": "",
        "Broj telefona primaoca": "0641234567",
    },
];
