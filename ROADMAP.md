# LogiVibe — Roadmap & Progress Tracker

> **Projekat**: LogiVibe — Interni logistički sistem za FlyBox Delivery  
> **Tehnička osnova**: Fleetbase v0.7.28 (Laravel 10 + Ember.js 5.4)  
> **Infrastruktura**: Hetzner Cloud CPX31, Falkenstein DE  
> **Tim**: Product Owner (ti) + Dev/DevOps (ja)  
> **Repozitorijum**: `digitalvibers-cmd/fleet-vibe`

---

## Status Legenda

- `[ ]` — Nije započeto
- `[/]` — U toku
- `[x]` — Završeno
- `[!]` — Blokirano / Potrebna odluka
- `[-]` — Otkazano / Nije potrebno

---

## Faza 1 — Osnovni Operativni Sistem + Analitika

**Cilj**: Funkcionalan sistem za 7 korisnika + KPI dashboardi  
**Procena**: 6–8 nedelja  
**Status**: `[/]` U toku

### 1.1 Hetzner Server Deployment

- [x] Kreirati Hetzner Cloud nalog i projekat
- [x] Provisionirati CPX31 instancu (Falkenstein DC, Ubuntu 22.04)
- [x] Konfigurisati Hetzner Firewall (ports: 22, 80, 443)
- [ ] Aktivirati Automated Backups
- [x] SSH key setup + Fail2ban
- [x] Instalirati Docker + Docker Compose
- [x] UFW firewall pravila

### 1.2 DNS & Domeni

> Domeni `flyboxdelivery.rs` i `digitalvibe.rs` već postoje.
> Produkcioni DNS (`fleetvibe.flyboxdelivery.rs`) se podešava na kraju, pred go-live.
> Za razvoj koristimo samo dev poddomen.

- [x] A record: `fleetvibe.digitalvibe.rs` → Hetzner server IP
- [x] A record: `apifleetvibe.digitalvibe.rs` → Hetzner server IP
- [x] A record: `flybox.rs` → server IP (portal/customer-facing)
- [x] A record: `www.flybox.rs` → server IP
- [x] A record: `console.flybox.rs` → server IP
- [x] A record: `api.flybox.rs` → server IP

### 1.3 Reverse Proxy & SSL

- [x] Instalirati Nginx na server
- [x] Nginx config za dev (`fleetvibe.digitalvibe.rs`)
  - [x] SSL via Let's Encrypt
  - [x] Proxy pass ka Console (:4200)
- [x] Nginx config za dev API (`apifleetvibe.digitalvibe.rs`)
  - [x] SSL via Let's Encrypt
  - [x] Proxy pass ka API (:8000)
  - [x] WebSocket proxy za SocketCluster (:38000)
- [ ] _(Pred go-live)_ Nginx config za produkciju (`flybox.rs`, `console.flybox.rs`) + SSL
- [ ] _(Pred go-live)_ Nginx config za prod API (`api.flybox.rs`) + SSL

### 1.4 Docker Compose Produkcija

- [ ] Kreirati `docker-compose.prod.yml` override
- [ ] Kreirati `.env.production` sa svim env varijablama
- [ ] Volume mounts za MySQL data persistenciju
- [ ] Restart policies (`unless-stopped`) za sve servise
- [ ] Health checks za MySQL, Redis, API
- [x] Docker log rotation config
- [ ] Testirati `docker compose up -d` na serveru
- [ ] Pokrenuti migracije (`deploy.sh`)
- [ ] Verifikovati da su svi servisi zdravi

### 1.5 Backup Strategija

- [x] Kreirati `scripts/backup.sh` (MySQL dump + rotacija)
- [x] Kreirati `scripts/restore.sh` (restore procedura)
- [x] Cron job: MySQL dump svaka 6h
- [x] Rotacija: 7 dnevnih + 4 nedeljna backup-a
- [ ] Testirati restore proceduru (dry-run)
- [ ] Dokumentovati backup/restore proces

### 1.6 FleetOps Konfiguracija (kroz UI)

- [ ] Kreirati organizaciju i firmini profil
- [ ] Postaviti logo, favicon, title: "LogiVibe - FlyBox Delivery"
- [ ] Podesiti korisničke uloge: admin, dispatcher, driver
- [ ] Definisati permission matricu po roli
- [ ] Uneti vozila u sistem
- [ ] Uneti ključne lokacije (skladišta, česte adrese)

### 1.7 Navigator App Setup

- [ ] Testirati Navigator app sa produkcijskim API endpointom
- [ ] Verifikovati: prijem naloga
- [ ] Verifikovati: navigacija do destinacije
- [ ] Verifikovati: promena statusa naloga
- [ ] Verifikovati: POD (Proof of Delivery) — potpis/foto
- [ ] Verifikovati: real-time lokacija vidljiva na mapi u console-u

