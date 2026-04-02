/**
 * Google Maps JavaScript SDK Loader
 *
 * Singleton loader that ensures only one instance of the Google Maps SDK
 * is loaded per application session.
 *
 * TODO: Move API key to Ember environment config (config/environment.js)
 *       instead of hardcoding. See TODO.md for details.
 */

const GOOGLE_MAPS_API_KEY = 'AIzaSyD6yNwLnKscN9z2YrTtEcTDN7RIqVJYDLI';

let _loadPromise = null;

/**
 * Loads the Google Maps JavaScript SDK with the Places library.
 * Returns a Promise that resolves with the `google.maps` object.
 * Subsequent calls return the same promise (singleton).
 *
 * @param {string} [apiKey] - Optional API key override
 * @returns {Promise<google.maps>}
 */
export default function loadGoogleMaps(apiKey) {
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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${callbackName}`;
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
