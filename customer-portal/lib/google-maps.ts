let loadPromise: Promise<typeof google.maps> | null = null;

export default function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loadPromise) return loadPromise;

  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded client-side"));
  }

  // Already loaded globally
  if (typeof google !== "undefined" && google.maps?.places) {
    loadPromise = Promise.resolve(google.maps);
    return loadPromise;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = `__googleMapsCallback_${Date.now()}`;

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (typeof google !== "undefined" && google.maps) {
        resolve(google.maps);
      } else {
        reject(new Error("Google Maps SDK failed to initialize"));
      }
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      loadPromise = null;
      reject(new Error("Failed to load Google Maps SDK"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
