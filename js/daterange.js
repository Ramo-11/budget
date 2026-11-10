(function () {
    const OPTIONS = [
        { value: 'month', label: 'This month' },
        { value: '3m', label: 'Last 3 months' },
        { value: '6m', label: 'Last 6 months' },
        { value: 'year', label: 'This year' },
        { value: 'all', label: 'All time' },
        { value: 'custom', label: 'Custom range' },
    ];
    const DAY = 86400000;

    function parseDay(value) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return isNaN(d) ? null : d;
    }

    function endOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    }

    function endOfMonth(key) {
        const d = Store.monthDate(key);
        return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    function monthIndex(key) {
        const d = Store.monthDate(key);
        return d.getFullYear() * 12 + d.getMonth();
    }

    function monthsBetween(startKey, endKey) {
        const out = [];
        let key = startKey;
        let guard = 0;
        while (key && key <= endKey && guard < 600) {
            out.push(key);
            key = Store.shiftMonth(key, 1);
            guard++;
        }
        return out;
    }

    function keyOf(d) {
        return Store.isoDate(d).slice(0, 7);
    }

    function prevLabel(n, partial) {
        if (n === 1) return partial ? 'last month at this point' : 'last month';
        if (n === 12) return 'the previous 12 months';
        return 'the previous ' + n + ' months';
    }

    function resolve(id, custom) {
        const keys = Store.monthKeys();
        if (!keys.length) return null;
        const current = Store.currentMonthKey();
        const anchor = keys.indexOf(current) !== -1 ? current : keys[0];
        const oldest = keys[keys.length - 1];

        if (id === 'custom') {
            const from = custom && parseDay(custom.start);
            const to = custom && parseDay(custom.end);
            if (from && to && from <= to) {
                const days = Math.round((to - from) / DAY) + 1;
                const prevFrom = new Date(from.getTime() - days * DAY);
                const prevTo = new Date(from.getTime() - 1);
                const fmt = { month: 'short', day: 'numeric', year: 'numeric' };
                const loc = Store.prefs().locale;
                return {
                    id: 'custom',
                    label: from.toLocaleDateString(loc, fmt) + ' to ' + to.toLocaleDateString(loc, fmt),
                    from: from,
                    to: endOfDay(to),
                    startKey: keyOf(from),
                    endKey: keyOf(to),
                    months: monthsBetween(keyOf(from), keyOf(to)),
                    aligned: false,
                    prev: {
                        from: prevFrom,
                        to: prevTo,
                        months: monthsBetween(keyOf(prevFrom), keyOf(prevTo)),
                        label: 'the previous ' + days + ' days',
                    },
                };
            }
            id = '3m';
        }

        let startKey = anchor;
        if (id === '3m') startKey = Store.shiftMonth(anchor, -2);
        else if (id === '6m') startKey = Store.shiftMonth(anchor, -5);
        else if (id === 'year') startKey = anchor.slice(0, 4) + '-01';
        else if (id === 'all') startKey = oldest < anchor ? oldest : anchor;
        else id = 'month';

        const months = monthsBetween(startKey, anchor);
        const n = months.length;
        const labels = {
            month: Store.monthLabel(anchor),
            '3m': 'Last 3 months',
            '6m': 'Last 6 months',
            year: anchor.slice(0, 4),
            all: 'All time',
        };
        const period = {
            id: id,
            label: labels[id],
            from: Store.monthDate(startKey),
            to: endOfMonth(anchor),
            startKey: startKey,
            endKey: anchor,
            months: months,
            aligned: true,
            prev: null,
        };
        if (id !== 'all') {
            const pStart = Store.shiftMonth(startKey, -n);
            const pEnd = Store.shiftMonth(startKey, -1);
            let pTo = endOfMonth(pEnd);
            const partial = anchor === current;
            if (partial) {
                const end = Store.monthDate(pEnd);
                const last = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
                pTo = new Date(end.getFullYear(), end.getMonth(), Math.min(new Date().getDate(), last), 23, 59, 59, 999);
            }
            period.prev = {
                from: Store.monthDate(pStart),
                to: pTo,
                months: monthsBetween(pStart, pEnd),
                label: prevLabel(n, partial),
            };
        }
        return period;
    }

    function openCustomSheet(options) {
        const o = options || {};
        if (typeof UI === 'undefined' || typeof UI.sheet !== 'function') {
            if (typeof o.onCancel === 'function') o.onCancel();
            return;
        }
        const keys = Store.monthKeys();
        const first = keys.length ? Store.isoDate(Store.monthDate(keys[keys.length - 1])) : '';
        const last = keys.length ? Store.isoDate(endOfMonth(keys[0])) : '';
        const today = new Date();
        const iso = Store.isoDate;
        const initial = o.value && parseDay(o.value.start) && parseDay(o.value.end)
            ? o.value
            : { start: iso(new Date(today.getTime() - 89 * DAY)), end: iso(today) };

        const body = document.createElement('div');
        body.className = 'ins-range-form';
        body.innerHTML =
            '<div class="ins-range-presets" role="group" aria-label="Quick ranges">' +
            '<button type="button" class="chip-button" data-days="30">Last 30 days</button>' +
            '<button type="button" class="chip-button" data-days="90">Last 90 days</button>' +
            '<button type="button" class="chip-button" data-days="365">Last 12 months</button>' +
            '</div>' +
            '<div class="ins-range-fields">' +
            '<div class="field"><label for="insRangeFrom">From</label>' +
            '<input id="insRangeFrom" class="input" type="date" value="' + initial.start + '"' + (first ? ' min="' + first + '"' : '') + (last ? ' max="' + last + '"' : '') + ' /></div>' +
            '<div class="field"><label for="insRangeTo">To</label>' +
            '<input id="insRangeTo" class="input" type="date" value="' + initial.end + '"' + (first ? ' min="' + first + '"' : '') + (last ? ' max="' + last + '"' : '') + ' /></div>' +
            '</div>';

        let applied = false;
        const fromInput = body.querySelector('#insRangeFrom');
        const toInput = body.querySelector('#insRangeTo');

        body.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-days]');
            if (!btn) return;
            const days = Number(btn.dataset.days);
            const end = keys.length && new Date() > endOfMonth(keys[0]) ? endOfMonth(keys[0]) : new Date();
            toInput.value = iso(end);
            fromInput.value = iso(new Date(end.getTime() - (days - 1) * DAY));
        });

        UI.sheet({
            title: 'Custom range',
            subtitle: 'Pick the first and last day to include.',
            body: body,
            size: 'sm',
            initialFocus: '#insRangeFrom',
            onClose: () => {
                if (!applied && typeof o.onCancel === 'function') o.onCancel();
            },
            actions: [
                { label: 'Cancel', variant: 'ghost' },
                {
                    label: 'Apply',
                    variant: 'primary',
                    closes: false,
                    onClick: (ctx) => {
                        const from = parseDay(fromInput.value);
                        const to = parseDay(toInput.value);
                        if (!from || !to) {
                            ctx.setError('Pick both a start and an end date.');
                            return;
                        }
                        if (from > to) {
                            ctx.setError('The start date needs to come before the end date.');
                            return;
                        }
                        applied = true;
                        ctx.setError(null);
                        ctx.close();
                        if (typeof o.onApply === 'function') o.onApply({ start: fromInput.value, end: toInput.value });
                    },
                },
            ],
        });
    }

    window.InsightsRange = { OPTIONS: OPTIONS, resolve: resolve, openCustomSheet: openCustomSheet, endOfMonth: endOfMonth, parseDay: parseDay };
})();
