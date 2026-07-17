// js/theme.js - Light/dark theme controller and toggle injection.
// The pre-paint <head> snippet already sets data-theme to avoid a flash; this
// file keeps it in sync, reacts to system changes, and renders the toggle.

(function () {
    const STORAGE_KEY = 'sahabBudget_theme'; // 'light' | 'dark' | 'system'

    function storedPref() {
        try { return localStorage.getItem(STORAGE_KEY) || 'system'; } catch (e) { return 'system'; }
    }

    function systemPrefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function resolvedTheme(pref) {
        if (pref === 'light' || pref === 'dark') return pref;
        return systemPrefersDark() ? 'dark' : 'light';
    }

    function applyTheme(pref) {
        const theme = resolvedTheme(pref);
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleUI(theme);
        // Keep the browser UI (address bar) in sync
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#0f172a');
    }

    function setPref(pref) {
        try { localStorage.setItem(STORAGE_KEY, pref); } catch (e) { /* ignore */ }
        applyTheme(pref);
    }

    window.getThemePreference = storedPref;
    window.setThemePreference = setPref;
    window.toggleTheme = function () {
        const current = resolvedTheme(storedPref());
        setPref(current === 'dark' ? 'light' : 'dark');
    };

    const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
    const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    function updateToggleUI(theme) {
        document.querySelectorAll('.theme-toggle').forEach((btn) => {
            btn.innerHTML = theme === 'dark' ? SUN : MOON;
            const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
        });
        document.querySelectorAll('.theme-toggle-mobile').forEach((btn) => {
            const label = theme === 'dark' ? 'Light mode' : 'Dark mode';
            btn.innerHTML = (theme === 'dark' ? SUN : MOON) + '<span>' + label + '</span>';
        });
    }

    function injectToggle() {
        // Desktop: into header actions (before other icon buttons)
        const actions = document.querySelector('.header-actions');
        if (actions && !actions.querySelector('.theme-toggle')) {
            const btn = document.createElement('button');
            btn.className = 'header-icon-btn theme-toggle';
            btn.type = 'button';
            btn.addEventListener('click', window.toggleTheme);
            actions.insertBefore(btn, actions.firstChild);
        }
        // Mobile: a labeled row inside the nav drawer
        const mobileNav = document.getElementById('mobileNav');
        if (mobileNav && !mobileNav.querySelector('.theme-toggle-mobile')) {
            const btn = document.createElement('button');
            btn.className = 'nav-btn theme-toggle-mobile';
            btn.type = 'button';
            btn.addEventListener('click', window.toggleTheme);
            mobileNav.appendChild(btn);
        }
        applyTheme(storedPref());
    }

    // React to system changes only while preference is 'system'
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (storedPref() === 'system') applyTheme('system');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggle);
    } else {
        injectToggle();
    }
})();