### 1.8 Korisnički Portal (Custom Frontend)

- [x] Odabrati tech stack → **Next.js 15 (App Router, TypeScript, Tailwind CSS)**
- [x] Inicijalizovati projekat u `customer-portal/`
- [x] Dizajn: Login stranica (FlyBox Delivery branding)
- [x] Dizajn: Dashboard — lista narudžbina sa statusima
- [x] Dizajn: Kreiranje novog delivery zahteva (pickup/dropoff forma)
- [x] Dizajn: Detalji narudžbine + praćenje statusa
- [x] Backend: Auth integracija sa Fleetbase API (BFF pattern, HttpOnly cookie)
- [x] Backend: CRUD operacije za narudžbine
- [x] Backend: **Data izolacija** — klijent vidi SAMO svoje narudžbine (CustomerOrders direktiva)
- [x] Testiranje izolacije (klijent A ne vidi narudžbine klijenta B)
- [x] Fix: Onemogućen API Model Cache (`API_CACHE_ENABLED=false`) — sprečava curenje podataka između korisnika
- [x] Google Maps Places Autocomplete za adrese (pickup/dropoff) sa GeoJSON koordinatama
- [x] Deljeni Header sa navigacijom (Dashboard, Company, New Order, Logout)
- [x] Stranica sa profilom kupca (Company — ime, ID, email, telefon)
- [x] Branding: FlyBox Delivery logo, boje
- [/] Progressive Web App (PWA) podrška
  - [x] Web App Manifest sa FlyBox brendingom
  - [x] Service Worker (cache static assets)
  - [x] PWA ikone (192x192, 512x512)
  - [x] Install CTA banner (prikazuje se samo ulogovanim korisnicima)
  - [ ] Testiranje instalacije na Android Chrome i iOS Safari
- [ ] Dockerizovati portal
- [ ] Dodati u `docker-compose.prod.yml`
- [ ] Nginx config za portal domen

### 1.9 Operativni Dashboard & KPI

- [ ] Kreirati Fleetbase Extension: `logivibe-analytics` (scaffold)
- [ ] Ember Engine setup za analytics modul
- [ ] Laravel Package za API agregacije
- [ ] Dashboard widget: Nalozi danas (kreirani/dodeljeni/u toku/završeni)
- [ ] Dashboard widget: Prosečno vreme izvršenja
- [ ] Dashboard widget: Alertovi (nalozi bez dodele > X min)
- [ ] Dashboard widget: Mapa aktivnih vozača
- [ ] KPI: Delivery completion rate (dnevni/nedeljni/mesečni)
- [ ] KPI: On-time delivery %
- [ ] KPI: Prosečno vreme po vozaču
- [ ] KPI: Broj naloga po vozaču
- [ ] KPI: Trend grafici (poređenje sa prethodnim periodom)
- [ ] Izveštaj po vozaču: nalozi, vreme, on-time %
- [ ] CSV/Excel export za izveštaje

### 1.10 CI/CD Pipeline

- [x] Kreirati `.github/workflows/deploy-prod.yml` (adaptiran za Hetzner, spreman za flybox.rs)
- [x] Kreirati `.github/workflows/deploy-dev.yml` (Hetzner SSH deploy)
- [ ] Kreirati `scripts/deploy.sh`
- [ ] Testirati: push to `main` → auto deploy na produkciju
- [x] Testirati: push to `dev` → auto deploy na dev
- [ ] Dokumentovati rollback proceduru

### 1.11 Monitoring

- [ ] Podesiti Sentry (free tier) za error tracking
- [ ] Kreirati health check endpoint: `GET /api/health`
- [ ] UptimeRobot monitoring za `fleetvibe.digitalvibe.rs` (produkcija se dodaje pred go-live)
- [ ] Hetzner Cloud alerting (CPU > 80%, disk > 85%)

### 1.12 Dokumentacija

- [ ] Uputstvo za dispečere: kreiranje naloga, dodela, praćenje
- [ ] Uputstvo za vozače: Navigator setup, prijem naloga, promene statusa
- [ ] Uputstvo za admin: upravljanje korisnicima kroz Fleetbase UI
- [ ] Deployment uputstvo: kako deployovati, backup, restore
- [ ] API endpoint referenca (korisnički portal)

### 1.13 Kreiranje Korisnika (na kraju, kroz UI)

- [ ] Admin korisnik/ci
- [ ] Dispatcher korisnici
- [ ] Driver korisnici (do 7)
- [ ] Test login za svaku rolu

### 1.14 Pilot Rad

- [ ] Izabrati pilot grupu: 3-5 vozača + 1-2 dispečera
- [ ] Obučiti pilot grupu
- [ ] Pokrenuti pilot (2 nedelje)
- [ ] Dnevno prikupljanje feedback-a
- [ ] Bug tracking tokom pilota
- [ ] Evaluacija: da li sistem zadovoljava kriterijume?

