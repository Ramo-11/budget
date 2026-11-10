# Sahab Budget

Local-first personal budget tracker as a static web app: import bank CSV exports, auto-categorize with rules, and review dashboards, budgets, and analytics. All data stays in the browser (localStorage); there is no backend, no accounts, no build step.

## Stack

Plain HTML + CSS + vanilla JS (no framework, no bundler). Chart.js 3.9 and PapaParse 5.4 are self-hosted in `js/vendor/`. Inter (variable woff2) is self-hosted in `fonts/` via `css/fonts.css`. No external requests at runtime, so the app is fully offline-capable and leaks nothing to third parties (consistent with its local-first, private positioning).

## Architecture

- Pages: `index.html` (Home: this month at a glance), `transactions.html` (search, filters, review, bulk edit, trash), `budgets.html` (category budgets, rollover, savings goals), `analytics.html` (labelled Insights: overview, cashflow, trends, categories, merchants, subscriptions, compare, month in review), `settings.html` (categories, auto-sort rules, accounts, import, security, backup, appearance, data), `about.html` (help). Every page follows one template: `<body data-page="...">`, `<div id="appShell">`, `<main id="main" class="page">`, and the same script list.
- `js/store.js` is the data API every screen reads and writes through (`window.Store`): normalized transactions, summaries, budgets with carry over, category changes with auto-sort rules, notes, manual transactions, trash, savings goals, currency preferences, upcoming bills. Writes save, broadcast to other tabs, and fire `Store.onChange` plus the `budget:changed` window event. `core.js` still owns persistence (`saveData`/`loadSavedData`) and the CSV import engine (`splitByMonth`).
- `js/ui.js` (`window.UI`: sheets, confirm, prompt, toast, menu, month stepper, segmented, progress, empty states, icons) and `js/shell.js` (header, mobile tab bar, sample banner, account switcher, command palette on Cmd/Ctrl+K, shortcuts) are shared by every page. `css/theme.css` holds all tokens (light and dark), `css/base.css` all shared components; page CSS only adds layout.
- Shared sheets loaded on every page: `js/tx-sheet.js` (`openTransactionSheet`, `openAddTransaction`, `openCategoryPicker`, `openReviewFlow`), `js/importer.js` (`openImport`, plus drag and drop anywhere), `js/getting-started.js` (sample mode, help, welcome tour), `js/accounts.js` (`openCreateAccount`, `openManageAccounts`), `js/lock.js` (`openAppLockSettings`).
- Storage is per-account. `js/accounts.js` is the data layer: accounts registry under `sahabBudget_accounts`, active account under `sahabBudget_activeAccount`, and each account's payload under `sahabBudget_data__<accountId>`. The legacy single blob `sahabBudget_data` is auto-migrated into a first account on load. `getActiveDataKey()` (global) resolves the active payload key; always read/write through it. Sample data lives in a dedicated throwaway account so exiting sample mode never touches real data, and its dates are shifted so the newest sample month is the current month.
- Payload fields: `monthlyData`, `categoryConfig`, `budgets`, `transactionOverrides`, `transactionIncomeOverrides`, `unifiedRules`, `incomeSettings` (includes `carryUnusedBudget`), `deletedTransactions`, `deletedFingerprints`, `transactionNotes`, `savingsGoals`, `appPreferences`. Backups (`js/backup.js`, sanitizers in `js/import.js`) must cover every field; password backups use PBKDF2 SHA-256 plus AES-GCM.
- Category keywords shorter than 5 characters match whole words only (`keywordMatches` in `core.js`), so "FEE" no longer matches "COFFEE".
- Feature modules: `recurring.js` (subscriptions detector with cadence and next date), `transfers.js` (cross-account transfer matching, flags keyed `sahabBudget_transferFlags__<id>`), `undo.js` (snapshot + snackbar), `lock.js` (PIN app lock, SHA-256 via SubtleCrypto), `pwa.js` (service worker registration).
- PWA: `manifest.webmanifest` + `sw.js` (app-shell precache, stale-while-revalidate). Bump `CACHE_VERSION` in `sw.js` and update its file list when shell assets are added, removed, or changed.
- `csv_files/` and `sample_data.json` are dev/test data, not app code.

## Run

No build. Serve the folder statically (for example `python3 -m http.server`) and open `index.html`; opening the file directly also works for most flows, but the `/images/...` absolute paths in the HTML expect a server rooted at the project folder.

## Gotchas

- Script load order in each HTML matters: `accounts.js` must load before `core.js`, and `store.js`, `ui.js`, `shell.js` load after `core.js`/`rules.js` and before page scripts. Copy the script list from an existing page when adding one.
- All storage reads/writes go through `getActiveDataKey()` (never hard-code `sahabBudget_data`), or data will read from the wrong account.
- User-supplied text (CSV cells, category names, rule text) must be escaped with `escapeHtml()` (in `utils.js`) before going into innerHTML; the CSV preview and all list renders already do this.
- A pre-render inline script in the `<head>` of each page sets `data-theme` and the `hide-amounts` class before paint; keep it in the head. Money text carries class `money` so the hide amounts setting can blur it.
- Data-loss caution: everything lives in localStorage. Migration/import code must validate before overwriting a payload, and destructive actions should snapshot via `undo.js` first.
- Service worker caveat during local dev: once registered, `sw.js` serves cached assets. After editing shell files, bump `CACHE_VERSION` (or unregister the SW + clear caches) to see changes.
