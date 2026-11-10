(function () {
    const DAY = 86400000;

    function kit() {
        return window.Insights.kit;
    }

    function addStep(date, perYear) {
        if (perYear === 52) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
        if (perYear === 26) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 14);
        return new Date(date.getFullYear(), date.getMonth() + Math.round(12 / perYear), date.getDate());
    }

    function startOfToday() {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate());
    }

    function upcoming(list, days) {
        const today = startOfToday();
        const end = new Date(today.getTime() + (days - 1) * DAY);
        const out = [];
        list.forEach((r) => {
            if (r.stopped || !r.nextDate) return;
            let due = r.nextDate;
            let guard = 0;
            while (due <= end && guard < 40) {
                out.push({ r: r, due: due });
                due = addStep(due, r.perYear);
                guard++;
            }
        });
        out.sort((a, b) => a.due - b.due || b.r.avgAmount - a.r.avgAmount);
        return out;
    }

    function dayWord(daysAway) {
        if (daysAway === 0) return 'Today';
        if (daysAway === 1) return 'Tomorrow';
        return 'In ' + daysAway + ' days';
    }

    function strip(bills) {
        const k = kit();
        const today = startOfToday();
        const byDay = {};
        bills.forEach((b) => {
            const key = Store.isoDate(b.due);
            byDay[key] = (byDay[key] || 0) + 1;
        });
        const loc = Store.prefs().locale;
        let cells = '';
        for (let i = 0; i < 30; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            const n = byDay[Store.isoDate(d)] || 0;
            cells += '<li class="ins-day' + (n ? ' has-bill' : '') + (i === 0 ? ' is-today' : '') + '"><span class="ins-day-w">' + k.esc(d.toLocaleDateString(loc, { weekday: 'narrow' })) + '</span><span class="ins-day-n">' + d.getDate() + '</span><span class="ins-day-dot"></span></li>';
        }
        return '<ol class="ins-strip" aria-hidden="true">' + cells + '</ol>';
    }

    function subRow(r, withNext) {
        const k = kit();
        const name = Store.merchantName(r.label);
        const cost = r.perYear === 12 ? k.m(r.avgAmount) + '<span class="ins-row-sub">a month</span>' : k.m(r.avgAmount) + '<span class="ins-row-sub">' + k.esc(r.cadence) + '</span>';
        let sub = 'Last charged ' + k.esc(k.fmtDate(r.lastDate, true));
        if (withNext && r.nextDate) sub += ', next around ' + k.esc(k.fmtDate(r.nextDate, true));
        sub += '. About ' + k.m(r.yearly) + ' a year.';
        return '<li><a class="ins-row" href="' + k.esc(k.txLink({ q: name })) + '">' + k.chip(r.category) +
            '<span class="ins-row-main"><span class="ins-row-title">' + k.esc(name) + '</span><span class="ins-row-sub">' + sub + '</span></span>' +
            '<span class="ins-row-trail">' + cost + '</span></a></li>';
    }

    function realAccountCount() {
        if (typeof getAccounts !== 'function') return 0;
        try {
            return getAccounts().filter((a) => !a.sample).length;
        } catch (e) {
            return 0;
        }
    }

    let pendingPairs = [];

    function transfersHtml() {
        const k = kit();
        if (realAccountCount() < 2 || typeof findCrossAccountTransfers !== 'function') {
            pendingPairs = [];
            return '';
        }
        const all = findCrossAccountTransfers();
        pendingPairs = all.filter((p) => !p.alreadyFlagged && !p.dismissed);
        const done = all.filter((p) => p.alreadyFlagged).length;
        let html = '<section class="card ins-card" id="transfers" aria-labelledby="insTransTitle"><div class="card-header"><h2 class="card-title" id="insTransTitle">Transfers between your accounts</h2></div>' +
            '<p class="ins-note">When you move money between your own accounts, it can show up twice: once as spending and once as income. Mark those as transfers and they are left out of your totals.</p>';
        if (pendingPairs.length) {
            html += '<ul class="ins-list">' + pendingPairs.map((p, i) => {
                const gap = p.dayGap === 0 ? 'the same day' : p.dayGap === 1 ? 'a day later' : p.dayGap + ' days later';
                return '<li class="ins-transfer"><div class="ins-transfer-text"><span class="ins-row-title">' + k.m(p.amount) + ' from ' + k.esc(p.fromAccountName) + ' to ' + k.esc(p.toAccountName) + '</span>' +
                    '<span class="ins-row-sub">Left ' + k.esc(p.fromAccountName) + ' on ' + k.esc(k.fmtDate(p.fromDate, true)) + ' and arrived ' + gap + '. Did you move this money yourself?</span></div>' +
                    '<div class="ins-transfer-actions"><button type="button" class="btn btn-primary btn-sm" data-transfer="confirm" data-i="' + i + '">Yes, it is a transfer</button>' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-transfer="dismiss" data-i="' + i + '">Not a transfer</button></div></li>';
            }).join('') + '</ul>';
        } else {
            html += k.emptyBlock('Nothing to check', done ? done + (done === 1 ? ' transfer is' : ' transfers are') + ' already left out of your totals.' : 'No matching moves between your accounts were found.');
        }
        return html + '</section>';
    }

    function renderSubscriptions(el) {
        const k = kit();
        const list = typeof detectRecurring === 'function' ? detectRecurring() : [];
        const active = list.filter((r) => !r.stopped);
        const stopped = list.filter((r) => r.stopped);
        const monthly = recurringMonthlyTotal(list);
        const bills = upcoming(list, 30);
        const dueTotal = bills.reduce((s, b) => s + b.r.avgAmount, 0);
        const today = startOfToday();

        let html = '';
        if (!list.length) {
            html += '<section class="card ins-card">' + k.emptyBlock('No repeating charges found yet', 'We look for charges that repeat at least twice on a steady schedule, like streaming or a gym, with a similar amount each time. Import another month and they will show up here.') + '</section>';
        } else {
            html += '<div class="ins-stats ins-stats-3">' +
                '<div class="ins-stat"><div class="stat-label">Per month</div><div class="stat-value">' + k.m(monthly) + '</div><div class="ins-stat-sub">' + active.length + (active.length === 1 ? ' subscription' : ' subscriptions') + '</div></div>' +
                '<div class="ins-stat"><div class="stat-label">Per year</div><div class="stat-value">' + k.m(monthly * 12) + '</div><div class="ins-stat-sub">If nothing changes</div></div>' +
                '<div class="ins-stat"><div class="stat-label">Due in 30 days</div><div class="stat-value">' + k.m(dueTotal) + '</div><div class="ins-stat-sub">' + bills.length + (bills.length === 1 ? ' charge' : ' charges') + ' expected</div></div></div>';

            html += '<section class="card ins-card" aria-labelledby="insBillsTitle"><div class="card-header"><h2 class="card-title" id="insBillsTitle">Coming up in the next 30 days</h2></div>' + strip(bills);
            if (bills.length) {
                html += '<ul class="ins-list">' + bills.map((b) => {
                    const away = Math.round((b.due - today) / DAY);
                    return '<li><div class="ins-row">' + k.chip(b.r.category) + '<span class="ins-row-main"><span class="ins-row-title">' + k.esc(Store.merchantName(b.r.label)) + '</span><span class="ins-row-sub">' + k.esc(dayWord(away)) + ', ' + k.esc(k.fmtDate(b.due, false)) + '</span></span><span class="ins-row-trail">' + k.m(b.r.avgAmount) + '</span></div></li>';
                }).join('') + '</ul>';
            } else {
                html += '<p class="ins-note">No repeating charges are expected in the next 30 days.</p>';
            }
            html += '</section>';

            html += '<section class="card ins-card" aria-labelledby="insSubsTitle"><div class="card-header"><h2 class="card-title" id="insSubsTitle">Repeating charges</h2></div>';
            html += active.length ? '<ul class="ins-list">' + active.map((r) => subRow(r, true)).join('') + '</ul>' : '<p class="ins-note">Everything we found looks like it has stopped.</p>';
            html += '</section>';

            if (stopped.length) {
                html += '<section class="card ins-card" aria-labelledby="insStoppedTitle"><div class="card-header"><h2 class="card-title" id="insStoppedTitle">Looks like it stopped</h2></div>' +
                    '<p class="ins-note">These used to repeat but have not been charged in a while. They are not counted in your totals.</p><ul class="ins-list">' + stopped.map((r) => subRow(r, false)).join('') + '</ul></section>';
            }
        }
        html += transfersHtml();
        el.innerHTML = html;

        el.onclick = (e) => {
            const btn = e.target.closest('[data-transfer]');
            if (!btn) return;
            const pair = pendingPairs[Number(btn.dataset.i)];
            if (!pair) return;
            if (btn.dataset.transfer === 'confirm') {
                confirmTransferPair(pair);
                Store.persist('transfers');
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('Marked as a transfer', {
                        type: 'success',
                        action: {
                            label: 'Undo',
                            onClick: () => {
                                unconfirmTransferPair(pair);
                                Store.persist('transfers');
                            },
                        },
                    });
                }
            } else {
                dismissTransferPair(pair);
                Store.persist('transfers');
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('Got it, we will not ask again', {
                        type: 'info',
                        action: {
                            label: 'Undo',
                            onClick: () => {
                                undismissTransferPair(pair);
                                Store.persist('transfers');
                            },
                        },
                    });
                }
            }
        };

        if (window.location.hash === '#transfers') {
            const t = el.querySelector('#transfers');
            if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' });
        }
    }

    window.Insights.register('subscriptions', renderSubscriptions);

    window.openSubscriptionsModal = function () {
        window.location.href = 'analytics.html?tab=subscriptions';
    };
    window.openTransfersModal = function () {
        window.location.href = 'analytics.html?tab=subscriptions#transfers';
    };
})();
