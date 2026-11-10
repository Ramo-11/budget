(function () {
    const STORAGE_KEY = 'sahabBudget_theme';
    const HIDE_KEY = 'sahabBudget_hideAmounts';
    const META_COLORS = { light: '#f6f7f9', dark: '#0b0c0f' };

    function storedPref() {
        try { return localStorage.getItem(STORAGE_KEY) || 'system'; } catch (e) { return 'system'; }
    }

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function resolvedTheme(pref) {
        if (pref === 'light' || pref === 'dark') return pref;
        return systemPrefersDark() ? 'dark' : 'light';
    }

    function applyTheme(pref) {
        const theme = resolvedTheme(pref);
        document.documentElement.setAttribute('data-theme', theme);
        const metas = document.querySelectorAll('meta[name="theme-color"]');
        metas.forEach((m) => {
            m.removeAttribute('media');
            m.setAttribute('content', META_COLORS[theme]);
        });
        try { window.dispatchEvent(new CustomEvent('budget:theme', { detail: { theme, pref } })); } catch (e) { void e; }
    }

    function setPref(pref) {
        const value = pref === 'light' || pref === 'dark' ? pref : 'system';
        try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { void e; }
        applyTheme(value);
    }

    window.getThemePreference = storedPref;
    window.setThemePreference = setPref;
    window.getResolvedTheme = () => resolvedTheme(storedPref());
    window.toggleTheme = function () {
        setPref(resolvedTheme(storedPref()) === 'dark' ? 'light' : 'dark');
    };

    window.getHideAmounts = function () {
        try { return JSON.parse(localStorage.getItem(HIDE_KEY) || 'false') === true; } catch (e) { return false; }
    };
    window.setHideAmounts = function (on) {
        const value = !!on;
        try { localStorage.setItem(HIDE_KEY, JSON.stringify(value)); } catch (e) { void e; }
        document.documentElement.classList.toggle('hide-amounts', value);
        try { window.dispatchEvent(new CustomEvent('budget:hideamounts', { detail: { hidden: value } })); } catch (e) { void e; }
    };

    document.documentElement.classList.toggle('hide-amounts', window.getHideAmounts());

    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => { if (storedPref() === 'system') applyTheme('system'); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) applyTheme(storedPref());
        if (e.key === HIDE_KEY) document.documentElement.classList.toggle('hide-amounts', window.getHideAmounts());
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyTheme(storedPref()));
    else applyTheme(storedPref());
})();
