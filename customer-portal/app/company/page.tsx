"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  Hash,
  RefreshCw,
} from "lucide-react";
import Header from "@/components/Header";

interface CustomerInfo {
  name: string | null;
  public_id: string | null;
  phone: string | null;
  email: string | null;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch("/api/company");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setCustomer(data.customer || null);
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    }
    fetchCustomer();
  }, [router]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin" />
            <p className="text-sm">Učitavanje profila...</p>
          </div>
        ) : !customer ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <User className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">Profil nije dostupan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer header card */}
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-heading">
                    {customer.name || "Korisnik"}
                  </h1>
                  {customer.public_id && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {customer.public_id}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact details */}
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-primary" />
                Kontakt podaci
              </h2>
              <div className="divide-y divide-border">
                <InfoRow icon={Hash} label="ID" value={customer.public_id} />
                <InfoRow icon={Mail} label="Email" value={customer.email} />
                <InfoRow icon={Phone} label="Telefon" value={customer.phone} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
