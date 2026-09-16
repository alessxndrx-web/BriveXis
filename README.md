# BriveXis

Marketing site for BriveXis — custom business software built around real operations.

React 19 + TypeScript + Vite + Tailwind v4 on the front end, with a small
Express server that serves the build and receives project inquiries.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Install

```bash
npm install
cp .env.example .env   # then fill in the values you need
```

## Development

```bash
npm run dev          # Vite dev server on http://localhost:3000
npm run dev:server   # Express API on http://localhost:8080 (only needed to test the form)
```

The Vite dev server does not proxy `/api`. To exercise the contact endpoint in
development, run `npm run build` once, then `npm start`, and use port 8080.

## Build

```bash
npm run lint    # tsc --noEmit
npm run test    # vitest run — contractor domain logic
npm run build   # vite build -> dist/, then esbuild -> server.js
npm start       # node server.js
```

`npm start` serves `dist/` and mounts `POST /api/contact`. Any non-API path
falls back to `index.html`, which is what makes `/privacy` work on a refresh.

## Environment variables

| Variable | Side | Required | Purpose |
| --- | --- | --- | --- |
| `PORT` | server | no | Listen port. Defaults to `8080`. |
| `RESEND_API_KEY` | server | yes¹ | Resend API key used to deliver inquiries. |
| `CONTACT_RECIPIENT_EMAIL` | server | yes¹ | Inbox that receives inquiries. |
| `CONTACT_FROM_EMAIL` | server | yes¹ | Verified Resend sender address. |
| `CONTACT_RATE_LIMIT` | server | no | Submissions per IP per window. Defaults to `5`. |
| `CONTACT_RATE_WINDOW_MS` | server | no | Window length in ms. Defaults to one hour. |
| `VITE_SITE_URL` | client | no | Canonical origin for canonical tags, OG URLs and JSON-LD. |
| `VITE_CONTACT_ENDPOINT` | client | no | Overrides the inquiry endpoint. Empty = same-origin `/api/contact`. |
| `VITE_CONTACT_EMAIL` | client | no | Public email. Rendered only when set. |
| `VITE_CONTACT_PHONE` | client | no | Public phone. Used in structured data only when set. |
| `VITE_LINKEDIN_URL` | client | no | LinkedIn profile. Added to structured data only when set. |

¹ Required together. While any one is missing, `POST /api/contact` returns
`503` and the form tells the visitor the inbox is unavailable — it never
reports a false success.

`VITE_*` variables are inlined into the client bundle at build time and are
therefore public. Secrets belong only in the server-side variables.

## Contact backend setup

1. Create a Resend account and verify the sending domain.
2. Create an API key and set `RESEND_API_KEY`.
3. Set `CONTACT_RECIPIENT_EMAIL` and `CONTACT_FROM_EMAIL` (the sender must be
   on the verified domain).
4. Restart the server and check `GET /api/health` — it reports
   `contactEmail: "configured"` once delivery is available.

Protections on the endpoint: 32 kB body limit, per-field length limits, full
server-side revalidation, a honeypot field, and a per-IP fixed-window rate
limiter. The limiter keeps its state in process memory, so it only applies per
instance; move it to a shared store before scaling horizontally.

To use a different email provider, add an `EmailProvider` in `server/email.ts`
and select it in `createEmailConfig`. Nothing else needs to change.

## Deployment

Any host that runs Node works: build, then run `npm start` with the server
variables set.

- Serve behind HTTPS. The app trusts one proxy hop (`trust proxy`, 1) so the
  rate limiter sees the real client IP from `X-Forwarded-For`.
- `dist/` assets are hashed and served with a one-year cache; `index.html` is
  always revalidated, so a deploy is picked up on the next request.
- Set `VITE_SITE_URL` at **build** time — it is baked into the bundle.
- `public/robots.txt` and `public/sitemap.xml` contain the production domain.
  Update both if the domain changes.

## Open Graph image

`public/og-image.png` (1200×630) is generated from `scripts/og-image.svg`.
The PNG is committed, so regeneration is only needed when the source changes:

```bash
npm install --no-save sharp
npm run build:og
```

## Contractor Operations demo

A working field-service operations product at
`/demos/contractor-operations`, covering the full lifecycle: lead → estimate →
accepted → job → schedule → crew → field records → completion → invoice →
payment → follow-up.

It is lazy-loaded, so it does not affect the marketing site's bundle. Deep
links to any module or record work, including on a hard refresh (the Express
SPA fallback serves them).

**Data and persistence.** The workspace is seeded from `contractor.seed.ts`
with a fictional company, Northline Contracting. Everything is stored in the
visitor's own browser under `contractorDemo:v1` — nothing reaches a server,
nothing is shared between visitors, and no demo data is ever sent to the
contact backend or to analytics. Seed dates are relative to today, so the
workspace never looks stale.

**Reset.** *Reset demo* in the top bar or in Settings asks for confirmation,
restores the seed and returns to the overview. If stored data is ever corrupt
or from an older schema version, it is discarded and re-seeded automatically,
with a notice — the app does not crash on bad storage.

**Architecture.**

```
src/demos/contractor/
  contractor.types.ts      Domain model. Money in whole cents, dates as ISO strings
  contractor.seed.ts       Seed workspace, relative to a supplied `today`
  contractor.storage.ts    Repository boundary + localStorage implementation
  contractor.reducer.ts    Every write; keeps connected records in sync
  contractor.selectors.ts  Every derived read: totals, balances, dashboards, reports
  contractor.routes.ts     Route table and path builders
  contractor.utils.ts      U.S. formatting, money and date helpers
  ContractorProvider.tsx   Context: reducer + persistence + toasts + demo role
  ContractorApp.tsx        Shell and route resolution
  components/ pages/ forms/ Application UI
```

