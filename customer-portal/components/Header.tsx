"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Plus, LogOut, Building2 } from "lucide-react";
import PwaInstallBanner from "./PwaInstallBanner";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/company", label: "Company", icon: Building2 },
];

export default function Header() {
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
          <button
            onClick={() => router.push("/orders/new")}
            className="flex items-center gap-1.5 rounded-[25px] bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Order</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted"
            title="Sign out"
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
