"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  MapPin,
  Clock,
  Calendar,
  User,
  Truck as TruckIcon,
  Phone,
  Package,
  FileText,
  XCircle,
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
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${color}`}
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

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setOrder(data.order || data);
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id, router]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Order not found</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-primary hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const canCancel = ["created", "dispatched"].includes(order.status);

  return (
    <div className="min-h-full bg-muted/30">
      <Header />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* Order title + status */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold font-heading truncate">
            {order.tracking_number?.tracking_number || order.public_id}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        {/* Locations */}
        <Section title="Locations" icon={MapPin}>
          <div className="space-y-3">
            {order.payload?.pickup && (
              <div className="flex items-start gap-2.5">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Pickup
                  </p>
                  <p className="text-sm">
                    {order.payload.pickup.street1 ||
                      order.payload.pickup.name}
                    {order.payload.pickup.city &&
                      `, ${order.payload.pickup.city}`}
                  </p>
                </div>
              </div>
            )}
            {order.payload?.waypoints?.map((wp, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Waypoint {i + 1}
                  </p>
                  <p className="text-sm">
                    {wp.street1 || wp.name}
                    {wp.city && `, ${wp.city}`}
                  </p>
                </div>
              </div>
            ))}
            {order.payload?.dropoff && (
              <div className="flex items-start gap-2.5">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Dropoff
                  </p>
                  <p className="text-sm">
                    {order.payload.dropoff.street1 ||
                      order.payload.dropoff.name}
                    {order.payload.dropoff.city &&
                      `, ${order.payload.dropoff.city}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Details */}
        <Section title="Details" icon={FileText}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-medium">{order.public_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{order.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(order.created_at)}
              </span>
            </div>
            {order.scheduled_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.scheduled_at)}
                </span>
              </div>
            )}
            {order.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Notes
                </p>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </div>
        </Section>

        {/* Driver */}
        {order.driver_assigned && (
          <Section title="Assigned Driver" icon={TruckIcon}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {order.driver_assigned.name}
                </p>
                {order.driver_assigned.phone && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {order.driver_assigned.phone}
                  </p>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Entities */}
        {order.payload?.entities && order.payload.entities.length > 0 && (
          <Section title="Items" icon={Package}>
            <div className="space-y-2">
              {order.payload.entities.map((entity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm"
                >
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{entity.name || `Item ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tracking history */}
        {order.tracking_statuses && order.tracking_statuses.length > 0 && (
          <Section title="Tracking History" icon={Clock}>
            <div className="space-y-3">
              {order.tracking_statuses.map((ts, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        i === 0 ? "bg-primary" : "bg-border"
                      }`}
                    />
                    {i < order.tracking_statuses.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium capitalize">
                      {ts.status.replace(/-/g, " ")}
                    </p>
                    {ts.details && (
                      <p className="text-xs text-muted-foreground">
                        {ts.details}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(ts.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Cancel button */}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex w-full items-center justify-center gap-2 rounded-[25px] border border-danger px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        )}
      </main>
    </div>
  );
}
