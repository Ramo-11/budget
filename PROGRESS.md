# Sahab Budget - Progress

Local-first budget tracker (static HTML/CSS/JS, localStorage). The premium overhaul is complete and verified in the browser. All work is on master and uncommitted (commit is owner-gated).

Snapshot date: 2026-07-16

## Done (overhaul complete)

Design system
- Light + dark theme with a toggle (system default), all tokens in `css/theme.css`, legacy token bridge so old class names keep working.
- Category emojis replaced with color-coded SVG line icons (`js/icons.js`), used as chips across dashboard, analytics, budgets, and modals.

Multi-account workspaces
- Fully separate accounts (separate categories, rules, budgets, transactions) via `js/accounts.js`; header account switcher.
- Create-account flow offers "Copy setup from an existing account" (categories / rules / budgets), and never copies transactions.
- Legacy single-blob data auto-migrates into a first account. Sample data uses a dedicated throwaway account so exiting sample mode cannot lose real data.

New features (all approved)
- Recurring / subscriptions detector (`recurring.js`, `insights-ui.js`).
- Cross-account transfer matching (`transfers.js`), with matched transfers excluded from spend totals.
- Smart insight cards + net cashflow / savings view on analytics (new Overview / Cashflow / Trends / Categories / Merchants tabs).
- Budget rollover / carry-unused toggle.
- Undo for destructive actions (`undo.js`, snapshot + snackbar, survives reload).
- App lock (PIN, SHA-256 via SubtleCrypto) in Settings.
- PWA: installable + full offline (`manifest.webmanifest`, `sw.js`). Chart.js, PapaParse, and the Inter font are self-hosted, so there are zero external requests and offline is complete.

Bug fixes and hardening
- Budget Goals math fixed (was showing inflated percentages by summing spend vs an averaged budget; now sums like-for-like across the period).
- Local date parsing fix (no more UTC off-by-one on month boundaries).
- Crash guards in category analysis; ReDoS guard on user rule regex.
- XSS: user text escaped via `escapeHtml()` before innerHTML (CSV preview, category/rule/list renders).
- Service worker install precaches with `{cache:'reload'}` so a version bump always pulls fresh assets (fixed a stale-precache issue).

Verification
- Browser-verified on desktop (1440) and mobile (390x844): dashboard, analytics, settings, about, plus Budget Goals, Compare, Subscriptions, Transfers, and Column Mapping modals.
- Multi-account create/import/isolation/delete verified end to end with no data loss.
- Offline reload verified (charts paint, font loads, data intact, no console errors, no horizontal overflow).

## Not done (owner-gated)

- Commit / push: not performed (explicitly owner-gated).

## Notes for next session

- Read the updated `CLAUDE.md` for the current architecture (per-account storage, feature modules, PWA/SW rules).
- When editing shell assets, bump `CACHE_VERSION` in `sw.js` or the service worker will serve stale files during local dev.
