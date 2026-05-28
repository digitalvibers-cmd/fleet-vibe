"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Order } from "@/lib/types";
import Header from "@/components/Header";

const ARCHIVE_STATUSES = ["completed", "canceled", "order_canceled", "expired"];
const ACTIVE_STATUSES = [
  "created",
  "dispatched",
  "enroute",
  "started",
  "in-progress",
  "preparing",
  "assigned",
  "driver_enroute",
  "scheduled",
  "picked_up",
  "pending",
];

type StatusFilter = "all" | "active" | "archive";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  dispatched: "bg-yellow-100 text-yellow-800",
  enroute: "bg-orange-100 text-orange-800",
  started: "bg-orange-100 text-orange-800",
  "in-progress": "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-red-100 text-red-800",
  order_canceled: "bg-red-100 text-red-800",
  expired: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}
    >
      {status.replace(/-/g, " ")}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sr-Latn", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}.`;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Ukloni filter ${label}`}
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-border hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: "-created_at", limit: "50" });
      if (searchQuery) params.set("query", searchQuery);

      if (dateFrom || dateTo) {
        const from = dateFrom ? `${dateFrom}T00:00:00` : "1970-01-01T00:00:00";
        const to = dateTo ? `${dateTo}T23:59:59` : "9999-12-31T23:59:59";
        params.set("created_at", `${from},${to}`);
      }

      if (statusFilter === "active") {
        params.set("status", ACTIVE_STATUSES.join(","));
      } else if (statusFilter === "archive") {
        params.set("status", ARCHIVE_STATUSES.join(","));
      }

      const res = await fetch(`/api/orders?${params}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [searchQuery, dateFrom, dateTo, statusFilter, router]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/* Main content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Quick filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "active" ? "all" : "active")
            }
            aria-pressed={statusFilter === "active"}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === "active"
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            Aktivne dostave
          </button>
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "archive" ? "all" : "archive")
            }
            aria-pressed={statusFilter === "archive"}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === "archive"
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            Arhiva dostava
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Pretraži po ID narudžbine
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Npr. FLE123..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchOrders();
                }}
                className="w-full rounded-xl border border-border py-2 pl-10 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Od datuma
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-border py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Do datuma
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-border py-2 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            Filtriraj
          </button>
          {(searchQuery || dateFrom || dateTo || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDateFrom("");
                setDateTo("");
                setStatusFilter("all");
              }}
              className="text-sm text-primary hover:underline"
            >
              Obriši sve filtere
            </button>
          )}
          <button
            onClick={fetchOrders}
            className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            title="Osveži"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Active filter chips */}
        {(searchQuery || dateFrom || dateTo || statusFilter !== "all") && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Primenjeni filteri:</span>
            {statusFilter === "active" && (
              <FilterChip
                label="Aktivne dostave"
                onRemove={() => setStatusFilter("all")}
              />
            )}
            {statusFilter === "archive" && (
              <FilterChip
                label="Arhiva dostava"
                onRemove={() => setStatusFilter("all")}
              />
            )}
            {searchQuery && (
              <FilterChip
                label={`ID: ${searchQuery}`}
                onRemove={() => setSearchQuery("")}
              />
            )}
            {dateFrom && (
              <FilterChip
                label={`Od: ${formatDateShort(dateFrom)}`}
                onRemove={() => setDateFrom("")}
              />
            )}
            {dateTo && (
              <FilterChip
                label={`Do: ${formatDateShort(dateTo)}`}
                onRemove={() => setDateTo("")}
              />
            )}
          </div>
        )}

        {/* Orders list */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin" />
            <p className="text-sm">Učitavanje narudžbina...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">Nema pronađenih narudžbina</p>
            <p className="mt-1 text-xs">Kreirajte vašu prvu narudžbinu za dostavu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/orders/${order.public_id}`)}
                className="group flex w-full items-start gap-4 rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold">
                      {order.tracking_number?.tracking_number ||
                        order.public_id}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>

                  {order.payload?.pickup && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                      <span className="truncate">
                        {order.payload.pickup.street1 ||
                          order.payload.pickup.name}
                        {order.payload.pickup.city &&
                          `, ${order.payload.pickup.city}`}
                      </span>
                    </div>
                  )}
                  {order.payload?.dropoff && (
                    <div className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                      <span className="truncate">
                        {order.payload.dropoff.street1 ||
                          order.payload.dropoff.name}
                        {order.payload.dropoff.city &&
                          `, ${order.payload.dropoff.city}`}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(order.created_at)}
                    </span>
                    {order.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Zakazano: {formatDate(order.scheduled_at)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
