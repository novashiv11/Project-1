# Jarvis as a doer: entitlements, providers, action drafts (plan)

Status: proposal, waiting for founder approval. No code changed.

## 1. Current architecture (Nov 2026)
- **Stack:** a phone PWA with no server. The code is plain JS:
  - `app/lifeos.html` is the shell, parser and Jarvis.
  - `app/ui/*.js` holds feature modules: records, today, cases, money*, letters, sync, and the older views.
  - `scripts/build_pwa.py` builds `dist/`, which goes to GitHub Pages. The Play Store version will wrap this same PWA as a TWA (`docs/PLAY_STORE.md`).
  - Tests: 131 (`python3 -m unittest -q`), covering unit, node, and phone end-to-end runs in headless Chromium.
- **Data:** everything stays on the phone.
  - Typed records live in localStorage `lifeos.v2`, built by `records.js`. Types: task, recurring, deadline, case, job, project, fact, journal. They still keep the old text/due/done fields, so the older screens keep working.
  - Settings are in `lifeos.settings` (name, language, "About me" `lifeContext`, my words, API key).
  - Money is AES-GCM encrypted in IndexedDB.
- **Jarvis** lives in `app/lifeos.html` and has two modes:
  - **Free mode:** `isQuestion` → `localAnswer` (keyword answers from your records). Deeper questions go to the Claude app through `askClaude`, and its LIFEOS block is pasted back.
  - **API key mode:** `askJarvis` → `callClaude` (Haiku 5.5) with tools `add_item`, `complete_item`, `remember_fact`. Voice works through the orb.
  - Either way, Jarvis today saves and answers. It never *acts*.
- **Reminders:** `pwa.js plan()` writes nudges to IndexedDB, and `sw.js` shows them through periodic sync. There is also a daily in-app nudge.
- **Static knowledge:** `lifeos/life.json` holds areas, lead times and Irish guides, and is injected at build time. The new scheme data follows the same pattern.

## 2. Direction
Jarvis becomes "ask → check → find → draft → remind". The steps that need to be **right** (eligibility, provider list, dates, email text) are deterministic and offline, so they cost €0 per use. The LLM is used only to understand free text and to explain, and only if a key exists. Notes, tasks, bills, cases and money keep working unchanged.

## 3. Changes and new modules
| What | Where | Notes |
|---|---|---|
| Profile (entered once) | `app/ui/profile.js`, stored in `settings.profile` | See the schema below. One short form; Jarvis asks for a missing field only when a scheme needs it. PPSN is never stored, and drafts are scrubbed for PPSN patterns. |
| Scheme catalogue | `lifeos/schemes.json` (single source, injected like life.json) | One entry per scheme: rules, what you get, the catch, renewal, official link, `verified` date. |
| Entitlements engine | `app/ui/entitlements.js` | Pure function `check(profile, scheme)` → `qualify / no (reason) / need {field, question}`. Node unit tests for every rule. |
| Provider finder | `lifeos/panels/*.json` + `app/ui/providers.js` | A static snapshot of the official panels: name, address, coordinates, phone, email, booking URL, panel date. Distance and walking time are computed on the phone (straight line ×1.3 at 5 km/h). Ratings come from a one-tap "Open in Google Maps" link (free) instead of a paid Places API. |
| Action drafts | `app/ui/drafts.js` | Templates, no LLM: To / Subject / Body copy blocks, plus "Open in Gmail" via a `mailto:` link with to/bcc/subject/body. Android opens Gmail or the chosen mail app. An online-booking button appears when the provider has one. If a key exists, an optional "make it warmer" rewrite runs on Haiku. |
| Reminders | reuse `records.js` + the nudge pipeline | Each claim is logged on a record. The app then creates "available again" deadlines: dental on 1 Jan, eye test +2 yrs, Bike to Work +4 yrs. A year-end nudge on 1 Nov says "free dental exam not used this year". |
| Jarvis router | `lifeos.html` (small change) | Free text like "dental check-up" is matched against scheme keywords (free) and opens the scheme card. With a key, a Haiku tool `check_entitlement(scheme_id)` lets Claude do the same from any phrasing. |
| Entitlements screen | `app/ui/benefits.js` | A list of schemes grouped by You qualify / Need info / You don't (with the reason). Each card has Find providers → Draft email → Mark booked. |

