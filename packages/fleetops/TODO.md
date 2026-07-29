# FleetOps - TODO Tasks

## Google Maps API Key Configuration

> **Done:** the old hardcoded key was revoked and removed. The browser Maps key
> is now injected at build time — it lives only in the server `.env`
> (`${GOOGLE_MAPS_BROWSER_KEY}`, gitignored) and is never hardcoded in the repo:
>
> `Dockerfile.dev` (ARG `GOOGLE_MAPS_BROWSER_KEY`) → `config/environment.js`
> (`ENV.googleMaps.apiKey` via `getenv`) → `initializers/set-google-maps-key.js`
> sets `window.__GOOGLE_MAPS_API_KEY__` → the fleetops engine
> `google-maps-loader.js` reads that global (or an explicit `loadGoogleMaps(key)`).
>
> `GOOGLE_MAPS_BROWSER_KEY` is the HTTP-referrer-restricted **browser** key (shared
> with the customer portal), distinct from `GOOGLE_MAPS_API_KEY` — the IP-restricted
> **backend** key used only by PHP server-side geocoding.
>
> As a client-side key it is still visible in the served bundle at runtime (as is
> unavoidable for any browser Maps key) — protect it via **HTTP-referrer
> restrictions** in Google Cloud Console (Maps JavaScript API + Places API). The
> shared browser key's referrer list must include BOTH portal and console domains.

- [ ] **Consider per-tenant API key support**
  - Could be stored in company settings and fetched at runtime
  - Would require a backend endpoint: `GET /api/v1/settings/google-maps-key`
