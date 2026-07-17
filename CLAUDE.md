# Sahab Budget

Local-first personal budget tracker as a static web app: import bank CSV exports, auto-categorize with rules, and review dashboards, budgets, and analytics. All data stays in the browser (localStorage); there is no backend, no accounts, no build step.

## Stack

Plain HTML + CSS + vanilla JS (no framework, no bundler). Chart.js 3.9 and PapaParse 5.4 are self-hosted in `js/vendor/`. Inter (variable woff2) is self-hosted in `fonts/` via `css/fonts.css`. No external requests at runtime, so the app is fully offline-capable and leaks nothing to third parties (consistent with its local-first, private positioning).

## Architecture

- Pages: `index.html` (dashboard + budget view), `analytics.html`, `settings.html`, `about.html`. Each page loads its own CSS from `css/` and scripts from `js/`.
- `js/` modules are classic scripts sharing globals; load order in each HTML file matters. Key files: `core.js` (data layer), `dashboard.js`, `analytics.js`, `settings.js`, `import.js` + `columnMapping.js` (CSV ingestion), `rules.js` (categorization rules), `budgetView.js`, `comparison.js`, `daterange.js`, `sync.js`, `widget.js`, `getting-started.js`, `mobile.js`, `utils.js`.
- Storage is per-account. `js/accounts.js` is the data layer: accounts registry under `sahabBudget_accounts`, active account under `sahabBudget_activeAccount`, and each account's payload under `sahabBudget_data__<accountId>`. The legacy single blob `sahabBudget_data` is auto-migrated into a first account on load. `getActiveDataKey()` (global) resolves the active payload key; always read/write through it. Sample data lives in a dedicated throwaway account so exiting sample mode never touches real data.
- Theme + design system: `css/theme.css` holds all tokens (light + dark) and loads first; `js/theme.js` controls the light/dark/system toggle. `js/icons.js` maps category names to color-coded SVG line icons.
- Feature modules (all global-script style): `recurring.js` (subscriptions detector), `transfers.js` (cross-account transfer matching, flags keyed `sahabBudget_transferFlags__<id>`), `insights-ui.js` (subscriptions/transfers modals), `undo.js` (snapshot + snackbar), `lock.js` (PIN app-lock, SHA-256 via SubtleCrypto), `pwa.js` (service worker registration).
- PWA: `manifest.webmanifest` + `sw.js` (app-shell precache, stale-while-revalidate). Bump `CACHE_VERSION` in `sw.js` when shell assets change. The install step precaches with `{cache:'reload'}` so a version bump always fetches fresh assets and never reuses stale browser-cached copies.
- `csv_files/` and `sample_data.json` are dev/test data, not app code.

## Run

No build. Serve the folder statically (for example `python3 -m http.server`) and open `index.html`; opening the file directly also works for most flows, but the `/images/...` absolute paths in the HTML expect a server rooted at the project folder.

## Gotchas

- Script load order in each HTML matters: `accounts.js` must load before `core.js`/page scripts because they call the global `getActiveDataKey()` at load time. If you add a page, keep `accounts.js` early in the `<script>` list.
- All storage reads/writes go through `getActiveDataKey()` (never hard-code `sahabBudget_data`), or data will read from the wrong account.
- User-supplied text (CSV cells, category names, rule text) must be escaped with `escapeHtml()` (in `utils.js`) before going into innerHTML; the CSV preview and all list renders already do this.
- A pre-render inline script in the `<head>` of each page sets `data-theme` before paint (avoids a theme flash) and `index.html` adds a `tutorial-hidden` class; keep both in the head if restructuring.
- Data-loss caution: everything lives in localStorage. Migration/import code must validate before overwriting a payload, and destructive actions should snapshot via `undo.js` first.
- Service worker caveat during local dev: once registered, `sw.js` serves cached assets. After editing shell files, bump `CACHE_VERSION` (or unregister the SW + clear caches) to see changes.
