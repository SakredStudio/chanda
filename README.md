# Chanda Collector — App (`v1.0`)

Offline-first group-collection tracker PWA for one organizer collecting a fixed contribution or splitting a total amount across a group (festival chanda, office farewell/gift, trip, condolence, party). Shows who has paid (`✓`) and who is pending (`○`), generates a UPI QR code for collection, and nudges pending contributors on WhatsApp (`wa.me`). **It never moves money.**

## How to Run Locally

No build step, framework, or runtime CDN required. Serve `projects/chanda-collector/app/` with any static HTTP server (or from a `/chanda/` sub-path on GitHub Pages):

```bash
# Option 1: Node one-liner from repo root
node -e "const http=require('http'),fs=require('fs'),path=require('path'),root='projects/chanda-collector/app';http.createServer((req,res)=>{let u=req.url.split('?')[0].replace(/^\/chanda\//,'/');if(u==='/'||u==='')u='/index.html';const p=path.join(root,u);if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end('Not found');}const ext=path.extname(p);const m={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':m[ext]||'application/octet-stream'});fs.createReadStream(p).pipe(res);}).listen(8080,()=>console.log('http://localhost:8080'));"

# Option 2: npx serve
npx serve projects/chanda-collector/app -l 8080
```

Then open `http://localhost:8080` (or `http://localhost:8080/chanda/`) in Chrome DevTools at `360px` or `390px` mobile width.

## How to Run Tests

All pure modules (`lib/*.js`) and acceptance scenarios are tested with Node's built-in test runner (`node --test`):

```bash
node --test projects/chanda-collector/app/tests/*.test.mjs
```

## What's Done (P0 → P6)

- **P0 — Scaffold, Design Tokens, Self-Hosted Mukta, i18n, Store, Router:**
  - `fonts/`: Self-hosted `Mukta` (`400`, `500`, `600`, `700`, `800` in Devanagari, Latin, and Latin-Ext `.woff2`) + `OFL.txt` + `mukta.css`. Zero runtime Google Fonts requests.
  - `i18n/`: `en.json`, `hi.json`, `hinglish.json` with verified 1:1 key parity and Roman-only validation for Hinglish.
  - `lib/store.js`: `localStorage` key `chanda.v1` with `schemaVersion: 1`, `migrate(data)`, `collections`, `people`, `payments`, `settings`, exact snapshot `undoLastAction()`, 3-collection active free limit (`FREE_COLLECTION_LIMIT = 3`), and JSON backup export/import.
  - `lib/format.js`: Paise integer arithmetic + `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` Indian lakhi/crore grouping (`₹1,00,000`), deterministic avatar colors from the README palette.
- **P1 — Language-Pick Screen + Home List:**
  - Trilingual first-launch Language Pick screen (`English` / `हिंदी` / `Hinglish`) and persistent top-bar `A / अ / Aa` language toggle across every screen.
  - Home collections list with progress bar, `₹collected / ₹total`, `paid/total ✓` count, empty state with 1-tap sample data loader, and "Pro coming soon" sheet when the 3-collection free limit is reached.
- **P2 — 3-Step Create Collection Wizard + `lib/phone.js`:**
  - Step 1: 6 collection type tiles (`🎁`, `🪔`, `✈️`, `🕯️`, `🎉`, `➕`) + editable title.
  - Step 2: Per-person (`Har ek se`) vs Total (`Kul rakam`) mode toggle + large 3-column number pad (`₹` display with blinking caret).
  - Step 3: Android Contact Picker API (`navigator.contacts.select`) with manual entry + `+12 Sample Contacts` quick-add and optional deadline.
  - `lib/phone.js`: Normalizes 10+ Indian phone formats to `91XXXXXXXXXX` while keeping `rawPhone` and preserving non-Indian international numbers.
