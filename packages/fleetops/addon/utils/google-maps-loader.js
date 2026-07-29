/**
 * Google Maps JavaScript SDK Loader
 *
 * Singleton loader that ensures only one instance of the Google Maps SDK
 * is loaded per application session.
 *
 * The API key is NOT hardcoded (the previous key was revoked). Supply a key
 * either by passing it to `loadGoogleMaps(key)` or by setting the runtime
 * global `window.__GOOGLE_MAPS_API_KEY__` (e.g. from fleetbase.config.json /
 * console runtime config). It must be an HTTP-referrer-restricted browser key.
 * See TODO.md.
 */

const GOOGLE_MAPS_API_KEY = (typeof window !== 'undefined' && window.__GOOGLE_MAPS_API_KEY__) || '';

let _loadPromise = null;

/**
 * Loads the Google Maps JavaScript SDK with the Places library.
 * Returns a Promise that resolves with the `google.maps` object.
 * Subsequent calls return the same promise (singleton).
 *
 * @param {string} [apiKey] - Optional API key override
 * @param {string} [language] - Optional language override (default: 'sr')
 * @param {string} [region]   - Optional region override (default: 'RS')
 * @returns {Promise<google.maps>}
 */
export default function loadGoogleMaps(apiKey, language = 'sr', region = 'RS') {
    if (_loadPromise) {
        return _loadPromise;
    }

    // If already loaded globally (e.g. by another script)
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        _loadPromise = Promise.resolve(google.maps);
        return _loadPromise;
    }

    const key = apiKey || GOOGLE_MAPS_API_KEY;

    _loadPromise = new Promise((resolve, reject) => {
        // Create a unique callback name
        const callbackName = `__googleMapsCallback_${Date.now()}`;

        // Set up the global callback
        window[callbackName] = () => {
            delete window[callbackName];
            if (typeof google !== 'undefined' && google.maps) {
                resolve(google.maps);
            } else {
                reject(new Error('Google Maps SDK failed to initialize'));
            }
        };

        // Create and inject the script tag
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=${language}&region=${region}&callback=${callbackName}`;
        script.async = true;
        script.defer = true;

        script.onerror = () => {
            delete window[callbackName];
            _loadPromise = null;
            reject(new Error('Failed to load Google Maps SDK'));
        };

        document.head.appendChild(script);
    });

    return _loadPromise;
}