### 1.15 Notifikacije

#### Push Notifikacije (Navigator)

- [ ] Podesiti push notifikacije za Navigator app
- [ ] Vozač prima push notifikaciju kada mu Operator dodeli vožnju
- [ ] Koristiti postojeće Fleetbase mehanizme (Firebase Cloud Messaging / APN)
- [ ] Testirati primanje notifikacija na Android i iOS

#### Email (Mailgun)

- [x] Kreirati Mailgun nalog i verifikovati domen
- [x] Konfigurisati Mailgun API u Laravel env (docker-compose.override.yml)
- [x] Email za registraciju i pristup novim korisnicima (pozivnice)
- [ ] Email obaveštenje klijentima o isporučenoj pošiljci
- [ ] Email template dizajn (FlyBox Delivery branding)
- [ ] Testirati deliverability (SPF, DKIM, DMARC)

#### SMS / WhatsApp

- [ ] Istražiti SMS provajdere (Twilio, Vonage, lokalni)
- [ ] Istražiti WhatsApp Business API integraciju
- [ ] Notifikacija Operatoru pri kreiranju nove porudžbine
- [ ] Konfigurisati kanal (SMS ili WhatsApp) po preferencijama
- [ ] Testirati slanje i primanje poruka

### 1.16 Mobile Responsiveness (FleetVibe Konzola)

- [ ] Audit: identifikovati problematične ekrane na mobilnim uređajima
- [ ] Fix layout za sidebar navigaciju na mobilnim ekranima
- [ ] Responsive tabele (scroll ili card view na malom ekranu)
- [ ] Responsive forme za kreiranje/editovanje naloga
- [ ] Responsive mapa (full-width na mobilnom)
- [ ] Testiranje na iOS Safari i Android Chrome
- [ ] Fix-evi za touch interakcije (drag & drop, modali)

### ✅ Faza 1 — Go-Live Checklist

- [x] Hetzner CPX31 deployed + Docker stack running
- [x] Nginx + SSL na dev domenu (`fleetvibe.digitalvibe.rs`)
- [x] DNS: dev domeni funkcionišu
- [ ] _(Pred go-live)_ Nginx + SSL na produkciji (`flybox.rs`, `console.flybox.rs`, `api.flybox.rs`)
- [ ] FleetOps configured (org, profil, branding)
- [ ] Nalozi: create → assign → in progress → complete
- [ ] Navigator app prima naloge + push notifikacije
- [ ] Real-time lokacija na mapi
- [x] Korisnički portal: login, create delivery, lista, izolacija, Google Maps, profil kupca
- [ ] KPI dashboard sa metrikama
- [/] CI/CD pipeline radi (dev OK, prod treba adaptirati)
- [ ] Backup + restore testirani
- [ ] Monitoring aktivan
- [/] Email notifikacije (Mailgun) konfigurisane (invite radi, ostali templateovi pending)
- [ ] SMS/WhatsApp notifikacije funkcionišu
- [ ] Konzola responsive na mobilnim uređajima
- [ ] Dokumentacija za sve korisnike
- [ ] Korisnici kreirani
- [ ] Pilot grupa obučena i počela rad

---

## Faza 2 — Standardizacija Procesa

**Cilj**: Kontrola, audit trail, standardizovani workflow-ovi, Excel integracija  
**Procena**: 6–8 nedelja (nakon stabilne Faze 1)  
**Preduslov**: Faza 1 stabilno radi min. 2-4 nedelje  
**Status**: `[ ]` Nije započeto

### 2.1 Standardni Workflow-ovi

- [ ] Definisati order lifecycle pravila (validni prelazi statusa)
- [ ] Implementirati validaciju: nalog ne može preskočiti status
- [ ] Obavezna polja po tipu naloga
- [ ] Template nalozi za ponavljajuće zadatke
- [ ] Prioriteti naloga: hitan / normalan / nizak
- [ ] Max paralelnih naloga po vozaču (konfigurisano)
- [ ] Automatsko obaveštenje vozaču pri dodeli

### 2.2 Audit Log & Istorija

- [ ] Kreirati audit log tabelu u bazi
- [ ] Laravel Observer za logovanje promena statusa naloga
- [ ] Logovanje dodele/promene vozača
- [ ] Logovanje login/logout aktivnosti
- [ ] UI: Timeline view po nalogu (ko, kada, šta)
- [ ] Čuvanje audit podataka min. 12 meseci

### 2.3 Excel Integracija

- [ ] Import klijenata iz Excel-a
- [ ] Import istorijskih naloga (opciono)
- [ ] Validacija i mapiranje kolona
- [ ] Export izveštaja u Excel/CSV
- [ ] Dnevni/nedeljni summary export

