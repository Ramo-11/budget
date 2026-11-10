(function () {
    const MAX_BYTES = 10 * 1024 * 1024;

    const BANK_STEPS = [
        ['Chase', 'Sign in, open the account, and choose the download option on the account activity page. Pick CSV as the file type and a date range, then download.'],
        ['Bank of America', 'Open the account, choose Download above the transaction list, pick a CSV or spreadsheet format and a date range, then download.'],
        ['Wells Fargo', 'Open the account, choose Download Account Activity, pick Comma Separated as the file format and a date range, then download.'],
        ['Capital One', 'Open the account, choose Download Transactions, pick CSV and a date range, then download.'],
        ['Citi', 'Open the account, choose Download Transactions, pick CSV and a date range, then download.'],
        ['Discover', 'Open Activity and Statements, choose Download, pick CSV and a date range, then download.'],
        ['American Express', 'Open Statements and Activity, choose Download, pick CSV and the details you want, then download.'],
        ['U.S. Bank', 'Open the account, choose Download Transactions, pick CSV and a date range, then download.'],
        ['PNC', 'Open the account, choose Download Activity, pick CSV and a date range, then download.'],
        ['Credit unions and others', 'Look for Download, Export, or Statements near your transaction list, and pick CSV (sometimes called spreadsheet or comma separated). Menu names change from time to time.']
    ];

    let ctx = null;
    let state = null;
    let dragDepth = 0;
    let overlay = null;

    function esc(t) {
        return typeof escapeHtml === 'function' ? escapeHtml(String(t == null ? '' : t)) : String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function h(tag, attrs, children) {
        const el = document.createElement(tag);
        Object.entries(attrs || {}).forEach(([k, v]) => {
            if (v == null || v === false) return;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        });
        [].concat(children || []).forEach((c) => {
            if (c == null || c === false) return;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return el;
    }

    function icon(name, size) {
        return typeof UI !== 'undefined' && UI.icon ? UI.icon(name, size || 20) : '';
    }

    function money(n, opts) {
        if (typeof Store !== 'undefined' && Store.money) return Store.money(n, opts);
        return '$' + Math.abs(n).toFixed(2);
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many || one + 's');
    }

    function fmtDate(d, withYear) {
        return d.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
    }

    function fmtSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function toast(message, type) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(message, { type: type || 'info' });
        else if (typeof showNotification === 'function') showNotification(message, type || 'info');
    }

    function rangeOf(rows) {
        let min = null;
        let max = null;
        rows.forEach((r) => {
            if (!min || r._date < min) min = r._date;
            if (!max || r._date > max) max = r._date;
        });
        return min ? { min, max } : null;
    }

    function rangeText(range) {
        if (!range) return '';
        const sameYear = range.min.getFullYear() === range.max.getFullYear();
        const nowYear = new Date().getFullYear();
        const showYear = !sameYear || range.max.getFullYear() !== nowYear;
        return fmtDate(range.min, showYear && !sameYear) + ' to ' + fmtDate(range.max, showYear);
    }

    function isCsvLike(file) {
        const name = (file.name || '').toLowerCase();
        return /\.(csv|txt)$/.test(name) || /csv|text\/plain|excel/.test(file.type || '');
    }

    async function readFile(file) {
        const item = {
            id: Math.random().toString(36).slice(2, 9),
            name: file.name,
            size: file.size,
            error: null,
            rows: [],
            headers: [],
            detected: null,
            mapping: null,
            confirmed: false,
            remember: true,
            layoutName: 'My bank',
            normalized: null
        };
        if (file.size > MAX_BYTES) {
            item.error = 'This file is ' + fmtSize(file.size) + ', which is over the 10 MB limit. Try a shorter date range from your bank.';
            return item;
        }
        if (file.size === 0) {
            item.error = 'This file is empty. Download it again from your bank and make sure it has transactions.';
            return item;
        }
        if (!isCsvLike(file)) {
            item.error = 'This does not look like a CSV file. Banks usually let you download transactions as CSV, sometimes called a spreadsheet or comma separated file.';
            return item;
        }
        let text;
        try {
            text = await file.text();
        } catch (e) {
            item.error = 'We could not read this file. Try downloading it again.';
            return item;
        }
        if (text.indexOf('\u0000') !== -1) {
            item.error = 'This file is not plain text. Download it as CSV from your bank rather than as an Excel or PDF file.';
            return item;
        }
        if (typeof Papa === 'undefined') {
            item.error = 'The file reader did not load. Refresh the page and try again.';
            return item;
        }
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const headers = window.cleanCsvHeaders(parsed.meta.fields || []);
        if (headers.length < 2 || !parsed.data.length) {
            item.error = parsed.data.length === 0 && headers.length >= 2
                ? 'This file has column names but no transactions in it.'
                : 'This does not look like a bank CSV. We could not find columns of data in it.';
            return item;
        }
        item.rows = parsed.data;
        item.headers = headers;
        const detected = window.detectBankFormat(headers);
        if (detected) {
            item.detected = detected;
            item.mapping = window.resolveBankMapping(detected, headers);
            item.confirmed = window.isBankMappingUsable(item.mapping);
        }
        if (!item.confirmed) {
            const guess = window.guessColumnMapping(headers, item.rows);
            item.mapping = Object.assign({ passthrough: false }, guess);
            item.detected = null;
        }
        recompute(item);
        if (item.confirmed && item.normalized.rows.length === 0) item.confirmed = false;
        return item;
    }

    function recompute(item) {
        item.normalized = window.processTransactionsWithMapping(item.rows, item.mapping);
        item.range = rangeOf(item.normalized.rows);
    }

    function needsPicker(item) {
        return !item.error && !item.confirmed;
    }

    function readyItems() {
        return state.files.filter((f) => !f.error && f.normalized && f.normalized.rows.length > 0 && window.isBankMappingUsable(f.mapping));
    }

    function setFooter(buttons) {
        const footer = state.footer;
        footer.textContent = '';
        buttons.forEach((b) => footer.appendChild(b));
    }

    function btn(label, variant, onClick, extra) {
        return h('button', Object.assign({ type: 'button', class: 'btn btn-' + variant, onclick: onClick }, extra || {}), label);
    }

    function render() {
        if (!ctx) return;
        state.body.textContent = '';
        if (state.step === 'choose') renderChoose();
        else if (state.step === 'check') renderCheck();
        else renderDone();
    }

    function setHeading(title, subtitle) {
        const t = ctx.el.querySelector('.ui-sheet-title, [data-sheet-title], h2');
        const s = ctx.el.querySelector('.ui-sheet-subtitle, [data-sheet-subtitle]');
        if (t) t.textContent = title;
        if (s && subtitle != null) s.textContent = subtitle;
    }

    function pickFiles() {
        state.input.value = '';
        state.input.click();
    }

    function renderChoose() {
        setHeading('Import transactions', 'Bring in a file from your bank.');
        const zone = h('div', { class: 'imp-drop' }, [
            h('span', { class: 'imp-drop-icon', html: icon('upload', 28), 'aria-hidden': 'true' }),
            h('p', { class: 'imp-drop-title', text: 'Drop your bank file here or choose a file' }),
            h('p', { class: 'imp-drop-sub', text: 'CSV files only. You can pick more than one.' }),
            btn('Choose a file', 'primary', pickFiles, { id: 'impChooseBtn' })
        ]);
        ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.add('is-over')));
        ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove('is-over')));
        state.body.appendChild(zone);
        if (state.busy) {
            state.body.appendChild(h('p', { class: 'imp-note', role: 'status', text: 'Reading your file...' }));
        }
        if (window.isSampleMode && window.isSampleMode()) {
            state.body.appendChild(h('p', { class: 'imp-note imp-note-warn', text: 'You are looking at sample data. Anything you import goes into the sample, not your real budget.' }));
        }
        const help = h('details', { class: 'imp-help' }, [
            h('summary', { text: 'How do I get this file?' }),
            h('div', { class: 'imp-help-body' }, [
                h('p', { text: 'Sign in to your bank on its website (the app often does not offer downloads) and look for a way to download or export your transactions as a CSV file.' }),
                h('dl', { class: 'imp-banks' }, BANK_STEPS.flatMap(([name, text]) => [h('dt', { text: name }), h('dd', { text })])),
                h('p', { class: 'imp-help-tip', text: 'Tip: a few months at a time works well. Importing the same days twice is safe, repeats are skipped.' })
            ])
        ]);
        state.body.appendChild(help);
        state.body.appendChild(h('p', { class: 'imp-privacy' }, [h('span', { html: icon('lock', 16), 'aria-hidden': 'true' }), 'Your file is read on this device only.']));
        setFooter([btn('Cancel', 'ghost', () => ctx.close())]);
        const first = state.body.querySelector('#impChooseBtn');
        if (first && !state.focusedOnce) {
            state.focusedOnce = true;
            first.focus();
        }
    }

    function selectField(labelText, id, headers, value, onChange, allowNone) {
        const sel = h('select', { class: 'select', id, onchange: (e) => onChange(e.target.value || null) });
        if (allowNone || !value) sel.appendChild(h('option', { value: '', text: allowNone ? 'None' : 'Choose a column' }));
        headers.forEach((col) => {
            const o = h('option', { value: col, text: col });
            if (col === value) o.selected = true;
            sel.appendChild(o);
        });
        return h('div', { class: 'field' }, [h('label', { for: id, text: labelText }), sel]);
    }

    function radioGroup(name, legend, options, value, onChange) {
        const fs = h('fieldset', { class: 'imp-radios' }, [h('legend', { text: legend })]);
        options.forEach((opt, i) => {
            const id = name + '_' + i;
            const input = h('input', { type: 'radio', name, id, value: String(opt.value), onchange: () => onChange(opt.value) });
            if (opt.value === value) input.checked = true;
            fs.appendChild(h('label', { class: 'imp-radio', for: id }, [input, h('span', { text: opt.label })]));
        });
        return fs;
    }

    function previewNode(item) {
        const wrap = h('div', { class: 'imp-preview' });
        fillPreview(wrap, item);
        return wrap;
    }

    function fillPreview(wrap, item) {
        wrap.textContent = '';
        const n = item.normalized;
        if (!n || n.rows.length === 0) {
            const stats = n ? n.stats : null;
            let msg = 'No transactions found with these columns.';
            if (stats && stats.unreadableDates > 0 && stats.unreadableDates >= stats.total * 0.5) msg = 'We could not read the dates in the "' + item.mapping.dateColumn + '" column. Try a different date column.';
            else if (stats && stats.unreadableAmounts > 0 && stats.unreadableAmounts >= stats.total * 0.5) msg = 'We could not read the amounts in this column. Try a different amount column.';
            else if (!window.isBankMappingUsable(item.mapping)) msg = 'Choose a date, a description, and an amount to see a preview.';
            wrap.appendChild(h('p', { class: 'imp-note imp-note-warn', role: 'status', text: msg }));
            return;
        }
        const list = h('ul', { class: 'imp-rows', 'aria-label': 'Preview of the first rows' });
        n.rows.slice(0, 5).forEach((r) => {
            const desc = r.Description;
            const name = typeof Store !== 'undefined' && Store.merchantName ? Store.merchantName(desc) : desc;
            let cat = 'Others';
            try {
                cat = categorizeTransaction(desc) || 'Others';
            } catch (e) {
                cat = 'Others';
            }
            const amt = r.Amount;
            const cls = amt < 0 ? 'is-expense' : 'is-income';
            list.appendChild(h('li', { class: 'imp-row' }, [
                h('div', { class: 'imp-row-main' }, [
                    h('span', { class: 'imp-row-title', text: name }),
                    h('span', { class: 'imp-row-sub', text: fmtDate(r._date, true) + '  ' + (cat === 'Others' ? 'Needs a category' : cat) })
                ]),
                h('span', { class: 'imp-row-amt money num ' + cls, text: (amt < 0 ? '-' : '+') + money(Math.abs(amt)) })
            ]));
        });
        wrap.appendChild(list);
        const bits = [plural(n.rows.length, 'transaction') + ' found'];
        if (item.range) bits.push(rangeText(item.range));
        wrap.appendChild(h('p', { class: 'imp-summary', role: 'status', text: bits.join(', ') }));
        const s = n.stats;
        const skipped = s.unreadableAmounts + s.unreadableDates;
        if (skipped > 0) wrap.appendChild(h('p', { class: 'imp-note', text: plural(skipped, 'row') + ' could not be read and will be left out.' }));
    }

    function pickerNode(item, previewEl, refreshFooter) {
        const m = item.mapping;
        const update = () => {
            item.userChecked = true;
            recompute(item);
            fillPreview(previewEl, item);
            refreshFooter();
        };
        const pre = 'imp_' + item.id;
        const box = h('div', { class: 'imp-picker' });
        box.appendChild(h('p', { class: 'imp-picker-lead', text: 'We could not tell which bank this is. Tell us which column is which and we will remember it for next time.' }));
        const grid = h('div', { class: 'imp-grid' });
        grid.appendChild(selectField('Which column is the date?', pre + '_date', item.headers, m.dateColumn, (v) => { m.dateColumn = v; update(); }));
        grid.appendChild(selectField('Which column describes the purchase?', pre + '_desc', item.headers, m.descriptionColumn, (v) => { m.descriptionColumn = v; update(); }));
        box.appendChild(grid);
        const amountArea = h('div', { class: 'imp-amount-area' });
        const drawAmount = () => {
            amountArea.textContent = '';
            amountArea.appendChild(radioGroup(pre + '_mode', 'How are amounts shown?', [
                { value: 'single', label: 'One amount column' },
                { value: 'split', label: 'Separate money out and money in columns' }
            ], m.amountMode || (m.debitColumn ? 'split' : 'single'), (v) => {
                m.amountMode = v;
                if (v === 'split') {
                    m.amountColumn = null;
                    const dc = window.guessColumnMapping(item.headers, item.rows);
                    m.debitColumn = m.debitColumn || dc.debitColumn || null;
                    m.creditColumn = m.creditColumn || dc.creditColumn || null;
                } else {
                    m.debitColumn = null;
                    m.creditColumn = null;
                    m.amountColumn = m.amountColumn || window.guessColumnMapping(item.headers, item.rows).amountColumn || null;
                }
                drawAmount();
                update();
            }));
            if ((m.amountMode || (m.debitColumn ? 'split' : 'single')) === 'split') {
                const g = h('div', { class: 'imp-grid' });
                g.appendChild(selectField('Money out (spending) column', pre + '_debit', item.headers, m.debitColumn, (v) => { m.debitColumn = v; update(); }));
                g.appendChild(selectField('Money in column', pre + '_credit', item.headers, m.creditColumn, (v) => { m.creditColumn = v; update(); }));
                amountArea.appendChild(g);
            } else {
                amountArea.appendChild(selectField('Which column is the amount?', pre + '_amt', item.headers, m.amountColumn, (v) => { m.amountColumn = v; update(); }));
                amountArea.appendChild(radioGroup(pre + '_sign', 'In this file, spending is shown as', [
                    { value: true, label: 'Negative numbers (like -12.50)' },
                    { value: false, label: 'Positive numbers (like 12.50)' }
                ], m.negativeIsExpense !== false, (v) => { m.negativeIsExpense = v; update(); }));
            }
        };
        drawAmount();
        box.appendChild(amountArea);
        const remember = h('input', { type: 'checkbox', id: pre + '_rem', onchange: (e) => { item.remember = e.target.checked; nameWrap.hidden = !item.remember; } });
        remember.checked = item.remember;
        const nameInput = h('input', { class: 'input', id: pre + '_name', type: 'text', value: item.layoutName, maxlength: '40', oninput: (e) => { item.layoutName = e.target.value; } });
        const nameWrap = h('div', { class: 'field' }, [h('label', { for: pre + '_name', text: 'Bank name' }), nameInput]);
        nameWrap.hidden = !item.remember;
        box.appendChild(h('label', { class: 'imp-radio imp-remember', for: pre + '_rem' }, [remember, h('span', { text: 'Remember this layout for next time' })]));
        box.appendChild(nameWrap);
        return box;
    }

    function renderCheck() {
        setHeading('Check your file', 'Make sure this looks right before it goes in.');
        const refreshFooter = () => setCheckFooter();
        state.files.forEach((item) => {
            const card = h('section', { class: 'imp-file', 'aria-label': item.name });
            const head = h('div', { class: 'imp-file-head' }, [
                h('div', { class: 'imp-file-name' }, [h('span', { html: icon('file', 18), 'aria-hidden': 'true' }), h('span', { text: item.name })]),
                h('button', {
                    type: 'button',
                    class: 'btn btn-ghost btn-sm',
                    'aria-label': 'Remove ' + item.name,
                    text: 'Remove',
                    onclick: () => {
                        state.files = state.files.filter((f) => f !== item);
                        if (!state.files.length) state.step = 'choose';
                        render();
                    }
                })
            ]);
            card.appendChild(head);
            if (item.error) {
                card.appendChild(h('p', { class: 'imp-error', role: 'alert', text: item.error }));
            } else {
                if (item.detected) {
                    card.appendChild(h('p', { class: 'imp-detected' }, [h('span', { html: icon('check', 16), 'aria-hidden': 'true' }), item.detected.name + ' format found.']));
                }
                const pv = previewNode(item);
                if (needsPicker(item)) {
                    card.appendChild(pickerNode(item, pv, refreshFooter));
                    card.appendChild(pv);
                } else {
                    card.appendChild(pv);
                    const change = h('details', { class: 'imp-change' }, [h('summary', { text: 'Columns look wrong?' })]);
                    const holder = h('div');
                    change.appendChild(holder);
                    change.addEventListener('toggle', () => {
                        if (change.open && !holder.firstChild) {
                            item.confirmed = false;
                            item.userChecked = true;
                            item.mapping.amountMode = item.mapping.debitColumn ? 'split' : 'single';
                            holder.appendChild(pickerNode(item, pv, refreshFooter));
                            refreshFooter();
                        }
                    });
                    card.appendChild(change);
                }
            }
            state.body.appendChild(card);
        });
        state.body.appendChild(h('p', { class: 'imp-privacy' }, [h('span', { html: icon('lock', 16), 'aria-hidden': 'true' }), 'Your file is read on this device only.']));
        setCheckFooter();
    }

    function setCheckFooter() {
        const ready = readyItems();
        const total = ready.reduce((s, f) => s + f.normalized.rows.length, 0);
        const go = btn(total ? 'Import ' + plural(total, 'transaction') : 'Import', 'primary', runImport, { id: 'impGoBtn' });
        if (!total) go.disabled = true;
        setFooter([btn('Back', 'ghost', () => { state.step = 'choose'; state.files = []; render(); }), btn('Add another file', 'secondary', pickFiles), go]);
    }

    function runImport() {
        if (typeof splitByMonth !== 'function') {
            ctx.setError('The import tool did not load. Refresh the page and try again.');
            return;
        }
        const items = readyItems();
        if (!items.length) return;
        ctx.setError(null);
        ctx.setBusy(true);
        const snapshot = typeof snapshotActiveData === 'function' ? snapshotActiveData() : null;
        const beforeReview = countNeedsReview();
        const results = [];
        try {
            items.forEach((item) => {
                const input = item.mapping.passthrough ? item.rows : item.normalized.rows.map(stripInternal);
                const r = splitByMonth(input);
                results.push({ name: item.name, count: item.normalized.rows.length, range: item.range, r });
            });
            if (typeof Store !== 'undefined' && Store.persist) Store.persist('import');
            else if (typeof saveData === 'function') saveData();
            items.forEach((item) => {
                if (item.remember && !item.detected && window.isBankMappingUsable(item.mapping)) {
                    window.saveBankMapping(item.layoutName || 'My bank', item.headers, item.mapping);
                }
            });
        } catch (e) {
            console.error(e);
            if (snapshot && typeof restoreActiveData === 'function') restoreActiveData(snapshot);
            if (typeof Store !== 'undefined' && Store.reload) Store.reload();
            ctx.setBusy(false);
            ctx.setError('Something went wrong, so nothing was changed. Check the file and try again.');
            return;
        }
        ctx.setBusy(false);
        state.snapshot = snapshot;
        state.results = results;
        state.needsReview = Math.max(0, countNeedsReview() - beforeReview);
        state.needsReviewTotal = countNeedsReview();
        state.step = 'done';
        if (results.some((x) => (x.r.added || 0) + (x.r.incomeAdded || 0) > 0) && typeof window.markWelcomeTourPending === 'function') window.markWelcomeTourPending();
        render();
    }

    function stripInternal(r) {
        const o = Object.assign({}, r);
        delete o._date;
        return o;
    }

    function countNeedsReview() {
        try {
            if (typeof Store !== 'undefined' && Store.allTransactions) return Store.allTransactions().filter((t) => t.needsReview).length;
        } catch (e) {
            return 0;
        }
        return 0;
    }

    function renderDone() {
        const tot = state.results.reduce((a, x) => {
            a.added += x.r.added || 0;
            a.income += x.r.incomeAdded || 0;
            a.dup += x.r.duplicates || 0;
            a.rules += x.r.rulesApplied || 0;
            a.skipped += x.r.skipped || 0;
            return a;
        }, { added: 0, income: 0, dup: 0, rules: 0, skipped: 0 });
        const allRows = [];
        state.results.forEach((x) => { if (x.range) allRows.push({ _date: x.range.min }, { _date: x.range.max }); });
        const range = rangeOf(allRows);
        const addedAll = tot.added + tot.income;
        state.addedAll = addedAll;
        setHeading(addedAll > 0 ? 'Import finished' : 'Nothing new to add', '');

        const headline = addedAll > 0
            ? 'Added ' + plural(addedAll, 'transaction') + (range ? ' from ' + rangeText(range) : '')
            : 'Everything in your file is already here.';
        state.body.appendChild(h('div', { class: 'imp-done' }, [
            h('span', { class: 'imp-done-icon' + (addedAll > 0 ? '' : ' is-muted'), html: icon('check', 28), 'aria-hidden': 'true' }),
            h('p', { class: 'imp-done-title', role: 'status', text: headline })
        ]));
        const stats = h('ul', { class: 'imp-stats' });
        const addStat = (n, label) => { if (n > 0) stats.appendChild(h('li', {}, [h('span', { class: 'num imp-stat-n', text: String(n) }), h('span', { text: ' ' + label })])); };
        addStat(tot.dup, tot.dup === 1 ? 'duplicate skipped' : 'duplicates skipped');
        addStat(tot.rules, tot.rules === 1 ? 'removed by your rules' : 'removed by your rules');
        addStat(tot.income, tot.income === 1 ? 'income found' : 'income found');
        addStat(tot.skipped, tot.skipped === 1 ? 'left out (card payment or earlier deletion)' : 'left out (card payments or earlier deletions)');
        if (stats.children.length) state.body.appendChild(stats);

        if (state.results.length > 1) {
            const per = h('ul', { class: 'imp-per-file', 'aria-label': 'Result for each file' });
            state.results.forEach((x) => {
                const n = (x.r.added || 0) + (x.r.incomeAdded || 0);
                per.appendChild(h('li', {}, [h('span', { class: 'imp-per-name', text: x.name }), h('span', { class: 'muted', text: n > 0 ? plural(n, 'added', 'added') : 'nothing new' })]));
            });
            state.body.appendChild(per);
        }

        const needs = state.needsReview;
        if (needs > 0) {
            state.body.appendChild(h('p', { class: 'imp-review-note' }, [h('strong', { class: 'num', text: String(needs) }), ' ' + (needs === 1 ? 'needs' : 'need') + ' a category. It takes about a minute to sort them.']));
        }

        const buttons = [];
        if (addedAll > 0 && state.snapshot) {
            buttons.push(btn('Undo import', 'ghost', undoImport));
        }
        buttons.push(btn(needs > 0 ? 'Done' : 'Close', needs > 0 ? 'secondary' : 'primary', () => ctx.close(), { id: 'impDoneBtn' }));
        if (needs > 0 && typeof window.openReviewFlow === 'function') {
            buttons.push(btn('Review now', 'primary', () => {
                const keep = state.keepUndo;
                state.keepUndo = false;
                ctx.close();
                state.keepUndo = keep;
                window.openReviewFlow({});
            }, { id: 'impReviewBtn' }));
        }
        setFooter(buttons);
        const focusEl = state.footer.querySelector('#impReviewBtn') || state.footer.querySelector('#impDoneBtn');
        if (focusEl) focusEl.focus();
    }

    function undoImport() {
        if (state.snapshot && typeof restoreActiveData === 'function') {
            restoreActiveData(state.snapshot);
            if (typeof Store !== 'undefined' && Store.reload) Store.reload();
            state.undone = true;
            ctx.close();
            toast('Import undone', 'success');
        }
    }

    async function addFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length || !ctx) return;
        state.busy = true;
        if (state.step === 'choose') render();
        const items = [];
        for (const f of files) items.push(await readFile(f));
        state.busy = false;
        state.files = state.files.concat(items);
        state.step = 'check';
        render();
        const first = state.body.querySelector('select, .imp-error');
        void first;
    }

    function openImport(opts) {
        const files = (opts && opts.files) || [];
        if (ctx && state) {
            if (files.length) {
                if (state.step === 'done') {
                    state.files = [];
                    state.step = 'choose';
                }
                addFiles(files);
            }
            return ctx;
        }
        if (typeof UI === 'undefined' || !UI.sheet) {
            toast('Import is not ready yet. Refresh the page and try again.', 'error');
            return null;
        }
        const body = h('div', { class: 'imp' });
        const content = h('div', { class: 'imp-content' });
        const footer = h('div', { class: 'imp-footer' });
        const input = h('input', {
            type: 'file',
            class: 'visually-hidden',
            accept: '.csv,.txt,text/csv,text/plain',
            multiple: true,
            tabindex: '-1',
            'aria-hidden': 'true',
            onchange: (e) => {
                const picked = Array.from(e.target.files || []);
                e.target.value = '';
                addFiles(picked);
            }
        });
        body.appendChild(content);
        body.appendChild(footer);
        body.appendChild(input);
        state = { step: 'choose', files: [], body: content, footer, input, busy: false, keepUndo: true, snapshot: null, undone: false, focusedOnce: false };
        ctx = UI.sheet({
            title: 'Import transactions',
            subtitle: 'Bring in a file from your bank.',
            body,
            size: 'lg',
            actions: [],
            onClose: () => {
                const s = state;
                const snap = s && s.snapshot;
                const added = s ? s.addedAll : 0;
                ctx = null;
                state = null;
                if (added > 0 && typeof window.maybeStartWelcomeTour === 'function') setTimeout(window.maybeStartWelcomeTour, 400);
                if (s && snap && added > 0 && !s.undone && s.keepUndo && typeof showUndo === 'function') {
                    showUndo('Imported ' + plural(added, 'transaction'), () => {
                        restoreActiveData(snap);
                        if (typeof Store !== 'undefined' && Store.reload) Store.reload();
                        toast('Import undone', 'success');
                    }, { reloadOnUndo: false, ms: 8000 });
                }
            }
        });
        render();
        if (files.length) addFiles(files);
        return ctx;
    }

    function hasFiles(e) {
        const types = e.dataTransfer && e.dataTransfer.types;
        return !!types && Array.prototype.indexOf.call(types, 'Files') !== -1;
    }

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = h('div', { class: 'imp-overlay', hidden: true, 'aria-hidden': 'true' }, [
            h('div', { class: 'imp-overlay-card' }, [
                h('span', { html: icon('upload', 36), 'aria-hidden': 'true' }),
                h('p', { class: 'imp-overlay-title', text: 'Drop your bank file to import' }),
                h('p', { class: 'imp-overlay-sub', text: 'It stays on this device.' })
            ])
        ]);
        document.body.appendChild(overlay);
        return overlay;
    }

    function hideOverlay() {
        dragDepth = 0;
        if (overlay) overlay.hidden = true;
    }

    function initDrop() {
        document.addEventListener('dragenter', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragDepth++;
            ensureOverlay().hidden = false;
        });
        document.addEventListener('dragover', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });
        document.addEventListener('dragleave', (e) => {
            if (!hasFiles(e)) return;
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) hideOverlay();
        });
        document.addEventListener('drop', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            hideOverlay();
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length) openImport({ files });
        });
        window.addEventListener('blur', hideOverlay);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDrop);
    else initDrop();

    window.openImport = openImport;
})();
