# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fleetbase is a modular logistics and supply chain operating system (v0.7.28). It uses a PHP/Laravel backend API, an Ember.js frontend console, and 14 git submodules in `packages/` for shared libraries and extensions.

**License**: Dual-licensed under AGPL-3.0 (open source) and FCL (commercial).

## Architecture

- **api/**: Laravel 10 backend running on Laravel Octane with FrankenPHP. Uses Composer for dependencies.
- **console/**: Ember.js 5.4 frontend with Tailwind CSS. Uses pnpm as package manager.
- **packages/**: Git submodules containing core libraries and extension engines:
  - `core-api` / `ember-core` / `ember-ui` — shared foundation libraries
  - `fleetops` — main fleet operations engine (the primary extension)
  - `storefront`, `pallet`, `ledger`, `iam-engine`, `dev-engine` — feature extensions
  - `registry-bridge`, `fleetbase-extensions-indexer` — extension system infrastructure
  - `fleetops-data` — FleetOps data models
- **docker/**: Dockerfiles and service configs (httpd, database init scripts)
- **scripts/**: Installation and deployment scripts

### Services (docker-compose.yml)

| Service | Description | Port |
|---------|-------------|------|
| application | Laravel API (FrankenPHP + Octane) | — |
| httpd | Reverse proxy (Apache/Caddy) | 8000 |
| console | Ember.js frontend (nginx) | 4200 |
| database | MySQL 8.0 | 33060 |
| cache | Redis 4 | — |
| queue | Laravel queue worker (Redis) | — |
| scheduler | Cron jobs via go-crond | — |
| socket | SocketCluster v17 (WebSocket) | 38000 |

### Frontend-API Connection

Console connects to the API via config in `console/fleetbase.config.json`:
- API_HOST: `http://localhost:8000`
- SocketCluster: `localhost:38000`

## Common Commands

### Docker (primary development method)

```bash
./scripts/local-setup.sh             # Interactive first-time setup (creates .env, builds, starts)
make local                            # Start local stack
make local-down                       # Stop local stack
make local-shell                      # Shell into API container
make migrate                          # Run migrations against the running stack
docker compose exec application php artisan tinker  # Laravel REPL
```

The local setup generates root `.env` from `.env.local.example` (with auto-generated `APP_KEY` and `COOKIE_SECRET`). Choose the env by Make target (`make local|dev|prod`) — each uses the matching `docker-compose.<env>.yml` overlay.

### Console (Ember.js)

```bash
cd console
pnpm install
pnpm start              # ember serve (dev on port 4200)
pnpm run build          # ember build
pnpm run lint           # all linters (eslint, stylelint, ember-template-lint, intl)
pnpm run lint:js        # eslint only
pnpm run lint:css       # stylelint only
pnpm run lint:hbs       # handlebars template lint only
pnpm run test           # lint + test suite
pnpm run test:ember     # qunit tests only via ember test
```

### API (Laravel)

```bash
cd api
composer install
php artisan key:generate
php artisan migrate
php artisan queue:work       # Process queue jobs
php artisan test             # PHPUnit tests (phpunit.xml)
```

### Deployment

```bash
# Inside the application container:
./deploy.sh   # Runs migrations, seeders, cache clearing
```

## Code Style

### Console
- Prettier: tabWidth 4, printWidth 190, trailingComma "es5"
- ESLint configured via `.eslintrc.js`
- Stylelint configured via `.stylelintrc.js`
- Handlebars templates linted via `.template-lintrc.js`

### API
- Standard Laravel conventions
- PHP 8.0-8.2 compatibility

## Submodule Workflow

Most business logic lives in `packages/` submodules, not directly in `api/` or `console/`. When modifying extension behavior (storefront, IAM, etc.), the relevant submodule is where changes go. The main repo pins submodule commits — after updating a submodule, the pointer in the parent repo needs updating too.

**Exception — `packages/fleetops/` is embedded, not a submodule.** It is tracked as regular files in the parent repo so the local Docker overlay (see below) can customize it. This means upstream Fleetbase syncs for fleetops are done by manually copying files into `packages/fleetops/`, which **will overwrite any local edits in that directory**. Do NOT put LogiVibe-specific overrides inside `packages/fleetops/`. Put them in `console/app/styles/` (CSS), in a custom extension, or in `console/app/` directly.

## Where to Put Local Overrides (so upstream syncs don't break them)

- **CSS overrides for Fleetbase components**: `console/app/styles/console.css`. It is part of the main Ember bundle, loads globally, and lives outside `packages/`. Example: the mobile responsiveness fix for `.next-content-overlay-panel` lives here.
- **New UI behavior**: a custom Ember extension (see "Custom Extensions" below), not a patch to `packages/ember-ui/` or `packages/fleetops/`.
- **API overrides**: a custom Laravel package, not a patch to `packages/core-api/`.

### LogiVibe core fleetops modifikacije (RS lokalizacija)

Sledeći fajlovi u `packages/fleetops/` su izmenjeni za rad sa srpskim adresama na latinici (npr. "Dusana Pudje" sada radi isto kao ćirilični unos). Pri sledećem upstream sync-u, ove izmene moraju se re-aplicirati ručno (`git log -- packages/fleetops/` za diff):

- `addon/utils/google-maps-loader.js` — `language` + `region` parametri (default `sr`/`RS`) na Google Maps SDK URL.
- `addon/utils/serbian-translit.js` (novi) — latinica → ćirilica transliteracija.
- `addon/components/place-autocomplete-input.js` — `componentRestrictions: { country: ['rs'] }`, RS bounds, cyrillic Geocoder fallback kada Autocomplete ne vrati rezultat.
- `server/src/Support/Geocoding.php` — locale iz `GOOGLE_MAPS_LOCALE` env var (default `sr`) umesto hardkodovanog `'en'`.
- `server/src/Models/Place.php` — `createFromGeocodingLookup` vraća `null` umesto Place sa `(0, 0)`; `getValuesFromGeocodingLookup` vraća `[]`; `createFromMixed` ne fallback-uje na `(0, 0)`; `createFromImportRow` preskaće red ako geocoding fail.
- `server/config/geocoder.php` — default locale `'sr'` umesto `'us'`.
- `addon/components/custom-field/input.hbs` (novi override iz `packages/ember-ui/`) + `addon/components/custom-field/input.js` (novi) + `app/components/custom-field/input.js` (novi re-export) — uklanja hardkodovan `(or @currency "USD")` fallback u money-input grani template-a. Nužno za RSD prikaz u svim `<CustomField::Input>` instancama unutar fleetops-engine bundle-a. Klasa ima `static logiVibeTemplateOverride = true;` da zaobiđe Ember-CLI "trivial re-export" build error — ako se ovo ikad refaktoriše, ne smanjivati telo klase na prazno. Pri upstream sync-u `packages/ember-ui/custom-field/input.hbs`, mora se manuelno re-aplicirati i ovde (diff sa upstream-om).

### LogiVibe core fleetops modifikacije (Custom Field persistence pri promeni tipa porudžbine)

Custom fields ("cena-otkupa", "broj-primaoca") definišu se po `OrderConfig`-u — svaki tip porudžbine ima sopstveni `CustomField` zapis sa istim `name` slug-om ali različitim `uuid`-em. Kada operater promeni tip porudžbine kroz edit modal u konzoli, postojeće `CustomFieldValue` vrednosti pokazuju na CF UUID STAROG configa i UI ih ne renderuje (jer `<CustomField::Yield @owner={{@resource.order_config}}>` učitava samo CF-ove trenutnog configa). Sledeće izmene re-linkuju CFV zapise po `name` poklapanju kad se `order_config_uuid` promeni:

- `server/src/Support/CustomFieldRelinker.php` (novi) — servis `relinkForOrder(Order, oldConfigUuid)`. Učitava sve CFV-e porudžbine, traži CF-ove novog configa po `name`, prebacuje `custom_field_uuid`. Konflikt strategija: ako u novom configu već postoji CFV za isti `custom_field_uuid`, postojeća pobeđuje (stara se briše). Sve u `DB::transaction` + `try/catch` koji loguje `Log::warning` — re-link nikad ne sme da pukne save porudžbine. Koristi FQCN za `subject_type` (`Fleetbase\FleetOps\Models\Order`, `Fleetbase\FleetOps\Models\OrderConfig`) jer `Order::morphMap` ne maperira ove klase.
- `server/src/Observers/OrderObserver.php` — u `updated(Order $order)` proverava `$order->wasChanged('order_config_uuid')` i poziva `app(CustomFieldRelinker::class)->relinkForOrder($order, $order->getOriginal('order_config_uuid'))`. **Važno**: ne čuvaj staro stanje u instance property observera (npr. `$this->previousOrderConfigUuid` postavljen u `updating()`) — pod Octane-om observers se mogu re-instancirati između `updating` i `updated` događaja i instance state se gubi. `getOriginal()` u `updated` eventu radi pouzdano jer Eloquent sync-uje `original` TEK posle event-a. Logika ide PRE nego što `OrderController::onAfterUpdate` pozove `syncCustomFieldValues`, tako da ako frontend pošalje nove CFV vrednosti uz promenu tipa, one upsertuju nad re-linkovane (željeno).
- `addon/services/order-actions.js` — u `editOrderDetails` `confirm` callback-u dodato `await order.reload()` posle `await order.save()`. Bez toga Ember Data store keširani `custom_field_values` ne pokazuju migrirane vrednosti dok se stranica ne osveži ručno.

Orphaned CFV-i (kada novi config nema polje sa istim `name`) ostaju u bazi nepromenjeni — vraćaju se ako se tip vrati na config gde poklapanje postoji. Nema masovne migracije postojećih porudžbina; re-link se dešava pri sledećem type change-u na svakoj porudžbini.

### LogiVibe core fleetops modifikacije (QR scan self-assign za FlyBox Driver app)

Mobilna aplikacija za vozače (`flybox-driver-app`, zaseban repo na `~/Projects/flybox-driver-app/`) skenira QR kod sa paketa da bi se vozač sam dodelio na porudžbinu. App gађa **PUBLIC `/v1/`** API sa driver Sanctum tokenom (`@fleetbase/sdk` default namespace je `v1`), pa endpointi žive u `Api\v1\OrderController`-u (NE Internal). Pri upstream fleetops sync-u re-aplicirati ručno (`git log -- packages/fleetops/`):

- `server/src/Http/Controllers/Api/v1/OrderController.php` (novo) — tri metode:
  - `resolveScannedOrder(?string $code): ?Order` (private) — Fleetbase QR/barcode kodira **owner UUID** (`DNS2D::getBarcodePNG($owner_uuid, 'QRCODE')`), NE `tracking_number` string. Skener vraća goli UUID. Resolve: prvo `Order::where('uuid', $code)`; ako nema, `Entity::where('uuid', $code)` → parent order preko `payload_uuid`. Sve `withoutGlobalScopes()` da cross-company vrati 403 (a ne 404); caller eksplicitno proverava `company_uuid`.
  - `scanResolve(Request)` → `POST /v1/orders/scan-resolve` `{ code }` — preview, **bez mutacije**. Vraća `OrderResource` (pickup/dropoff/custom fields preko `withCustomFields()`) + `meta: { already_assigned, assigned_to_current_driver }`. 404 ako ne postoji, 403 druga firma.
  - `scanAssign(Request)` → `POST /v1/orders/scan-assign` `{ code }` — dodeljuje + dispečuje. Trenutni vozač se rezolvuje iz **autentifikovanog usera** (`Driver::where('user_uuid', $request->user()->uuid)`), nikad iz client input-a. `DB::transaction` + `lockForUpdate()` (race-safe protiv dvostrukog claim-a): 409 ako je dodeljen DRUGOM vozaču (idempotentno ako je isti), inače `$order->assignDriver($driver)` pa `$order->firstDispatchWithActivity()`. **Dispatch je obavezan** — Orders lista u app-u filtrira `created` status, pa puko `driver_assigned_uuid` ne bi prikazalo porudžbinu. Postavlja `session('company')` iz ordera pre assign-a (driver token ne mora imati session company; `notifyDriverAssigned` ga čita).
- `server/src/routes.php` — dve rute u `/v1/orders` grupi, PRE `{id}` ruta: `scan-resolve`, `scan-assign`.

**Nema** izmene Order Configuration-a, nema novog `picked_up` activity tipa — assign + dispatch je dovoljan signal. Frontend (screens, navigacija) je u `flybox-driver-app` repou, ne ovde.

### LogiVibe console (`console/app/`) overrides — RSD valuta

Sledeći fajlovi NISU u submodulima — žive u `console/app/` i traju kroz sve upstream sync-ove. Postoje zbog upstream Fleetbase bug-a: GeoIP whois (`/int/v1/lookup/whois`) vraća `currency_code: "RSD"` (flat), ali `MoneyInput.js` i `CurrencySelect.js` čitaju `whois.currency.code` (nested) — schemas ne match-uju, pa svi money inputi padaju na hardkodovan `'USD'` fallback uprkos `companies.currency = 'RSD'`.

- `console/app/services/current-user.js` — extends `@fleetbase/ember-core/services/current-user`; override-uje `loadWhois()` da posle fetch-a doda `whois.currency = { code: currency_code, name: currency_name }` ako fali nested polje. Ne dira upstream submodule.
- `console/app/components/custom-field/input.{hbs,js}` — isti fix kao fleetops verzija, ali za main console bundle (non-engine kontekst). Template iste sadržine kao fleetops kopija — pri izmeni jedne, sinhronizovati drugu.

## Docker Console Build — pnpm Symlink Caveat

`console/Dockerfile.dev` overlays local `packages/fleetops/` files on top of the npm-installed `@fleetbase/fleetops-engine`. Because pnpm uses a symlink store (`node_modules/@fleetbase/fleetops-engine` → `.pnpm/…/node_modules/@fleetbase/fleetops-engine`), files must be copied into the **resolved real path** (`readlink -f`), not the symlink path. A plain `COPY ... node_modules/@fleetbase/fleetops-engine/` creates a new directory alongside the symlink and the engine's actual package remains unchanged.

After changing files in `packages/fleetops/` **or** `console/app/`, rebuild with `docker compose build --no-cache console` to ensure Docker doesn't serve cached layers.

## Ember Engine Gotchas (fleetops-engine)

- **Lazy-loaded engine**: `fleetops-engine` uses `lazyLoading: { enabled: true }`. Its components are NOT in the main `console.js` bundle — they are in `engines-dist/@fleetbase/fleetops-engine/assets/engine.js`. When verifying build output, check that file, not `@fleetbase/console.js`.
- **Place model computed properties**: The `Place` model (from `@fleetbase/fleetops-data`) has `latitude` and `longitude` as **computed properties** derived from the `location` GeoJSON field (`get latitude() { return get(this.location, 'coordinates.1') }`). Never pass `latitude`/`longitude` directly to `store.createRecord('place', ...)` — it will throw "Cannot override computed property". Only pass the `location` object `{ type: 'Point', coordinates: [lng, lat] }`.
- **Ember Data relationships**: When setting a value on a `belongsTo` relationship (e.g. `payload.pickup`), you must use a proper Ember Data model instance (`store.createRecord(...)`) — plain `EmberObject.create()` will be rejected.

## Key Environment Variables

Set via `docker-compose.override.yml` or container environment:
- `DATABASE_URL` — MySQL connection string
- `QUEUE_CONNECTION` — `redis`
- `CACHE_DRIVER` / `CACHE_URL` / `REDIS_URL` — Redis caching
- `BROADCAST_DRIVER` — `socketcluster` for real-time features
- `REGISTRY_HOST` — Fleetbase extension registry
- `OSRM_HOST` — Routing engine for fleet operations
- `MAIL_MAILER` — Mail driver (`mailgun` on dev/prod)
- `MAILGUN_DOMAIN` / `MAILGUN_SECRET` / `MAILGUN_ENDPOINT` — Mailgun credentials (EU endpoint: `api.eu.mailgun.net`)
- `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` — Sender identity for outgoing emails

### Mail Configuration

Mail is configured via **environment variables** in `docker-compose.override.yml`, NOT through the Fleetbase Admin UI. The Fleetbase Admin panel "Notification Channels" setting does NOT affect Laravel's `$user->notify()` calls (used for user invitations, etc.). All three services that send or process email (`application`, `queue`, `scheduler`) must have the same `MAIL_*` / `MAILGUN_*` env vars. A YAML anchor `x-mail-env` is used to keep them in sync.

## LogiVibe — Project Context

This repository is **LogiVibe**, an internal logistics operations system for **FlyBox Delivery**, built on top of the Fleetbase open-source platform. It is NOT a multi-tenant SaaS — it is a single-tenant internal tool for managing orders, dispatching, drivers, and real-time tracking within one company.

Key project documents:
- `Strategy` — Strategic plan and product vision
- `ROADMAP.md` — Task tracker with progress checkboxes across 3 phases

## Branching & Deployment Strategy

| Branch | Environment | Domains | Notes |
|--------|------------|---------|-------|
| (working copy) | **Local** | `localhost:4200` / `:8000` / `:3000` | `make local`, mail to log |
| `dev` | **Dev (Hetzner)** | `fleetvibe.digitalvibe.rs`, `apifleetvibe.digitalvibe.rs`, `portal-fleetvibe.digitalvibe.rs` | Auto-deploy on push |
| `main` | **Prod (Hetzner)** | `console.flybox.rs`, `api.flybox.rs`, `flybox.rs` | Auto-deploy on push; ff-only merge from `dev` |

**Rules:**
- All development work happens on `dev` or feature branches merged into `dev`.
- `main` only receives merges from `dev` when a release is ready (`git checkout main && git merge --ff-only dev && git push`).
- CI/CD (GitHub Actions) deploys automatically:
  - Push to `dev` → dev server (excluding `customer-portal/**`, which has its own workflow)
  - Push to `main` → prod server (same path split for portal)
- Every deploy workflow has a `verify` job that smoke-tests the API health endpoint, console runtime config, and portal login page. A failure marks the deploy red but does not auto-rollback.

## Environments

### Local
- **Console**: http://localhost:4200
- **API**: http://localhost:8000
- **Portal**: http://localhost:3000
- **DB**: MySQL on host port 33060
- Mail goes to `storage/logs/laravel.log` (`MAIL_MAILER=log`) — never reaches real customers.
- Secrets in root `.env` (gitignored). Run `./scripts/local-setup.sh` to generate.

### Dev (Hetzner, `/opt/fleetvibe`)
- **Console**: https://fleetvibe.digitalvibe.rs (host port 4200)
- **API**: https://apifleetvibe.digitalvibe.rs (host port 8000, WS 38000)
- **Portal**: https://portal-fleetvibe.digitalvibe.rs (host port 3000)
- **DB**: MySQL on host port 33060, host-mounted at `./docker/database/mysql`
- Mail via Mailgun (prod credentials, same as prod env per project policy).
- Secrets in `/opt/fleetvibe/.env` (owner `deploy`, mode 600).

### Prod (Hetzner, `/opt/fleetvibe-prod`)
- **Console**: https://console.flybox.rs (host port 4201)
- **API**: https://api.flybox.rs (host port 8001, WS 38001)
- **Portal**: https://flybox.rs and www.flybox.rs (host port 3001)
- **DB**: MySQL on host port 33061, named volume `fleetvibe-prod-mysql`
- Mail via Mailgun.
- Secrets in `/opt/fleetvibe-prod/.env` (owner `deploy`, mode 600).

Both dev and prod stacks coexist on the same Hetzner host (46.225.99.48) using different host port offsets. Nginx vhosts route each public domain to the correct port set.

## Local Development Quick Start

```bash
git clone https://github.com/digitalvibers-cmd/fleet-vibe.git
cd fleet-vibe
./scripts/local-setup.sh   # creates .env, builds, starts the stack
# stack is up at localhost:4200 / :8000 / :3000

make local-logs    # tail logs
make local-shell   # bash in application container
make local-down    # stop
```

The setup script auto-generates `APP_KEY` and `COOKIE_SECRET`. `MAILGUN_SECRET` defaults to a placeholder — local mail is routed to `laravel.log` anyway. `GOOGLE_MAPS_API_KEY` defaults to the prod key per project policy.

## Configuration Files & Overlays

| File | Tracked | Purpose |
|------|---------|---------|
| `docker-compose.yml` | yes | Base service definitions, no env-specific values |
| `docker-compose.local.yml` | yes | Local overlay (localhost, mail to log) |
| `docker-compose.dev.yml` | yes | Dev server overlay |
| `docker-compose.prod.yml` | yes | Prod server overlay |
| `docker-compose.override.yml` | **no** (gitignored) | Legacy — do not recreate. If present on a server, the setup script removes it. |
| `.env` | **no** (gitignored) | Per-environment secrets. Copy from `.env.{local,dev,prod}.example`. |
| `console/fleetbase.config.{local,dev,prod}.json` | yes | Runtime config mounted by each overlay |
| `console/fleetbase.config.json` | **no** (gitignored) | Legacy — overlays mount the env-specific file directly |
| `customer-portal/.env.{development,production}` | yes | Next.js build-time fallback (overridden by docker build args) |
| `customer-portal/.env.local` | **no** (gitignored) | Local-only override for `npm run dev` |

The deploy scripts on each server (`/usr/local/bin/fleetvibe-deploy-{dev,prod,portal}`) always invoke `docker compose -f docker-compose.yml -f docker-compose.<env>.yml` explicitly, never relying on overlay auto-loading.

## Infrastructure

- **Hosting**: Hetzner Cloud, Falkenstein datacenter (Germany, EU)
- **Server**: CPX31 — 4 vCPU (shared AMD), 8 GB RAM, 160 GB NVMe SSD
- **OS**: Ubuntu 22.04 LTS
- **Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Backups**: Hetzner Automated Backups + MySQL dump cron (every 6h)
- **Monitoring**: Sentry (error tracking) + UptimeRobot (uptime) + Hetzner alerts

## Customer Portal

A separate custom frontend application (`customer-portal/`) where FlyBox Delivery's clients can:
- Log in with their own credentials
- Create new delivery requests
- View list of their previous orders (ONLY their own — data isolation by customer_id)
- Track delivery status

The portal communicates with the Fleetbase API layer. Data isolation is critical — a client must never see another client's orders.

### Customer Portal PWA

The portal is installable as a PWA:
- **Manifest**: `customer-portal/public/manifest.json` — FlyBox branding, `start_url: /dashboard`, `display: standalone`
- **Service worker**: `customer-portal/public/sw.js` — cache-first for `_next/static/*`, network-only for HTML/API (no offline mode)
- **Install CTA**: `components/PwaInstallBanner.tsx`, rendered inside `Header.tsx` so it appears ONLY on authenticated pages (never on `/login`). Respects `display-mode: standalone` and `localStorage["pwa-install-dismissed"]`.
- **Event capture**: `lib/pwa.ts` module-level store + `components/PwaProvider.tsx` (mounted in root layout) captures `beforeinstallprompt` before React hydrates.
- **Middleware**: `sw.js`, `manifest.json`, and `icons/` are excluded from the auth middleware matcher in `middleware.ts`.

iOS Safari does not fire `beforeinstallprompt`, so the CTA never appears there — iOS users install via the Safari "Add to Home Screen" menu.

## Custom Extensions

LogiVibe builds proprietary Fleetbase extensions to add functionality without modifying core:
- **logivibe-analytics** — Ember Engine for KPI dashboards, operational reports, driver scoring
- Extensions follow the Fleetbase pattern: Ember Engine (frontend) + Laravel package (backend)
- Use `fleetbase extension:make` CLI to scaffold new extensions
- Keep core Fleetbase modifications to an absolute minimum to allow upstream updates

## Deployment Gotchas

### Permissions seed on fresh environments
After spinning up a fresh stack (new MySQL volume), the Fleetbase ACL tables (`permissions`, `policies`, `model_has_*`, `directives`) are EMPTY. The migrations only create the tables. Without the seed:
- customer-type users get HTTP 401 `User is not authorized to list order` from `/int/v1/orders` even though login succeeds — bug surfaces as "login refreshes page" in the customer portal.
- After running `fleetbase:create-permissions`, the 401 goes away BUT customers see ALL orders (no filter) until you also reset the Spatie permission cache AND reload Octane workers — they hold stale class state from before the seed.

Full first-time sequence (also wired into `scripts/setup-{dev,prod}-server.sh`):
```bash
docker compose ... exec application php artisan migrate --force
docker compose ... exec application php artisan fleetbase:create-permissions
docker compose ... exec application php artisan fleetbase:assign-admin-roles
docker compose ... exec application php artisan fleetops:assign-customer-roles
docker compose ... exec application php artisan permission:cache-reset
docker compose ... restart application queue scheduler    # Octane reload
```
All commands are idempotent — safe to re-run if a role/policy was deleted, but `restart` will cause ~5s of API downtime, so don't loop it in CI.

### PHP changes
`fleetvibe-deploy-dev` and `fleetvibe-deploy-prod` rebuild and restart the `application` container as part of every deploy (see `scripts/deploy-dev.sh` / `scripts/deploy-prod.sh`), so PHP changes in `packages/fleetops/server/` and the rest of the API are picked up automatically. If you make a manual edit on the server, restart manually:
```bash
docker compose -f docker-compose.yml -f docker-compose.<env>.yml restart application queue
```

### httpd (nginx) keširani upstream IP nakon application restart-a

**Simptom**: API vraća `502 Bad Gateway` na svim endpoint-ima (`localhost:8000`, `apifleetvibe.digitalvibe.rs`, `api.flybox.rs`). Browser console pokazuje "Network request failed" + CORS error (jer 502 odgovori ne nose CORS headere). Login na console / portal-u izgleda da je pukao, ali API je zapravo prosto nedostupan kroz nginx.

**Uzrok**: nginx u `httpd` kontejneru rezolvuje hostname `application` u Docker bridge IP **samo jednom pri pokretanju** i čuva tu vrednost zauvek. Kad se `application` kontejner restartuje (npr. tokom deploy-a, ručnim `restart application`, ili OOM-killom), dobija novi IP iz Docker DHCP pool-a. nginx i dalje šalje upstream na stari IP → "connection refused" → 502.

**Detekcija**:
```bash
docker exec fleetvibe-httpd-1 tail -20 /var/log/nginx/error_log
# Tražiš: "connect() failed (111: Connection refused) while connecting to upstream"
#         "upstream: http://172.18.0.X:8000/..."
# Zatim uporedi sa stvarnim IP-em:
docker exec fleetvibe-httpd-1 getent hosts application
# Ako se 172.18.0.X iz greške NE poklapa sa rezultatom getent — to je taj bug.
```

**Fix** (3s downtime na API-ju):
```bash
cd /opt/fleetvibe        # ili /opt/fleetvibe-prod
docker compose -f docker-compose.yml -f docker-compose.<env>.yml restart httpd
```

**Trajno rešenje (implementirano)**: `docker/httpd/vhost.conf` koristi Docker embedded DNS resolver i variable upstream tako da nginx re-rezolvuje hostname pri svakom cache miss-u:
```nginx
resolver 127.0.0.11 valid=10s ipv6=off;
set $upstream_app http://${NGINX_APPLICATION_HOSTNAME}:8000;
proxy_pass $upstream_app;
```
Pored toga, `scripts/deploy-{dev,prod}.sh` sada rebuild-uju i `force-recreate`-uju `httpd` zajedno sa `application` u svakom deploy-u, tako da config promene i IP promene uvek ostaju u sinhronizaciji. Ako menjaš `vhost.conf`, samo push na dev/main — deploy skripta će automatski rebuild-ovati httpd image i restart-ovati ga.

### Customer Portal deploy
The portal has its own workflows (`deploy-portal-dev.yml` / `deploy-portal-prod.yml`), triggered when files in `customer-portal/**` change. Both invoke the shared `/usr/local/bin/fleetvibe-deploy-portal` script with `dev` or `prod` as argument — that script picks the right overlay. Build-time `NEXT_PUBLIC_*` vars come from the `docker-compose.<env>.yml` overlay's `build.args`, sourced from `${VAR}` interpolation against the server's `.env` file.

### Internal API route prefix
Fleetbase internal routes use the `/int/v1/` prefix. The `fleetbaseRoutes('orders', ...)` macro inside the `v1` group registers at `/int/v1/orders/`, **not** `/int/v1/fleet-ops/orders/`. The customer portal's `fleetbaseApi("orders", ...)` correctly maps to `/int/v1/orders`. Do not add `fleet-ops/` prefix when calling internal order routes from the portal.

### NotificationRegistry and portal (customer) auth tokens
`NotificationRegistry::notify()` calls `Setting::lookupCompany('notification_settings')` which reads `session('company')`. Portal requests authenticate with customer contact tokens — these do **not** populate `session('company')`, so the registry finds no notifiables and silently sends nothing. When calling `NotificationRegistry::notify()` in a context that may be triggered by a portal request (observer, controller endpoint), inject the company from the model first:
```php
if ($order->company_uuid && session()->missing('company')) {
    session(['company' => $order->company_uuid]);
}
```

### SSH Access to Server

Two SSH users on `46.225.99.48`:

| User | Key | When to use |
|------|-----|-------------|
| `root` | `~/.ssh/id_ed25519` (local machine) | Direct admin/debug access from dev machine |
| `deploy` | `HETZNER_DEPLOY_SSH_KEY` (GitHub Actions secret) | CI/CD automated deploys only |

```bash
ssh root@46.225.99.48          # local admin access
ssh deploy@46.225.99.48        # only works from GitHub Actions (different key)
```

The `deploy` user is **not** accessible from the local machine — only through GitHub Actions. For manual intervention (container restarts, migration runs, debugging), always use `root`.

### Dev and prod stacks on the same server

Both dev (`/opt/fleetvibe`) and prod (`/opt/fleetvibe-prod`) run on the same Hetzner server (46.225.99.48) using different port offsets. Host port bindings live in the env-specific overlay files, NOT in `docker-compose.yml` (base has no port bindings to avoid merge conflicts):

| Service | Dev port | Prod port |
|---------|----------|-----------|
| console | 4200 | 4201 |
| httpd (API) | 8000 | 8001 |
| socket | 38000 | 38001 |
| database | 33060 | 33061 |
| customer-portal | 3000 | 3001 |

Each stack is managed via its overlay:
```bash
# On dev server
docker compose -f docker-compose.yml -f docker-compose.dev.yml <command>
# or simply: make dev / make dev-down / make dev-logs

# On prod server
docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>
# or simply: make prod / make prod-down / make prod-logs
```
Never run `docker compose <command>` without `-f` flags on a server — there is no auto-loaded `docker-compose.override.yml` anymore.

### MySQL databases for prod

On first setup, MySQL only creates `fleetbase`. The Storefront and Sandbox extensions need additional databases. Create them once manually:
```bash
docker exec fleetvibe-prod-database-1 mysql -uroot -p<PROD_DB_PASSWORD> -e '
CREATE DATABASE IF NOT EXISTS fleetbase_storefront;
CREATE DATABASE IF NOT EXISTS fleetbase_sandbox;
'
```

### Bulk notification pattern (X-Skip-Order-Notification)
To suppress individual `OrderCreated` emails during bulk import and send one summary instead:
- Portal sends `headers: { 'X-Skip-Order-Notification': '1' }` on each order POST
- `OrderController::createRecord()` sets `app()->instance('fleetops.skip_order_notification', true)` before `createRecordFromRequest()`, clears it in `finally`
- `OrderObserver::created()` checks `app()->bound('fleetops.skip_order_notification')` and returns early
- After the loop, portal calls `POST /int/v1/orders/notify-bulk-created` with `{ order_ids: [...public_ids], count: N }` — use `o.public_id`, not `o.id` (the API response field `id` may be undefined)
- `OrderController::notifyBulkCreated()` resolves notifiables from `OrderCreated` settings (already configured in UI) and sends `OrdersBulkCreated` to them

## Development Guidelines

1. **Minimize core changes**: Prefer extensions over modifying `packages/` submodules. If a core change is unavoidable, document it clearly.
2. **Configuration via UI**: User roles, permissions, order statuses, places, and vehicles are managed through the Fleetbase console UI — do not create seeders for these.
3. **User creation**: Done at the end of each phase, manually through UI.
4. **Test on dev first**: Always deploy and verify on `fleetvibe.digitalvibe.rs` before merging to `main`.
5. **Docker parity**: Local dev and server both use Docker Compose. Production uses `docker-compose.prod.yml` as override.
