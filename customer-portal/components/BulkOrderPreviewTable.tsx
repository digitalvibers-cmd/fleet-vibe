"use client";

import { CheckCircle, XCircle, MapPin, Calendar } from "lucide-react";
import type { ParsedOrder } from "@/lib/excel-import";

interface Props {
    orders: ParsedOrder[];
}

export default function BulkOrderPreviewTable({ orders }: Props) {
    const validCount = orders.filter((o) => o.isValid).length;
    const invalidCount = orders.length - validCount;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    {validCount} validnih
                </span>
                {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5 text-red-600">
                        <XCircle className="h-4 w-4" />
                        {invalidCount} nevalidnih (biće preskočene)
                    </span>
                )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">#</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Preuzimanje</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Dostava</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Zakazano</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Napomene</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                        {orders.map((order) => (
                            <tr key={order.rowIndex} className={order.isValid ? "" : "bg-red-50"}>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{order.rowIndex}</td>

                                <td className="px-3 py-2.5">
                                    <div className="flex items-start gap-1">
                                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                                        <div>
                                            {order.pickupName && (
                                                <div className="text-xs font-medium">{order.pickupName}</div>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {order.pickupAddress || <span className="text-red-500">—</span>}
                                                {order.pickupCity && `, ${order.pickupCity}`}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-3 py-2.5">
                                    <div className="flex items-start gap-1">
                                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                                        <div>
                                            {order.dropoffName && (
                                                <div className="text-xs font-medium">{order.dropoffName}</div>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {order.dropoffAddress || <span className="text-red-500">—</span>}
                                                {order.dropoffCity && `, ${order.dropoffCity}`}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                    {order.scheduledAt ? (
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(order.scheduledAt).toLocaleString("sr-Latn", {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </td>

                                <td className="px-3 py-2.5 max-w-[160px]">
                                    <span className="truncate text-xs text-muted-foreground block">
                                        {order.notes || "—"}
                                    </span>
                                </td>

                                <td className="px-3 py-2.5">
                                    {order.isValid ? (
                                        <span className="flex items-center gap-1 text-xs text-green-700">
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            OK
                                        </span>
                                    ) : (
                                        <div className="group relative">
                                            <span className="flex cursor-default items-center gap-1 text-xs text-red-600">
                                                <XCircle className="h-3.5 w-3.5" />
                                                Greška
                                            </span>
                                            <div className="absolute bottom-full left-0 z-10 mb-1 hidden w-48 rounded-lg border border-red-200 bg-white p-2 text-xs text-red-700 shadow-md group-hover:block">
                                                {order.validationErrors.map((e, i) => (
                                                    <div key={i}>• {e}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
