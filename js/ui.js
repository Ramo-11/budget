(function () {
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const isMobile = () => !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);

    function esc(text) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function icon(name, size) {
        return typeof window.getIcon === 'function' ? window.getIcon(name, size || 20) : '';
    }

    function chip(name, options) {
        const o = options || {};
        if (typeof window.getCategoryIconChip !== 'function') return '';
        return window.getCategoryIconChip(name, { size: o.size || 40, icon: o.icon });
    }

    function el(tag, className, text) {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
    }

    function visible(root) {
        return Array.from(root.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
    }

    let uid = 0;
    const sheetStack = [];
    let scrollLocks = 0;

    function lockScroll() {
        scrollLocks += 1;
        document.documentElement.classList.add('sheet-open');
    }
    function unlockScroll() {
        scrollLocks = Math.max(0, scrollLocks - 1);
        if (!scrollLocks) document.documentElement.classList.remove('sheet-open');
    }

    function sheet(options) {
        const o = options || {};
        const id = 'ui-sheet-' + (++uid);
        const opener = document.activeElement;
        const overlay = el('div', 'sheet-overlay');
        const dlg = el('div', 'sheet sheet-' + (o.size || 'md'));
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', id + '-title');
        if (o.subtitle) dlg.setAttribute('aria-describedby', id + '-sub');
        dlg.tabIndex = -1;

        dlg.appendChild(el('div', 'sheet-handle'));
        const header = el('div', 'sheet-header');
        const heading = el('div', 'sheet-heading');
        const title = el('h2', 'sheet-title', o.title || '');
        title.id = id + '-title';
        heading.appendChild(title);
        if (o.subtitle) {
            const sub = el('p', 'sheet-subtitle', o.subtitle);
            sub.id = id + '-sub';
            heading.appendChild(sub);
        }
        header.appendChild(heading);
        const closeBtn = el('button', 'btn btn-ghost btn-icon btn-sm sheet-close');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = icon('x', 20);
        header.appendChild(closeBtn);
        dlg.appendChild(header);

        const errorBox = el('div', 'sheet-error');
        errorBox.setAttribute('role', 'alert');
        const body = el('div', 'sheet-body');
        if (o.body instanceof Node) body.appendChild(o.body);
        else if (o.body != null) body.innerHTML = String(o.body);
        dlg.appendChild(body);
        dlg.appendChild(errorBox);

        const actionButtons = [];
        const actions = Array.isArray(o.actions) ? o.actions : [];
        if (actions.length) {
            const footer = el('div', 'sheet-footer');
            const startGroup = el('div', 'sheet-footer-start');
            const endGroup = el('div', 'sheet-footer-end');
            actions.forEach((a) => {
                const variant = a.variant || 'secondary';
                const b = el('button', 'btn btn-' + (variant === 'danger' ? 'danger-text' : variant), a.label);
                b.type = 'button';
                b.addEventListener('click', async () => {
                    let result;
                    try {
                        result = typeof a.onClick === 'function' ? await a.onClick(ctx) : undefined;
                    } catch (err) {
                        console.error(err);
                        ctx.setError('Something went wrong. Please try again.');
                        return;
                    }
                    if (a.closes !== false && result !== false) ctx.close();
                });
                actionButtons.push(b);
                (variant === 'danger' ? startGroup : endGroup).appendChild(b);
            });
            if (startGroup.children.length) footer.appendChild(startGroup);
            footer.appendChild(endGroup);
            dlg.appendChild(footer);
        }

        overlay.appendChild(dlg);
        let closed = false;

        function close(reason) {
            if (closed) return;
            closed = true;
            const i = sheetStack.indexOf(ctx);
            if (i >= 0) sheetStack.splice(i, 1);
            document.removeEventListener('keydown', onKey, true);
            const finish = () => {
                overlay.remove();
                unlockScroll();
                if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
                    try { opener.focus({ preventScroll: true }); } catch (e) { void e; }
                }
                if (typeof o.onClose === 'function') {
                    try { o.onClose(reason); } catch (e) { console.error(e); }
                }
            };
            if (reducedMotion()) finish();
            else {
                overlay.classList.add('sheet-leaving');
                setTimeout(finish, 150);
            }
        }

        function onKey(e) {
            if (sheetStack[sheetStack.length - 1] !== ctx) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close('escape');
                return;
            }
            if (e.key !== 'Tab') return;
            const items = visible(dlg);
            if (!items.length) { e.preventDefault(); dlg.focus(); return; }
            const first = items[0];
            const last = items[items.length - 1];
            if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }

        const ctx = {
            el: dlg,
            body,
            close,
            setBusy(on) {
                dlg.classList.toggle('is-busy', !!on);
                dlg.setAttribute('aria-busy', on ? 'true' : 'false');
                actionButtons.forEach((b) => { b.disabled = !!on; });
            },
            setTitle(text) {
                title.textContent = text || '';
            },
            setError(text) {
                errorBox.textContent = text || '';
            },
        };

        closeBtn.addEventListener('click', () => close('close'));
        let downOnOverlay = false;
        overlay.addEventListener('mousedown', (e) => { downOnOverlay = e.target === overlay; });
        overlay.addEventListener('click', (e) => { if (e.target === overlay && downOnOverlay) close('backdrop'); });

        document.body.appendChild(overlay);
        lockScroll();
        sheetStack.push(ctx);
        document.addEventListener('keydown', onKey, true);

        let target = null;
        if (o.initialFocus) target = dlg.querySelector(o.initialFocus);
        if (!target) target = body.querySelector('input:not([type="hidden"]), select, textarea');
        if (!target) {
            const primary = actionButtons[actionButtons.length - 1];
            target = primary || closeBtn;
        }
        requestAnimationFrame(() => { try { target.focus({ preventScroll: true }); } catch (e) { void e; } });
        return ctx;
    }

    function confirmDialog(options) {
        const o = options || {};
        return new Promise((resolve) => {
            let settled = false;
            const done = (v) => { if (!settled) { settled = true; resolve(v); } };
            const body = el('p', 'muted', o.message || '');
            body.style.fontSize = 'var(--text-base)';
            sheet({
                title: o.title || 'Are you sure?',
                body,
                size: 'sm',
                onClose: () => done(false),
                actions: [
                    { label: o.cancelLabel || 'Cancel', variant: 'secondary', onClick: () => done(false) },
                    { label: o.confirmLabel || 'Confirm', variant: o.danger ? 'danger-solid' : 'primary', onClick: () => done(true) },
                ],
            });
        });
    }

    function promptDialog(options) {
        const o = options || {};
        return new Promise((resolve) => {
            let settled = false;
            const done = (v) => { if (!settled) { settled = true; resolve(v); } };
            const field = el('div', 'field');
            const id = 'ui-prompt-' + (++uid);
            const label = el('label', null, o.label || '');
            label.htmlFor = id;
            const input = el('input', 'input');
            input.id = id;
            input.type = o.inputType || 'text';
            input.value = o.value != null ? String(o.value) : '';
            if (o.placeholder) input.placeholder = o.placeholder;
            input.autocomplete = 'off';
            const err = el('div', 'field-error');
            err.id = id + '-err';
            err.setAttribute('role', 'alert');
            input.setAttribute('aria-describedby', err.id);
            if (o.label) field.appendChild(label);
            field.appendChild(input);
            field.appendChild(err);

            function submit(ctx) {
                const value = input.value;
                const problem = typeof o.validate === 'function' ? o.validate(value) : null;
                if (problem) {
                    err.textContent = problem;
                    input.setAttribute('aria-invalid', 'true');
                    field.classList.add('has-error');
                    input.focus();
                    return false;
                }
                done(value);
                return true;
            }

            const ctx = sheet({
                title: o.title || '',
                body: field,
                size: 'sm',
                initialFocus: '#' + id,
                onClose: () => done(null),
                actions: [
                    { label: o.cancelLabel || 'Cancel', variant: 'secondary', onClick: () => done(null) },
                    { label: o.confirmLabel || 'Save', variant: 'primary', onClick: submit },
                ],
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (submit(ctx)) ctx.close();
                }
            });
            input.addEventListener('input', () => {
                err.textContent = '';
                input.removeAttribute('aria-invalid');
                field.classList.remove('has-error');
            });
            requestAnimationFrame(() => input.select());
        });
    }

    let toastRegion = null;
    function region() {
        if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
        toastRegion = el('div', 'toast-region');
        toastRegion.setAttribute('role', 'status');
        toastRegion.setAttribute('aria-live', 'polite');
        toastRegion.setAttribute('aria-atomic', 'false');
        document.body.appendChild(toastRegion);
        return toastRegion;
    }

    function toast(message, options) {
        const o = options || {};
        const type = o.type === 'error' || o.type === 'info' ? o.type : 'success';
        const host = region();
        const bar = document.querySelector('[data-bottom-bar]');
        if (bar && bar.offsetParent !== null && !document.documentElement.classList.contains('sheet-open')) {
            host.style.bottom = (window.innerHeight - bar.getBoundingClientRect().top + 12) + 'px';
        } else host.style.bottom = '';
        Array.from(host.children).forEach((t) => {
            if (t.dataset.msg === String(message)) t.remove();
        });
        while (host.children.length >= 3) host.firstElementChild.remove();
        const t = el('div', 'toast toast-' + type);
        t.dataset.msg = String(message);
        const ic = el('span', 'toast-icon');
        ic.innerHTML = icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check', 18);
        t.appendChild(ic);
        t.appendChild(el('span', 'toast-message', String(message)));
        let timer = null;
        const dismiss = () => {
            if (timer) clearTimeout(timer);
            if (!t.isConnected) return;
            if (reducedMotion()) { t.remove(); return; }
            t.classList.add('is-leaving');
            setTimeout(() => t.remove(), 200);
        };
        if (o.action && o.action.label) {
            const a = el('button', 'toast-action', o.action.label);
            a.type = 'button';
            a.addEventListener('click', () => {
                dismiss();
                if (typeof o.action.onClick === 'function') o.action.onClick();
            });
            t.appendChild(a);
        }
        host.appendChild(t);
        const ms = o.ms || (o.action ? 7000 : type === 'error' ? 6000 : 4000);
        timer = setTimeout(dismiss, ms);
        return { dismiss };
    }

    let openMenu = null;
    function closeOpenMenu() {
        if (openMenu) openMenu.close();
    }

    function menu(anchor, items) {
        closeOpenMenu();
        const m = el('div', 'menu');
        m.setAttribute('role', 'menu');
        const buttons = [];
        (items || []).forEach((item) => {
            if (item.separator) {
                const s = el('hr', 'menu-separator');
                s.setAttribute('role', 'separator');
                m.appendChild(s);
                return;
            }
            const b = el('button', 'menu-item' + (item.danger ? ' danger' : ''));
            b.type = 'button';
            b.setAttribute('role', 'menuitem');
            b.tabIndex = -1;
            if (item.disabled) b.disabled = true;
            if (item.swatch) {
                const dot = el('span', 'cat-dot');
                dot.style.setProperty('--cat', item.swatch);
                b.appendChild(dot);
            } else if (item.icon) {
                const ic = el('span');
                ic.style.display = 'flex';
                ic.innerHTML = icon(item.icon, 18);
                b.appendChild(ic);
            }
            b.appendChild(el('span', 'menu-item-label', item.label));
            if (item.checked) {
                const c = el('span', 'menu-item-check');
                c.style.display = 'flex';
                c.innerHTML = icon('check', 16);
                b.appendChild(c);
                b.setAttribute('aria-checked', 'true');
            }
            b.addEventListener('click', () => {
                close();
                if (typeof item.onClick === 'function') item.onClick();
            });
            buttons.push(b);
            m.appendChild(b);
        });
        document.body.appendChild(m);
        if (anchor) anchor.setAttribute('aria-expanded', 'true');

        const rect = anchor ? anchor.getBoundingClientRect() : { left: 8, right: 8, top: 8, bottom: 8 };
        const mw = m.offsetWidth;
        const mh = m.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = rect.left;
        if (left + mw > vw - 8) left = Math.max(8, rect.right - mw);
        let top = rect.bottom + 6;
        if (top + mh > vh - 8) {
            const above = rect.top - mh - 6;
            top = above >= 8 ? above : Math.max(8, vh - mh - 8);
        }
        m.style.left = left + 'px';
        m.style.top = top + 'px';

        let closed = false;
        function close() {
            if (closed) return;
            closed = true;
            m.remove();
            document.removeEventListener('mousedown', onOutside, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
            if (anchor) {
                anchor.setAttribute('aria-expanded', 'false');
                if (document.contains(anchor)) { try { anchor.focus({ preventScroll: true }); } catch (e) { void e; } }
            }
            if (openMenu === handle) openMenu = null;
        }
        function onOutside(e) {
            if (!m.contains(e.target) && !(anchor && anchor.contains(e.target))) close();
        }
        function onKey(e) {
            const enabled = buttons.filter((b) => !b.disabled);
            const idx = enabled.indexOf(document.activeElement);
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); (enabled[(idx + 1) % enabled.length] || enabled[0] || m).focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (enabled[(idx - 1 + enabled.length) % enabled.length] || enabled[enabled.length - 1] || m).focus(); }
            else if (e.key === 'Home') { e.preventDefault(); if (enabled[0]) enabled[0].focus(); }
            else if (e.key === 'End') { e.preventDefault(); if (enabled.length) enabled[enabled.length - 1].focus(); }
            else if (e.key === 'Tab') { close(); }
        }
        document.addEventListener('mousedown', onOutside, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        const handle = { close, el: m };
        openMenu = handle;
        const checked = buttons.find((b) => b.getAttribute('aria-checked') === 'true' && !b.disabled);
        const firstEnabled = checked || buttons.find((b) => !b.disabled);
        if (firstEnabled) firstEnabled.focus({ preventScroll: true });
        else { m.tabIndex = -1; m.focus(); }
        return handle;
    }

    const emptyActions = new Map();
    let emptySeq = 0;
    document.addEventListener('click', (e) => {
        const t = e.target.closest ? e.target.closest('[data-ui-action]') : null;
        if (!t) return;
        const fn = emptyActions.get(t.getAttribute('data-ui-action'));
        if (fn) fn(e);
    });

    function emptyNode(options) {
        const o = options || {};
        const root = el('div', 'empty-state');
        if (o.icon) {
            const ic = el('div', 'empty-state-icon');
            ic.innerHTML = icon(o.icon, 26);
            root.appendChild(ic);
        }
        if (o.title) root.appendChild(el('h3', 'empty-state-title', o.title));
        if (o.text) root.appendChild(el('p', 'empty-state-text', o.text));
        const wrap = el('div', 'empty-state-actions');
        [[o.action, 'btn-primary'], [o.secondary, 'btn-ghost']].forEach(([a, cls]) => {
            if (!a || !a.label) return;
            let n;
            if (a.href) {
                n = el('a', 'btn ' + cls, a.label);
                n.href = a.href;
            } else {
                n = el('button', 'btn ' + cls, a.label);
                n.type = 'button';
                const key = 'ea' + (++emptySeq);
                n.setAttribute('data-ui-action', key);
                if (typeof a.onClick === 'function') n.addEventListener('click', a.onClick);
            }
            wrap.appendChild(n);
        });
        if (wrap.children.length) root.appendChild(wrap);
        return root;
    }

    function empty(options) {
        const o = options || {};
        const copy = Object.assign({}, o);
        const handlers = {};
        ['action', 'secondary'].forEach((k) => {
            if (o[k] && !o[k].href && typeof o[k].onClick === 'function') {
                const key = 'ea' + (++emptySeq);
                handlers[k] = key;
                emptyActions.set(key, o[k].onClick);
                copy[k] = { label: o[k].label };
            }
        });
        const node = emptyNode(copy);
        const btns = node.querySelectorAll('.empty-state-actions > *');
        let bi = 0;
        ['action', 'secondary'].forEach((k) => {
            if (!o[k] || !o[k].label) return;
            const b = btns[bi++];
            if (b && handlers[k]) b.setAttribute('data-ui-action', handlers[k]);
        });
        return node.outerHTML;
    }

    function monthKeyOf(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function shiftKey(key, delta) {
        if (window.Store && typeof window.Store.shiftMonth === 'function') return window.Store.shiftMonth(key, delta);
        const m = /^(\d{4})-(\d{2})$/.exec(key || '');
        if (!m) return key;
        return monthKeyOf(new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1));
    }
    function labelOf(key) {
        if (window.Store && typeof window.Store.monthLabel === 'function') return window.Store.monthLabel(key);
        const m = /^(\d{4})-(\d{2})$/.exec(key || '');
        if (!m) return '';
        return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    function monthStepper(container, options) {
        const o = options || {};
        let value = o.value;
        const root = el('div', 'month-stepper');
        root.setAttribute('role', 'group');
        root.setAttribute('aria-label', 'Month');
        const prev = el('button', 'month-stepper-btn');
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Previous month');
        prev.innerHTML = icon('chevron-left', 20);
        const label = el('button', 'month-stepper-label');
        label.type = 'button';
        label.setAttribute('aria-haspopup', 'menu');
        label.setAttribute('aria-expanded', 'false');
        const next = el('button', 'month-stepper-btn');
        next.type = 'button';
        next.setAttribute('aria-label', 'Next month');
        next.innerHTML = icon('chevron-right', 20);
        root.append(prev, label, next);
        const live = el('span', 'visually-hidden');
        live.setAttribute('aria-live', 'polite');
        root.appendChild(live);

        function keys() {
            return Array.isArray(o.keys) ? o.keys.slice() : (typeof o.keys === 'function' ? o.keys() : []);
        }
        function bounds() {
            const k = keys();
            const nowKey = monthKeyOf(new Date());
            const min = k.length ? k[k.length - 1] : null;
            let max = null;
            if (!o.allowFuture) max = k.length && k[0] > nowKey ? k[0] : nowKey;
            return { min, max };
        }
        function render() {
            const b = bounds();
            label.textContent = labelOf(value);
            live.textContent = labelOf(value);
            prev.disabled = !!(b.min && value <= b.min);
            next.disabled = !!(b.max && value >= b.max);
            label.disabled = keys().length < 2 && !o.allowFuture;
        }
        function go(key) {
            if (!key || key === value) return;
            value = key;
            render();
            if (typeof o.onChange === 'function') o.onChange(key);
        }
        prev.addEventListener('click', () => go(shiftKey(value, -1)));
        next.addEventListener('click', () => go(shiftKey(value, 1)));
        label.addEventListener('click', () => {
            const list = keys();
            if (!list.includes(value)) list.push(value);
            list.sort().reverse();
            menu(label, list.map((k) => ({ label: labelOf(k), checked: k === value, onClick: () => go(k) })));
        });
        container.innerHTML = '';
        container.appendChild(root);
        render();
        return { set(key) { value = key; render(); }, el: root };
    }

    function segmented(container, options) {
        const o = options || {};
        let value = o.value;
        const root = el('div', 'segmented');
        root.setAttribute('role', 'radiogroup');
        if (o.ariaLabel) root.setAttribute('aria-label', o.ariaLabel);
        const btns = (o.options || []).map((opt) => {
            const b = el('button', 'segmented-option', opt.label);
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.dataset.value = opt.value;
            root.appendChild(b);
            return b;
        });
        function render() {
            btns.forEach((b) => {
                const on = b.dataset.value === String(value);
                b.setAttribute('aria-checked', on ? 'true' : 'false');
                b.tabIndex = on || (!btns.some((x) => x.dataset.value === String(value)) && b === btns[0]) ? 0 : -1;
            });
        }
        function choose(b, fire) {
            value = (o.options.find((x) => String(x.value) === b.dataset.value) || {}).value;
            render();
            if (fire && typeof o.onChange === 'function') o.onChange(value);
        }
        root.addEventListener('click', (e) => {
            const b = e.target.closest('.segmented-option');
            if (b) choose(b, true);
        });
        root.addEventListener('keydown', (e) => {
            const i = btns.indexOf(document.activeElement);
            if (i < 0) return;
            let n = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
            else if (e.key === 'Home') n = 0;
            else if (e.key === 'End') n = btns.length - 1;
            if (n < 0) return;
            e.preventDefault();
            btns[n].focus();
            choose(btns[n], true);
        });
        container.innerHTML = '';
        container.appendChild(root);
        render();
        return { set(v) { value = v; render(); }, el: root };
    }

    function progress(fraction, options) {
        const o = options || {};
        const f = Math.max(0, Number(fraction) || 0);
        let tone = o.tone || 'auto';
        if (tone === 'auto') tone = f > 1 ? 'danger' : f >= 0.85 ? 'warning' : 'brand';
        const pct = Math.min(100, f * 100);
        const aria = o.label ? ' aria-label="' + esc(o.label) + '"' : '';
        return '<div class="progress progress-' + tone + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
            Math.round(Math.min(f, 1) * 100) + '"' + aria + '><span class="progress-bar" style="width:' + pct.toFixed(1) + '%"></span></div>';
    }

    function skeleton(rows) {
        const n = Math.max(1, rows == null ? 3 : rows);
        let html = '<div class="skeleton-rows" aria-hidden="true">';
        for (let i = 0; i < n; i++) {
            html += '<div class="skeleton-row"><span class="skeleton skeleton-circle"></span><span class="skeleton-text"><span class="skeleton-line"></span><span class="skeleton-line short"></span></span></div>';
        }
        return html + '</div>';
    }

    function debounce(fn, ms) {
        let t = null;
        const wrapped = function () {
            const args = arguments;
            const self = this;
            clearTimeout(t);
            t = setTimeout(() => fn.apply(self, args), ms == null ? 200 : ms);
        };
        wrapped.cancel = () => clearTimeout(t);
        return wrapped;
    }

    function toDate(v) {
        if (v instanceof Date) return v;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const d = new Date(v);
        return isNaN(d) ? null : d;
    }

    function formatDate(value, options) {
        const d = toDate(value);
        if (!d || isNaN(d)) return '';
        const style = (options && options.style) || 'short';
        const loc = window.Store && typeof window.Store.prefs === 'function' ? window.Store.prefs().locale : undefined;
        const today = new Date();
        const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
        const sameYear = d.getFullYear() === today.getFullYear();
        const shortFmt = () => d.toLocaleDateString(loc, sameYear
            ? { weekday: 'short', month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' });
        if (style === 'long') return d.toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        if (style === 'relative') {
            if (diff === 0) return 'Today';
            if (diff === 1) return 'Yesterday';
            if (diff === -1) return 'Tomorrow';
        }
        return shortFmt();
    }

    window.UI = {
        esc,
        icon,
        chip,
        sheet,
        confirm: confirmDialog,
        prompt: promptDialog,
        toast,
        menu,
        empty,
        emptyNode,
        monthStepper,
        segmented,
        progress,
        skeleton,
        debounce,
        formatDate,
        isMobile,
    };

    window.showNotification = function (message, type) {
        const t = type === 'error' ? 'error' : type === 'info' || type === 'warning' ? 'info' : 'success';
        toast(message, { type: t });
    };
})();
