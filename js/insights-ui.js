// js/insights-ui.js - View layer for the recurring-charges (subscriptions) and
// cross-account transfer features. Self-contained modals built on the shared
// .app-modal styles; safe to trigger from any page that loads recurring.js and
// transfers.js. All untrusted text is escaped.

(function () {
    function esc(v) { return (typeof window.escapeHtml === 'function') ? window.escapeHtml(v) : String(v == null ? '' : v); }
    function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtDate(d) {
        if (!(d instanceof Date) || isNaN(d)) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function buildModal(title, subtitle) {
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';
        overlay.innerHTML =
            '<div class="app-modal insights-modal"><div class="app-modal-header">' +
            '<div><h2 class="app-modal-title">' + esc(title) + '</h2>' +
            (subtitle ? '<p class="insights-subtitle">' + esc(subtitle) + '</p>' : '') +
            '</div>' +
            '<button class="app-modal-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
            '</div><div class="app-modal-body" id="insightsBody"></div></div>';
        const close = () => overlay.remove();
        overlay.querySelector('.app-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
        return { overlay, body: overlay.querySelector('#insightsBody'), close };
    }

    function emptyState(icon, line) {
        return '<div class="insights-empty">' + icon + '<p>' + esc(line) + '</p></div>';
    }

    /* ---------------- Subscriptions / recurring charges ---------------- */
    window.openSubscriptionsModal = function () {
        const list = (typeof detectRecurring === 'function') ? detectRecurring({ minOccurrences: 2 }) : [];
        const total = (typeof recurringMonthlyTotal === 'function') ? recurringMonthlyTotal(list) : 0;
        const { overlay, body } = buildModal('Recurring & subscriptions',
            list.length ? 'Charges that repeat across months' : null);

        if (!list.length) {
            body.innerHTML = emptyState(
                '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>',
                'No recurring charges detected yet. Import a few months of transactions to spot subscriptions.');
            document.body.appendChild(overlay);
            return;
        }

        let html = '<div class="insights-total"><span>Estimated monthly commitment</span><strong>' + money(total) + '</strong></div>';
        html += '<div class="insights-list">';
        list.forEach((r) => {
            const chip = (typeof getCategoryIconChip === 'function') ? getCategoryIconChip(r.category, { size: 40, icon: 20 }) : '';
            html += '<div class="insights-row">' +
                chip +
                '<div class="insights-row-main">' +
                '<span class="insights-row-title">' + esc(r.label) + '</span>' +
                '<span class="insights-row-sub">' + esc(r.category) + ' - ' + r.monthSpan + ' months - last ' + esc(fmtDate(r.lastDate)) + '</span>' +
                '</div>' +
                '<div class="insights-row-amount">' + money(r.monthly) + '<span>/mo</span></div>' +
                '</div>';
        });
        html += '</div>';
        body.innerHTML = html;
        document.body.appendChild(overlay);
    };

    /* ---------------- Cross-account transfers ---------------- */
    window.openTransfersModal = function () {
        const accounts = (typeof getAccounts === 'function') ? getAccounts().filter((a) => !a.sample) : [];
        const { overlay, body } = buildModal('Cross-account transfers',
            'Money moved between your own accounts');

        if (accounts.length < 2) {
            body.innerHTML = emptyState(
                '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="7"></line><polyline points="13 3 17 7 13 11"></polyline><line x1="7" y1="17" x2="17" y2="17"></line><polyline points="11 21 7 17 11 13"></polyline></svg>',
                'Add a second account to detect transfers between your accounts.');
            document.body.appendChild(overlay);
            return;
        }

        function render() {
            const pairs = (typeof findCrossAccountTransfers === 'function') ? findCrossAccountTransfers({ toleranceDays: 5 }) : [];
            if (!pairs.length) {
                body.innerHTML = emptyState(
                    '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="7"></line><polyline points="13 3 17 7 13 11"></polyline><line x1="7" y1="17" x2="17" y2="17"></line><polyline points="11 21 7 17 11 13"></polyline></svg>',
                    'No matching transfers found across your accounts.');
                return;
            }
            let html = '<p class="insights-subtitle" style="margin-bottom:14px">A payment leaving one account that matches a credit arriving in another. Mark them so they are not counted as spending.</p><div class="insights-list">';
            pairs.forEach((p, i) => {
                const flagged = p.alreadyFlagged;
                html += '<div class="insights-row transfer-row" data-i="' + i + '">' +
                    '<div class="insights-row-main">' +
                    '<span class="insights-row-title">' + money(p.amount) + '</span>' +
                    '<span class="insights-row-sub">' + esc(p.fromAccountName) + ' -> ' + esc(p.toAccountName) + ' - within ' + p.dayGap + ' day' + (p.dayGap === 1 ? '' : 's') + '</span>' +
                    '</div>' +
                    (flagged
                        ? '<span class="insights-flagged">Marked</span>'
                        : '<button class="btn btn-secondary btn-sm transfer-mark" type="button" data-i="' + i + '">Mark as transfer</button>') +
                    '</div>';
            });
            html += '</div>';
            body.innerHTML = html;
            body.querySelectorAll('.transfer-mark').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.getAttribute('data-i'));
                    if (typeof confirmTransferPair === 'function') confirmTransferPair(pairs[idx]);
                    render();
                    if (typeof showNotification === 'function') showNotification('Marked as internal transfer', 'success');
                });
            });
        }
        render();
        document.body.appendChild(overlay);
    };
})();
