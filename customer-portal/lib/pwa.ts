type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners: Array<(event: BeforeInstallPromptEvent) => void> = [];

export function setPwaPrompt(event: BeforeInstallPromptEvent) {
  deferredPrompt = event;
  listeners.forEach((cb) => cb(event));
}

export function getPwaPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function clearPwaPrompt() {
  deferredPrompt = null;
}

export function subscribeToPwaPrompt(
  callback: (event: BeforeInstallPromptEvent) => void
): () => void {
  listeners.push(callback);
  // If prompt already captured, fire immediately
  if (deferredPrompt) {
    callback(deferredPrompt);
  }
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export type { BeforeInstallPromptEvent };