Two rules hold throughout: nothing that can be derived is stored (an invoice
has no balance field — `invoiceBalance` computes it), and screens never touch
storage directly.

**Replacing the backend later.** Components depend on `ContractorRepository`,
not on `localStorage`. To move onto a real API, add an implementation of that
interface in `contractor.storage.ts` and pass it to `ContractorProvider`. The
reducer, the selectors and every screen stay as they are.

**Testing.** `npm run test` covers the domain: money arithmetic and rounding,
seed integrity, estimate → job conversion rules, invoice balance, partial and
full payments, overpayment clamping, dashboard selectors, search, reset and
storage recovery. The browser workflow is covered by `e2e/contractor/`.

## Dealer Operations demo

A working dealership operations product at `/demos/dealer-operations`, covering
the full lifecycle: lead → vehicle interest → customer → reservation → deposit →
deal → documents → financing → payment → close → delivery → post-sale follow-up.

It is lazy-loaded as its own bundle, so opening it does not download the
contractor demo and the marketing home page downloads neither.

**The rule that holds it together.** A vehicle can only be promised to one
customer, so availability is never stored as a flag — it is derived from the
records that constrain it (`checkVehicleAvailability`). A confirmed reservation
holds a vehicle, a committed deal supersedes it, a closed deal sells it, and
cancelling any of them hands the vehicle back. The reducer recomputes
`Vehicle.status` after every one of those, which is what stops the same car
being sold twice.

**Financing is a tracker, not a lender.** The financing module records where an
application has got to and what a person wrote down about the outcome. It does
not assess credit, produce a score, contact a lender, or approve or decline
anything, and it never collects a Social Security number, bank credentials, a
driver licence number or account details. Every financing screen says so.

**Payments are records.** Nothing is charged and no card details are collected
anywhere in the demo.

**Data and persistence.** Seeded from `dealer.seed.ts` with a fictional
dealership, Summit Auto & Motors, stored in the visitor's own browser under
`dealerDemo:v1`. Reset, corruption recovery and schema versioning work exactly
as they do in the contractor demo.

**Architecture.** The same shape as the contractor demo — `dealer.types.ts`,
`dealer.seed.ts`, `dealer.storage.ts`, `dealer.reducer.ts`,
`dealer.selectors.ts`, `dealer.routes.ts`, `dealer.utils.ts`, a provider and a
root, with `components/ pages/ forms/` above them.

## Shared demo foundations

Both demos are built on `src/demos/shared/`:

```
src/demos/shared/
  types.ts        Money in whole cents, dates as ISO strings, Address, Bucket
  format.ts       U.S. money, date, phone and address formatting; id and code helpers
  storage.ts      Versioned repository boundary + localStorage and in-memory implementations
  ui/             Buttons, panels, dialogs, data table, charts, toasts, form controls
```

Each demo keeps what is genuinely its own: its domain model, its reducer, its
selectors and its document numbering. Nothing domain-specific was pushed into
the shared layer to make it look reusable.

## Browser tests

`e2e/` holds a permanent Puppeteer suite that runs against the real production
build served by the real Express server, so what it exercises is what gets
deployed — including the SPA fallback that makes a nested route survive a
refresh.

```
e2e/
  helpers/     browser, chrome discovery, navigation, forms, viewports,
               overflow, accessibility, console capture, screenshots, storage
  setup/       starts the server, waits for /api/health, shuts it down
  home/ contractor/ dealer/
```

- `npm run test:e2e` — everything (builds first)
- `npm run test:e2e:home` / `:contractor` / `:dealer` / `:distribution` — one suite
- `npm run e2e` — skips the build, for iterating
- `npm run test:all` — lint, unit tests, then the browser suite

Chrome is found automatically on Windows, macOS and Linux; set `CHROME_PATH` to
override. Every test fails on an unexpected `console.error`, page error, failed
request or unhandled rejection — the only ignored messages are listed, with
their reason, in `e2e/helpers/console.ts`.

Screenshots are off by default. `E2E_SCREENSHOTS=1` writes them to
`test-results/screenshots/`, which is git-ignored: they are an inspection aid,
not a committed baseline.

## Adding a demo page

The home page reads every demo from the catalogue:

- `/demos/contractor-operations` — live
- `/demos/dealer-operations` — live
- `/demos/distribution-operations` — live

To ship one:

1. Build the application under `src/demos/<name>/`.
2. Add its base path to the demo branch in `src/App.tsx`, lazy-loaded.
3. In `src/data/demos.ts`, set that demo's `status` to `'live'` and point
   `thumbnail` at a real screenshot of the running application.
4. Add the new URL to `public/sitemap.xml`.

The Demos section then swaps "Preview coming soon" for a working **Launch
Demo** action pointing at `route` — the Home component needs no changes.

## Project structure

```
server/            Express app: inquiry endpoint, email provider, rate limiter
src/components/    Section components; ui/ primitives, visuals/ product mockups
src/config/        site.ts — brand, navigation, routes, public contact details
src/data/          demos.ts, faq.ts — content catalogues
src/lib/           router, seo, analytics, motion tokens, inquiry contract
src/pages/         Home, Privacy, NotFound
src/demos/         Product demos, lazy-loaded (contractor/, dealer/, distribution/, shared/)
e2e/               Permanent browser tests (Puppeteer + Vitest)
scripts/           Open Graph image source and generator
```
