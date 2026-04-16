"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import {
  subscribeToPwaPrompt,
  clearPwaPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";

const DISMISS_KEY = "pwa-install-dismissed";

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show if previously dismissed
    if (localStorage.getItem(DISMISS_KEY)) return;

    const unsubscribe = subscribeToPwaPrompt((event) => {
      setPrompt(event);
      setVisible(true);
    });

    return unsubscribe;
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      clearPwaPrompt();
    }
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-white shadow-lg">
        <Download className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium">
          Instalirajte FlyBox za brz pristup
        </p>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-xl bg-white px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-white/90"
        >
          Instaliraj
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 transition hover:bg-white/20"
          aria-label="Zatvori"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
