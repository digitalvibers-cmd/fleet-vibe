# FleetOps - TODO Tasks

## Google Maps API Key Configuration

- [ ] **Move API key to Ember environment config**
  - Currently hardcoded in `addon/utils/google-maps-loader.js`
  - Should be moved to `config/environment.js` under `ENV.googleMaps.apiKey`
  - The `PlaceAutocompleteInput` component and loader should read from config
  - Reference: The same key is in `docker-compose.override.yml` for backend geocoding

- [ ] **Consider per-tenant API key support**
  - For SaaS multi-tenancy, each tenant may have their own Google Maps API key
  - Could be stored in company settings and fetched at runtime
  - Would require a backend endpoint: `GET /api/v1/settings/google-maps-key`

- [ ] **API key restriction in Google Cloud Console**
  - Ensure the key (`***REMOVED***`) has:
    - **Maps JavaScript API** enabled
    - **Places API** enabled
    - HTTP referrer restrictions set for production domains
