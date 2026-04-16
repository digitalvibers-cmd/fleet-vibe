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
} from "lucide-react";
import type { Order } from "@/lib/types";
import Header from "@/components/Header";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  dispatched: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-red-100 text-red-800",
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

export default function DashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: "-created_at", limit: "50" });
      if (dateFrom) params.set("after", dateFrom);
      if (dateTo) params.set("before", dateTo);

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
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/* Main content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            Filter
          </button>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="text-sm text-primary hover:underline"
            >
              Clear
            </button>
          )}
          <button
            onClick={fetchOrders}
            className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Orders list */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin" />
            <p className="text-sm">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">No orders found</p>
            <p className="mt-1 text-xs">Create your first delivery order</p>
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
                        Scheduled: {formatDate(order.scheduled_at)}
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
