"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Variant = "success" | "error";

interface ToastProps {
  message: string;
  variant?: Variant;
  onDismiss: () => void;
  durationMs?: number;
}

export default function Toast({
  message,
  variant = "success",
  onDismiss,
  durationMs = 4000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  const isSuccess = variant === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  const colorClass = isSuccess ? "bg-green-600" : "bg-danger";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${colorClass}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
