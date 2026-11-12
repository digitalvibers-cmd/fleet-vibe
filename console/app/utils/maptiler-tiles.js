/**
 * LogiVibe: swap CARTO basemap tiles for MapTiler.
 *
 * Upstream Fleetbase hardcodes `https://{s}.basemaps.cartocdn.com/<style>/{z}/{x}/{y}.png`
 * (no API key) in ~12 fleetops components. CARTO now answers keyless requests with an
 * "API KEY REQUIRED" placeholder tile (HTTP 200), so every map in the console lost its
 * base layer. Instead of editing each embedded fleetops file (overwritten on upstream
 * sync), we rewrite the URL at the single place every map goes through: L.TileLayer.
 *
 * The key is the build-time `MAPTILER_KEY` (server .env -> docker build arg ->
 * config/environment.js). With no key configured the URL is left untouched.
 */

const CARTO_PATTERN = /^https?:\/\/[^/]*basemaps\.cartocdn\.com\/(?:rastertiles\/)?([a-z_]+)\//i;

// CARTO style -> MapTiler map id
const STYLE_MAP = {
    light_all: 'streets-v2',
    light_nolabels: 'streets-v2',
    voyager: 'streets-v2',
    dark_all: 'streets-v2-dark',
    dark_nolabels: 'streets-v2-dark',
};

export const MAPTILER_ATTRIBUTION =
    '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

/**
 * Returns the MapTiler URL template for a CARTO basemap URL template, or the
 * original value when it is not a CARTO URL or no key is configured.
 *
 * The `/256/` path segment requests 256px tiles, so Leaflet's default tileSize
 * and zoom levels keep working without touching layer options.
 */
export function rewriteTileUrl(url, apiKey) {
    if (typeof url !== 'string' || !apiKey) {
        return url;
    }

    const match = url.match(CARTO_PATTERN);
    if (!match) {
        return url;
    }

    const mapId = STYLE_MAP[match[1].toLowerCase()] ?? 'streets-v2';
    return `https://api.maptiler.com/maps/${mapId}/256/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Patches L.TileLayer so both construction and later `setUrl()` calls
 * (theme switch in the live map) go through `rewriteTileUrl`.
 */
export default function patchLeafletTileLayer(L, apiKey) {
    const TileLayer = L?.TileLayer;
    if (!TileLayer || !apiKey || TileLayer.prototype.__logiVibeMapTiler) {
        return false;
    }

    const proto = TileLayer.prototype;
    const originalInitialize = proto.initialize;
    const originalSetUrl = proto.setUrl;

    proto.initialize = function (url, options) {
        const rewritten = rewriteTileUrl(url, apiKey);
        if (rewritten !== url) {
            options = { ...options, attribution: MAPTILER_ATTRIBUTION };
        }
        return originalInitialize.call(this, rewritten, options);
    };

    proto.setUrl = function (url, noRedraw) {
        return originalSetUrl.call(this, rewriteTileUrl(url, apiKey), noRedraw);
    };

    proto.__logiVibeMapTiler = true;
    return true;
}