### 2.4 UX Dorada

- [ ] Analiza feedback-a iz pilota
- [ ] Pojednostavljenje najčešćih akcija
- [ ] Prečice za dispečere (quick-assign, bulk actions)
- [ ] Mobile-responsive poboljšanja za tablet
- [ ] Fix-ovi za sve bug-ove iz pilota

### 2.5 Infrastruktura Review

- [ ] Analiza opterećenja CPX31 (CPU, RAM, disk)
- [ ] MySQL slow query log analiza
- [ ] Odluka: ostati na CPX31 ili upgrade na CPX41
- [ ] Ažurirati backup strategiju po potrebi

---

## Faza 3 — Optimizacija i Automatizacija

**Cilj**: Pametna dodela, integracije, napredna analitika  
**Procena**: 8–12 nedelja (nakon stabilne Faze 2)  
**Preduslov**: Faza 2 workflow-ovi usvojeni od strane tima  
**Status**: `[ ]` Nije započeto

### 3.1 Smart Dispatch (Preporučena Dodela)

- [ ] Rule engine: najbliži slobodan vozač
- [ ] Rule engine: po kapacitetu vozila
- [ ] Rule engine: round-robin raspodela
- [ ] UI: prikaz preporuke za dispečera
- [ ] Dispečer prihvata ili menja preporuku
- [ ] Auto-assignment opcija za rutinske naloge
- [ ] Override uvek moguć

### 3.2 Napredna Analitika

- [ ] Driver scorecard: on-time %, prosečno vreme, ocene
- [ ] Vehicle utilization metrike
- [ ] Heat mapa aktivnosti po zonama
- [ ] Drill-down: klik na KPI → detalji
- [ ] Mesečni performance report (auto-generisan)

### 3.3 Integracije

- [ ] Webhook pri promeni statusa → Slack/Teams/email
- [ ] Webhook pri završetku naloga → interni trigger
- [ ] Webhook management UI
- [ ] ERP/CRM konektori (po potrebi, na osnovu merljivog efekta)

### 3.4 Route Optimization (opciono)

- [ ] OSRM ili Google Maps Directions API integracija
- [ ] Optimizacija redosleda tačaka u multi-stop nalogu
- [ ] Prikaz estimated time/distance pre dispečinga
- [ ] Poređenje: pre vs. posle optimizacije

### 3.5 Infrastruktura Skaliranje

- [ ] Evaluacija: upgrade na CPX41 ili split na 2 servera
- [ ] Grafana + Prometheus monitoring (opciono)
- [ ] Napredni alerting
- [ ] Dokumentovati skaliranje procedure

---

## Mesečni Troškovi

| Stavka | Faza 1-2 | Faza 3 |
|--------|----------|--------|
| Hetzner CPX31 | €20.99 | €20.99–€35.49 |
| Automated Backups | €4.20 | €4.20–€7.10 |
| IPv4 | €0.50 | €0.50 |
| Cloudflare DNS | €0.00 | €0.00 |
| SSL (Let's Encrypt) | €0.00 | €0.00 |
| Sentry (free) | €0.00 | €0.00 |
| Google Maps API | ~€0 | ~€0–€50 |
| **UKUPNO** | **~€26/mes** | **~€26–€93/mes** |

---

## Changelog

| Datum | Promena |
|-------|---------|
| 2026-04-03 | Inicijalni roadmap kreiran na osnovu Strategy dokumenta |
| 2026-04-03 | Dev domen: `fleetvibe.digitalvibe.rs`. Prod DNS se podešava pred go-live. |
| 2026-04-03 | Server 46.225.99.48 provisioniran: UFW, Fail2ban, SSH hardening, Docker, Nginx, backup scripts |
| 2026-04-06 | Ažurirani statusi: DNS, SSL, Nginx, CI/CD dev deploy — završeni. Dodate sekcije 1.15 (Notifikacije) i 1.16 (Mobile Responsiveness). |
| 2026-04-06 | Mailgun konfigurisan za dev okruženje (mailgun driver, EU endpoint). Invite emailovi za nove korisnike rade. |
| 2026-04-15 | Korisnički portal: fix fokusa na inputu, Google Maps Places Autocomplete, deljeni Header, stranica profila kupca, FlyBox logo branding, fix data izolacije (API cache disabled). |
| 2026-04-16 | Korisnički portal PWA: manifest, service worker, ikone (192/512), install CTA banner (vidljiv samo ulogovanim korisnicima, respektuje dismiss + standalone mode). |
| 2026-04-29 | Produkcioni domeni promenjeni na flybox.rs. DNS A recordi aktivni (flybox.rs, www, console, api → 46.225.99.48). docker-compose.prod.yml, deploy-prod.yml, Nginx vhostovi i setup-prod-server.sh su spremni. |
