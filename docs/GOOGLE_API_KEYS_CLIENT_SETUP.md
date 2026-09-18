# Google Maps API ključevi — uputstvo za klijenta

Dokument ima dva dela:

- **Deo 1 (str. „Uputstvo za klijenta")** — pošalje se klijentu. Objašnjava šta da
  kreira, korak po korak.
- **Deo 2 (str. „Interno")** — ostaje kod nas. Šta radimo kad dobijemo ključeve.

---

# DEO 1 — Uputstvo za klijenta

## Zašto ovo radimo

Aplikacija (FlyBox / FleetVibe — kontrolni panel, korisnički portal i backend)
koristi Google Maps servise za: mapu, pretragu i autodopunu adresa (pickup /
dropoff) i za pretvaranje adrese u koordinate. Do sada su korišćeni **agencijski**
Google ključevi, pa su i troškovi išli preko agencijskog naloga.

Prelazimo na **vaše (klijentske) ključeve**, tako da:

- Google nalog, projekat i naplata glase na vašu firmu,
- vi imate punu kontrolu i uvid u potrošnju,
- ključevi ostaju vaši i ako se saradnja sa agencijom promeni.

Potrebno je da kreirate **dva API ključa u jednom Google Cloud projektu**.
Ceo posao traje oko 20–30 minuta.

---

## Preduslovi (pre početka)

1. **Google nalog firme** — idealno nalog na vašem domenu (npr.
   `it@vasafirma.rs`), **ne privatni Gmail nalog zaposlenog**. Ako nalog jednog
   dana ostane bez vlasnika, gubi se i pristup projektu.
2. **Platna kartica firme** — Google Maps Platform zahteva aktiviran Billing
   (naplatu) čak i kada je potrošnja u okviru besplatnog mesečnog limita. Kartica
   se ne zadužuje dok se limit ne prekorači, ali mora biti uneta — bez nje svi
   pozivi ka mapama vraćaju grešku.
3. **Oko 30 minuta vremena** i pristup računaru (ne radi se lako sa telefona).

> **Napomena o ceni:** Google za Maps Platform daje određenu količinu besplatnih
> poziva mesečno po svakom servisu, a preko toga se naplaćuje po pozivu. Za obim
> saobraćaja kakav aplikacija trenutno ima, očekujemo da se potrošnja kreće u
> besplatnom ili vrlo niskom opsegu, ali to zavisi od broja porudžbina. Aktuelne
> cene i besplatne limite proverite na
> <https://mapsplatform.google.com/pricing/>. U koraku 7 podešavamo budžetski
> alarm i dnevne kvote da ne može doći do neprijatnog iznenađenja.

---

## Korak 1 — Otvorite Google Cloud Console

1. Idite na <https://console.cloud.google.com>
2. Prijavite se **nalogom firme** iz preduslova.
3. Ako je ovo prvi ulazak, prihvatite uslove korišćenja.

## Korak 2 — Napravite novi projekat

1. U gornjem levom uglu, pored „Google Cloud" logotipa, kliknite na padajući
   izbornik projekata.
2. Kliknite **New Project** (Novi projekat).
3. Popunite:
   - **Project name:** `FlyBox Maps` (ili naziv po vašem izboru)
   - **Organization / Location:** ostavite predloženo
4. Kliknite **Create** i sačekajte 10-ak sekundi.
5. Kada se projekat napravi, **obavezno ga izaberite** u istom padajućem
   izborniku — sve dalje radimo unutar njega.

> Zapišite **Project ID** (piše ispod imena projekta, npr. `flybox-maps-472913`) —
> treba nam kasnije.

## Korak 3 — Uključite naplatu (Billing)

1. U levom meniju (☰) idite na **Billing**.
2. Kliknite **Link a billing account** → **Create billing account**.
3. Unesite podatke firme (naziv, adresa, PIB) i podatke platne kartice.
4. Kada je nalog kreiran, povežite ga sa projektom `FlyBox Maps`
   (**Billing → Link a billing account → izaberite kreirani nalog**).

Provera: na stranici **Billing** pored projekta treba da piše da je naplata
aktivna.

## Korak 4 — Uključite potrebne servise (API-je)

U levom meniju idite na **APIs & Services → Library**, pa jedan po jedan
pronađite sledeće servise i na svakom kliknite **Enable**:

| Servis | Čemu služi u aplikaciji | Obavezan |
|---|---|---|
| **Maps JavaScript API** | Prikaz mape u panelu i portalu | Da |
| **Places API** | Autodopuna adresa dok korisnik kuca (pickup / dropoff) | Da |
| **Places API (New)** | Novija verzija istog servisa — uključite i nju | Da |
| **Geocoding API** | Pretvaranje adrese u koordinate na serveru | Da |
| **Distance Matrix API** | Proračun kilometraže i vremena vožnje | Opciono* |

\* Trenutno se kilometraža računa bez Google servisa, pa **Distance Matrix API
nije neophodan**. Uključite ga samo ako vam kažemo da prelazimo na Google obračun
rute.

> **Ako u pretrazi ne možete da nađete „Places API" ili „Distance Matrix API"** —
> to znači da Google za novokreirane projekte više ne nudi te starije verzije.
> Nije problem: uključite ono što možete (**Places API (New)**), i **javite nam** —
> mi ćemo prilagoditi aplikaciju novoj verziji servisa.

## Korak 5 — Napravite KLJUČ 1 (za sajt / pretraživač)

Ovaj ključ koristi kontrolni panel i korisnički portal u pretraživaču.

1. **APIs & Services → Credentials → Create credentials → API key**
2. Ključ će biti kreiran i prikazan — kliknite **Edit API key** (ili ikonicu
   olovke) da ga odmah zaštitite.
3. **Name:** `FlyBox Browser Key`
4. **Application restrictions:** izaberite **Websites**
5. Pod **Website restrictions → Add**, dodajte **tačno ove stavke**:

   ```
   https://flybox.rs/*
   https://www.flybox.rs/*
   https://console.flybox.rs/*
   https://fleetvibe.digitalvibe.rs/*
   https://portal-fleetvibe.digitalvibe.rs/*
   ```

6. **API restrictions:** izaberite **Restrict key** i u listi čekirajte samo:
   - Maps JavaScript API
   - Places API
   - Places API (New)
7. Kliknite **Save**.

> Ovaj ključ je po prirodi vidljiv u kodu sajta (tako radi svaka Google mapa na
> internetu) — zato ga štiti lista domena iznad: sa bilo kog drugog sajta ključ
> ne radi.

## Korak 6 — Napravite KLJUČ 2 (za server)

Ovaj ključ koristi samo naš server, nikada pretraživač.

1. **APIs & Services → Credentials → Create credentials → API key**
2. Kliknite **Edit API key**.
3. **Name:** `FlyBox Server Key`
4. **Application restrictions:** izaberite **IP addresses**
5. Pod **Accept requests from these server IP addresses → Add**, unesite IP
   adresu našeg servera:

   ```
   46.225.99.48
   ```

6. **API restrictions:** **Restrict key** → čekirajte samo:
   - Geocoding API
   - (Distance Matrix API — samo ako ste ga uključili u koraku 4)
7. Kliknite **Save**.

## Korak 7 — Zaštita od neočekivanog troška (preporučeno)

**Budžetski alarm:**

1. **Billing → Budgets & alerts → Create budget**
2. **Amount:** npr. `50 EUR` mesečno
3. **Actions:** ostavite obaveštenja na 50%, 90% i 100% — stižu vam mejlom.

**Dnevne kvote po servisu:**

1. **APIs & Services → [izaberite servis] → Quotas & System Limits**
2. Za „Requests per day" postavite razuman dnevni limit (npr. 5.000).
   Ako aplikacija ikada „poludi" ili ključ procuri, potrošnja staje na tom limitu.

## Korak 8 — Pošaljite nam ključeve (bezbedno)

Treba nam:

| Podatak | Gde se nalazi |
|---|---|
| Vrednost **FlyBox Browser Key** | APIs & Services → Credentials |
| Vrednost **FlyBox Server Key** | APIs & Services → Credentials |
| **Project ID** | početna strana projekta |
| Potvrda da je Billing aktivan | Billing |

**Molimo da ključeve NE šaljete običnim mejlom ni u Viber/WhatsApp poruci.**
Predlažemo jedan od ovih načina:

- deljeni link iz menadžera lozinki (1Password, Bitwarden, Keeper) sa rokom
  isteka, ili
- <https://onetimesecret.com> — link koji se može otvoriti samo jednom, ili
- pozovite nas telefonom i pročitajte ključeve.

## Korak 9 — Opciono: dajte nam uvid u projekat

Ako želite da možemo sami da dijagnostikujemo probleme sa mapama (bez prava da
menjamo naplatu):

1. **IAM & Admin → IAM → Grant access**
2. Dodajte mejl adresu koju ćemo vam dostaviti, sa ulogom **Viewer**.

Ovo nije obavezno — samo ubrzava podršku.

---

## Česta pitanja

**Da li moram da imam karticu ako je potrošnja mala?**
Da. Google zahteva aktivan Billing nalog za Maps Platform bez obzira na obim.

**Šta ako neko ukrade ključ?**
Ograničenja iz koraka 5 i 6 (domeni, odnosno IP adresa servera) čine ključ
neupotrebljivim van naše aplikacije. Uz to, ključ se u svakom trenutku može
obrisati i zameniti novim iz **Credentials** ekrana.

**Mogu li kasnije da promenim ključeve?**
Možete, samo nas obavestite — potrebno je da ih ubacimo u aplikaciju i ponovo je
pustimo u rad (traje par minuta).

---

# DEO 2 — Interno (ne šalje se klijentu)

## Šta se gde koristi

| Promenljiva | Tip ključa | Koristi | Google servisi |
|---|---|---|---|
| `GOOGLE_MAPS_BROWSER_KEY` | browser (HTTP referrer) | console (Ember, preko `window.__GOOGLE_MAPS_API_KEY__`), customer-portal (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) | Maps JavaScript API, Places (`libraries=places`, `places.Autocomplete`, `maps.Geocoder` u pretraživaču) |
| `GOOGLE_MAPS_API_KEY` | server (IP restricted) | api (Laravel): `Support\Geocoding`, `config/geocoder.php`, `Support\Utils::getDistanceMatrixFromGoogle` | Geocoding API (+ Distance Matrix, trenutno neaktivno) |

`DISTANCE_MATRIX_PROVIDER` nije postavljen ni u jednom overlay-u, pa
`config('fleetops.distance_matrix.provider')` pada na default `calculate`
(haversine) — Distance Matrix API se trenutno **ne poziva**.

## Cutover koraci kad stignu klijentski ključevi

1. Na serveru (`46.225.99.48`) izmeniti `.env`:
   - dev: `/opt/fleetvibe/.env`
   - prod: `/opt/fleetvibe-prod/.env`

   ```
   GOOGLE_MAPS_API_KEY=<novi server key>
   GOOGLE_MAPS_BROWSER_KEY=<novi browser key>
   ```

2. **Rebuild je obavezan** — browser ključ se pri build-u ubacuje u bundle
   (`docker-compose.*.yml` → `build.args`), ne čita se u runtime-u:

   ```
   make dev-build && make dev      # dev
   make prod-build && make prod    # prod
   ```

   Backend ključ se čita u runtime-u, ali treba očistiti keš konfiguracije:
   `docker compose exec application php artisan config:clear`.

3. Provera:
   - console i portal: autodopuna adrese radi, nema `RefererNotAllowedMapError`
     ni „For development purposes only" vodenog žiga na mapi;
   - backend: `GET /int/v1/geocoder/...` vraća rezultate (vidi
     `Internal/v1/GeocoderController`);
   - u klijentskom Google Cloud projektu, **APIs & Services → Metrics**, videti
     da saobraćaj stiže na nove ključeve.

4. Tek nakon 24–48h stabilnog rada **ugasiti agencijske ključeve** (ne brisati
   odmah — prvo ih ograničiti/isključiti, pa obrisati kad je sigurno).

## Rizici koje treba pratiti

- **Legacy Places API:** kod koristi `google.maps.places.Autocomplete` (stara
  klasa), a Google za novije Cloud projekte više ne nudi legacy „Places API".
  Ako klijent ne uspe da ga uključi, potrebna je migracija na
  `PlaceAutocompleteElement` / `AutocompleteSuggestion` u
  `customer-portal/components/PlaceAutocompleteInput.tsx` i
  `packages/fleetops/addon/components/place-autocomplete-input.js`.
- **Distance Matrix API** je takođe legacy (naslednik je Routes API) — relevantno
  samo ako se ikada postavi `DISTANCE_MATRIX_PROVIDER=google`.
- Isti IP (`46.225.99.48`) služi i dev i prod stack — potvrditi da se odlazni
  saobraćaj ne NAT-uje kroz drugu adresu pre nego što se klijentu pošalje IP.
