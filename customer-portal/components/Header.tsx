"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Plus, LogOut, Building2, Upload, Printer } from "lucide-react";
import PwaInstallBanner from "./PwaInstallBanner";

const NAV_LINKS = [
  { href: "/dashboard", label: "Kontrolna tabla" },
  { href: "/company", label: "Profil", icon: Building2 },
];

interface HeaderProps {
  selectedCount?: number;
  onPrintLabels?: () => void;
  printing?: boolean;
}

export default function Header({ selectedCount = 0, onPrintLabels, printing = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
    <header className="sticky top-0 z-10 border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <div
            className="flex cursor-pointer items-center gap-2.5"
            onClick={() => router.push("/dashboard")}
          >
            <Image
              src="/flybox-logo.png"
              alt="FlyBox"
              width={120}
              height={60}
              className="h-10 w-auto"
              priority
            />
          </div>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onPrintLabels && (
            <button
              onClick={onPrintLabels}
              disabled={!selectedCount || printing}
              className="flex items-center gap-1.5 rounded-[25px] border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
              title={selectedCount ? "Štampaj otpremnice za odabrane narudžbine" : "Odaberite narudžbine za štampu"}
            >
              <Printer className="h-4 w-4" />
              <span>
                Štampaj nalepnice{selectedCount ? ` (${selectedCount})` : ""}
              </span>
            </button>
          )}
          <button
            onClick={() => router.push("/orders/import")}
            className="flex items-center gap-1.5 rounded-[25px] border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            <span>Uvezi Excel</span>
          </button>
          <button
            onClick={() => router.push("/orders/new")}
            className="flex items-center gap-1.5 rounded-[25px] bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Nova narudžbina</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted"
            title="Odjava"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex sm:hidden border-t border-border">
        {NAV_LINKS.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`flex-1 py-2 text-center text-xs font-medium transition ${
                isActive
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>
    </header>
    <PwaInstallBanner />
    </>
  );
}
