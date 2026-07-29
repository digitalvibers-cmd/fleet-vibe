import config from '@fleetbase/console/config/environment';

/**
 * Expose the build-time Google Maps browser key to the lazily-loaded
 * fleetops engine.
 *
 * The fleetops `google-maps-loader` util (in the engine bundle) reads
 * `window.__GOOGLE_MAPS_API_KEY__` because an engine cannot resolve the host
 * app's `config:environment`. We bridge it here, at host-app boot, well before
 * any fleetops route/component (e.g. PlaceAutocompleteInput) renders.
 *
 * The key itself is baked in from the server .env `${GOOGLE_MAPS_BROWSER_KEY}`
 * (the HTTP-referrer-restricted browser key, distinct from the IP-restricted
 * backend `GOOGLE_MAPS_API_KEY`) via the console Dockerfile — never hardcoded.
 */
export function initialize() {
    const apiKey = config?.googleMaps?.apiKey;
    if (typeof window !== 'undefined' && apiKey) {
        window.__GOOGLE_MAPS_API_KEY__ = apiKey;
    }
}

export default { initialize };
