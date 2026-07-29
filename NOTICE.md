# NOTICE

**FleetVibe** is a modified version of **Fleetbase**
(https://github.com/fleetbase/fleetbase), a modular logistics and supply
chain operating system.

Fleetbase is Copyright © Fleetbase Pte. Ltd. and is licensed under the
GNU Affero General Public License v3.0 (AGPL-3.0). The full license text is
in [LICENSE.md](LICENSE.md).

## Modifications (AGPL-3.0 §5(a))

This distribution has been **modified** by DigitalVibe for FlyBox Delivery.
Modifications began in **July 2026** and are ongoing. In accordance with
AGPL-3.0 §5(a), this notice states that the original Fleetbase work has been
changed.

Principal areas of modification (see the full, per-file change log in
[CLAUDE.md](CLAUDE.md) and the commit history via `git log`):

- **Serbian localization / geocoding** — `packages/fleetops/` address handling
  (Latin ↔ Cyrillic transliteration, RS-restricted autocomplete, locale/region
  defaults).
- **RSD currency handling** — console + fleetops money-input overrides.
- **Per-user cache correctness fixes** — `LiveCacheService`, console fetch/cache
  overrides.
- **Custom-field persistence** on order-type change (`CustomFieldRelinker`).
- **Driver app QR self-assign** endpoints (`Api/v1/OrderController`).
- **Customer-portal** password reset, bulk label printing, and self-service
  features.
- **Deployment / infrastructure** — Docker Compose overlays, CI/CD workflows,
  and server setup scripts under `scripts/`, `.github/`, and `docker/`.
- A separate **customer portal** application under `customer-portal/`
  (also AGPL-3.0-or-later).

## AGPL-3.0 §13 — Network Use

Users interacting with FleetVibe over a network are offered the Corresponding
Source of this modified version at:

**https://github.com/digitalvibers-cmd/fleet-vibe**

This offer is surfaced in-app (customer portal footer and console login screen).

## Third-Party Components

Fleetbase and FleetVibe bundle numerous third-party open-source packages, each
under its own license (see `composer.lock`, `pnpm-lock.yaml`, and the individual
package `LICENSE` files under `packages/`).
