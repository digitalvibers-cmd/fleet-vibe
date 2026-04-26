import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLES } from "@/lib/excel-import";

export async function GET() {
    const workbook = XLSX.utils.book_new();
    const data = [TEMPLATE_COLUMNS, ...TEMPLATE_EXAMPLES.map((ex) => TEMPLATE_COLUMNS.map((col) => ex[col as keyof typeof ex] ?? ""))];
    const sheet = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    sheet["!cols"] = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 4, 20) }));

    XLSX.utils.book_append_sheet(workbook, sheet, "Porudžbine");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="predlozak-porudzbina.xlsx"',
        },
    });
}