- **P3 — Collection Detail Screen, Mark-Paid Sheet & 5s Undo + `lib/wa.js`:**
  - `200px` `conic-gradient` progress ring with `₹collected / of ₹total` center disc and `✓ Paid` / `○ Pending` chips.
  - Person rows with status indicators (`✓` green filled circle for paid; `○` saffron open ring + WhatsApp remind circle for pending).
  - Bottom sheet to mark `💵 Cash` or `📱 Online` (or revert to pending), triggering the `pop` animation and a 5-second Undo toast that restores exact previous state including timestamps.
- **P4 — Share / Nudge Screen, "Next Pending" Flow, UPI QR + `lib/upi.js`:**
  - WhatsApp message preview bubble (`#DCF8C6`) ending with the mandatory growth-loop footer `— sent with Chanda · https://chanda.sakredstudio.ca` (`APP_LINK` in `lib/wa.js`).
  - Sequential **"Next pending person"** flow (queue strip + auto-advance on tap so the organizer nudges each pending person in turn).
  - `lib/upi.js` + vendored MIT `vendor/qrcode.js` (`vendor/LICENSE`): builds `upi://pay?pa=<vpa>&pn=<payee name>&am=<amount>&cu=INR&tn=<collection name>` and renders a scannable SVG QR code on device.
- **P5 & P6 — PWA Offline Shell, Settings & QA:**
  - `manifest.webmanifest`, `icons/` (`192`, `512`, `maskable 512`), and cache-first `sw.js` (`chanda-shell-v1`).
  - Settings screen: organizer name & UPI ID (`vpa`), JSON Backup Export & Import (validate, migrate, confirm, replace), CSV export (Pro gate), install prompt, and privacy note (`"Your data stays on this phone. Chanda never moves money."`).

## Release rule

`sw.js` is cache-first. Phones that already installed the app keep serving the old shell until `CACHE_NAME` in `sw.js` changes, so bump it (`chanda-shell-v3`, `-v4`, ...) in every commit that is deployed.

## Review log

- 2026-10-23 Claude review of the Antigravity build: fixed `fonts/mukta.css` (URLs resolved to `fonts/fonts/`, so Mukta never loaded); removed the hard-coded `rahul@okaxis` fallback UPI ID from the share screen, nudge message and copy button (an organizer with no UPI ID set now sees a "add your UPI ID" prompt and no QR); added `privacy.html`; bumped the service-worker cache to v2.

## Deploy (GitHub Pages)

Live at https://chanda.sakredstudio.ca. The public repo `SakredStudio/chanda` is a deploy mirror of this folder; the monorepo is the source of truth. From the sakred-os root, on master:

```powershell
git subtree push --prefix=projects/chanda-collector/app https://github.com/SakredStudio/chanda.git main
```

The workflow in `.github/workflows/deploy.yml` runs the tests and publishes the folder. Bump `CACHE_NAME` in `sw.js` first.

## Pro unlock (Google Play Billing)

`lib/billing.js` uses the Digital Goods API + Payment Request, which exist only inside the Play-installed TWA (`projects/chanda-twa`, `playBilling.enabled`). On the open web every call reports "unavailable", the Pro sheet shows the description only, and nothing is sold (Play policy). Product: one-time, non-consumable `chanda_pro`, ₹149 (price text comes from Play's `getDetails`; `₹149` is the fallback). `complete('success')` acknowledges the purchase; `listPurchases()` restores it at boot and from Settings → Restore purchase. No backend: the entitlement is `settings.isPro` in local storage. Pro = unlimited active collections, CSV export, custom WhatsApp template (Settings).

## v1.1 (2026-10-24, after Soul's first phone test)
- Detail screen: **Add people** (contacts or typed) to an existing collection; **Delete collection** with confirm sheet. Sample collections are ordinary collections, so they can be deleted to free the 3 free slots.
- Settings: **Appearance** Light / Dark / Auto (follows the phone), persisted in `settings.theme`; dark palette is a token override on `html[data-theme="dark"]`.
- Settings: **Delete all data** (confirm sheet) wipes storage but keeps language + theme; Pro is restored from Play on next launch / Restore purchase.
- SW cache v4. Tests 32.