### Profile schema (`settings.profile`)
```
location: {town, county, lat, lng}        // lat/lng set once from the town or a pin; never sent anywhere
work: {status: "employee"|"self-employed"|"unemployed"|"retired", prsi_class: "A"|..., years_paying_prsi: n}
age_band: "under 21"|"21-24"|"25-65"|"66+"  // PRSI contribution rules depend on age
home: {owner: bool, mortgage_start: "YYYY-MM"|null, built_year: n|null}  // SEAI grants need the house age
car: bool, commute: {cycles: bool, public_transport: bool}
pets: [{kind, name}], employer_offers: {bike_to_work, taxsaver, pension_match_pct}
```

### Scheme rule format (`lifeos/schemes.json`)
```
{"id":"prsi-dental","name":"Free dental check-up (PRSI Treatment Benefit)","area":"health",
 "get":"Free oral exam once a year; scale & polish with a small fee","catch":"Only at panel dentists; book early in the year",
 "renews":{"every":"calendar_year"},"panel":"dental","keywords":["dentist","dental","teeth","check-up"],
 "rules":[{"field":"work.prsi_class","in":["A","B","C","D","E","H","J"],"no":"Needs class A/B/C/D/E/H/J PRSI"},
          {"field":"years_paying_prsi_ok","is":true,"ask":"Have you paid PRSI for long enough? (depends on age)"}],
 "source":"https://www.gov.ie/…","verified":"2026-11-08"}
```
- Rule results are three-valued. A missing profile field gives "need info", with that rule's question.

## 4. APIs and LLM calls (cost)
- **Eligibility, providers, distance, drafts, reminders:** no API, €0.
- **Ratings:** "Open in Maps" link, €0. A paid Places API can come later via a server, if paying users want it.
- **LLM (optional):** Haiku 5.5 at about $0.10 per M input tokens. A routed question is about 2k tokens, roughly €0.0002. Free mode keeps the Claude-app handoff.
- At €1–2/month the app needs no server for this feature. A server only becomes necessary for "Jarvis without your own key" (already on the roadmap).

## 5. MVP (build first, about one session)
1. A profile form with only the fields the MVP schemes need.
2. `schemes.json` with **PRSI dental, PRSI optical (eye test), PRSI hearing**, each verified against gov.ie / citizensinformation.ie on the day of the build.
3. Entitlements screen + engine with three-valued results and node tests.
4. Provider finder for the dental + optical panels in **one county first** (see blockers), sorted by distance, each with Call / Email / Maps / Book online buttons.
5. Email drafts: BCC up to 3 chosen clinics, copy blocks, Open in Gmail, PPSN scrubber.
6. "Mark booked" → reminders for the next eligibility date and a year-end nudge.
7. Jarvis free-text router: "dental", "eye test", "teeth cleaning" open the right card.

**Phase 2:** Med 1 (medical-expenses relief), Bike to Work, TaxSaver, pension match. **Phase 3:** SEAI grants, plus the mortgage interest credit and other "you don't qualify, here's why" checks. **Later:** all counties, and refreshing the panels from a server.

## 6. Blockers and decisions for you
1. **Panel data:** this cloud session can't reach gov.ie, citizensinformation.ie or OpenStreetMap (blocked by the network allow-list). Choose one:
   - (a) allow those hosts for this environment;
   - (b) download the official dental/optical panel list for your county and send it to me;
   - (c) I start from a small hand-checked list.

   Recommended: (a).
2. **Panel freshness:** the lists change. Each card shows the panel date, and a quarterly rebuild is a manual step for now.
3. **Exact amounts and rules** (the €15 scale & polish fee, the age-based PRSI contribution rules, the hearing-aid amounts) get checked on the official pages at build time. Nothing is hard-coded from memory.
4. **Privacy:** the repo is public. The profile, home coordinates and claims stay only on the phone; the repo holds only public scheme and panel data.

## 7. How you'll test the MVP
- Me → Profile: fill in 6–8 fields.
- Jarvis: "dental check-up" → "You qualify" card → 3 nearest dentists → tick 3 → Open in Gmail with BCC ready → Mark booked → Today shows "Dental free again from 1 Jan".
- The eye test works the same way, plus a "Book online" button where the provider has one.
