// js/icons.js - SVG line-icon set + deterministic color assignment for categories.
// Replaces the old emoji icons. Icons are resolved from the category NAME, so
// stored emoji values are ignored and user-created categories still get an icon.

(function () {
    // Inner SVG markup for each icon key (24x24 viewBox, stroke-based).
    const ICON_PATHS = {
        cart: '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>',
        fuel: '<path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"></path><line x1="3" y1="21" x2="15" y2="21"></line><line x1="6" y1="8" x2="11" y2="8"></line><path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a2 2 0 0 0 4 0V9.5L18 5"></path>',
        coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="2" x2="6" y2="5"></line><line x1="10" y1="2" x2="10" y2="5"></line><line x1="14" y1="2" x2="14" y2="5"></line>',
        food: '<path d="M2 12h20a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z"></path><path d="M5 12a7 7 0 0 1 14 0"></path><line x1="2" y1="20" x2="22" y2="20"></line>',
        bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>',
        home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
        wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>',
        parking: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path>',
        washer: '<rect x="4" y="2" width="16" height="20" rx="2"></rect><circle cx="12" cy="13" r="5"></circle><line x1="7.5" y1="5.5" x2="7.51" y2="5.5"></line><line x1="11" y1="5.5" x2="11.01" y2="5.5"></line>',
        scissors: '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
        car: '<path d="M5 17H3v-4l2-5h11l3 5v4h-2"></path><path d="M5 8l1-3h9l1 3"></path><circle cx="7.5" cy="17" r="1.6"></circle><circle cx="16.5" cy="17" r="1.6"></circle><line x1="9" y1="17" x2="15" y2="17"></line>',
        phone: '<rect x="5" y="2" width="14" height="20" rx="2.5"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>',
        film: '<rect x="2" y="2" width="20" height="20" rx="2.5"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line>',
        repeat: '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>',
        transfer: '<line x1="17" y1="7" x2="7" y2="7"></line><polyline points="13 3 17 7 13 11"></polyline><line x1="7" y1="17" x2="17" y2="17"></line><polyline points="11 21 7 17 11 13"></polyline>',
        bank: '<line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 21 7 3 7"></polygon>',
        bus: '<rect x="4" y="3" width="16" height="14" rx="2"></rect><line x1="4" y1="11" x2="20" y2="11"></line><circle cx="8" cy="20" r="1.4"></circle><circle cx="16" cy="20" r="1.4"></circle><line x1="7" y1="7" x2="17" y2="7"></line>',
        health: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
        trendup: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>',
        tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>',
        gift: '<polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>',
        heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"></path>',
        plane: '<path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-1 1.6l4.2 3.2-2 2-2-.5a1 1 0 0 0-.9 1.7l2.4 1.9 1.9 2.4a1 1 0 0 0 1.7-.9l-.5-2 2-2 3.2 4.2a1 1 0 0 0 1.6-1z"></path>',
        dumbbell: '<path d="M6.5 6.5 17.5 17.5"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
        pill: '<path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"></path><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line>',
        wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>',
        zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',
    };

    // Ordered matchers: first keyword found in the (lowercased) category name wins.
    const MATCHERS = [
        [/grocery|groceries|supermarket|market/, 'cart'],
        [/gas|fuel|petrol/, 'fuel'],
        [/coffee|tea|cafe/, 'coffee'],
        [/food|drink|restaurant|dining|dine/, 'food'],
        [/shop|amazon|retail|clothing|store/, 'bag'],
        [/rent|mortgage|housing|home/, 'home'],
        [/insurance/, 'shield'],
        [/internet|wifi|broadband/, 'wifi'],
        [/parking/, 'parking'],
        [/laundry|dry clean/, 'washer'],
        [/haircut|salon|barber|grooming/, 'scissors'],
        [/\bcar\b|auto|vehicle|mechanic/, 'car'],
        [/phone|mobile|cell|wireless/, 'phone'],
        [/entertain|movie|cinema|stream/, 'film'],
        [/subscription|membership/, 'repeat'],
        [/transfer|zelle|venmo|payment/, 'transfer'],
        [/bank|fee|interest|atm/, 'bank'],
        [/transport|transit|uber|lyft|ride|travel/, 'bus'],
        [/flight|airline|air travel/, 'plane'],
        [/health|medical|doctor|clinic|dental/, 'health'],
        [/pharmacy|medicine|prescription|drug/, 'pill'],
        [/gym|fitness|workout|sport/, 'dumbbell'],
        [/book|education|school|tuition|course/, 'book'],
        [/gift|donation|charity/, 'gift'],
        [/kid|child|baby|family|pet/, 'heart'],
        [/utilit|electric|power|water|energy/, 'droplet'],
        [/income|salary|payroll|deposit|paycheck/, 'trendup'],
        [/saving|invest|wallet|cash/, 'wallet'],
        [/other|misc|uncategor/, 'grid'],
    ];

    // Curated color index (1..16) for common categories; unknowns hash to 1..15.
    const CURATED_COLORS = {
        groceries: 5, gas: 4, 'coffee and tea': 6, 'food & drink': 15, shopping: 2,
        rent: 1, insurance: 9, internet: 11, parking: 7, laundry: 14, haircut: 3,
        car: 8, phone: 10, entertainment: 12, subscriptions: 13, transfers: 14,
        banking: 7, transportation: 1, healthcare: 15, income: 5, others: 16,
    };

    function iconKeyFor(name) {
        const n = String(name || '').toLowerCase();
        for (const [re, key] of MATCHERS) {
            if (re.test(n)) return key;
        }
        return 'tag';
    }

    function hashIndex(name) {
        const s = String(name || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return (h % 15) + 1; // 1..15 (reserve 16 for neutral)
    }

    window.getCategoryColorIndex = function (name) {
        const key = String(name || '').toLowerCase().trim();
        if (CURATED_COLORS[key]) return CURATED_COLORS[key];
        return hashIndex(key);
    };

    window.getCategoryColorVar = function (name) {
        return 'var(--cat-' + window.getCategoryColorIndex(name) + ')';
    };

    // Returns an <svg> string for the category. size in px (default 20).
    window.getCategoryIcon = function (name, size) {
        const s = size || 20;
        const inner = ICON_PATHS[iconKeyFor(name)] || ICON_PATHS.tag;
        return '<svg class="cat-icon-svg" viewBox="0 0 24 24" width="' + s + '" height="' + s +
            '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner + '</svg>';
    };

    // Returns a self-contained colored icon "chip": circular tinted badge with the icon.
    // options: { size (chip px), icon (svg px) }
    window.getCategoryIconChip = function (name, options) {
        const opts = options || {};
        const chip = opts.size || 40;
        const iconSize = opts.icon || Math.round(chip * 0.5);
        const color = window.getCategoryColorVar(name);
        return '<span class="cat-chip" style="--cat:' + color + ';width:' + chip + 'px;height:' + chip +
            'px;">' + window.getCategoryIcon(name, iconSize) + '</span>';
    };

    // Generic UI icon accessor (for reuse across the app).
    window.getIcon = function (key, size) {
        const s = size || 20;
        const inner = ICON_PATHS[key];
        if (!inner) return '';
        return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
            '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner + '</svg>';
    };
})();
