
(function () {
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

    const UI_ICON_PATHS = {
        "home": '<path d="m3 10 9-7 9 7"/><path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"/>',
        "list": '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
        "wallet": '<path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
        "chart": '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/>',
        "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        "plus": '<path d="M12 5v14"/><path d="M5 12h14"/>',
        "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
        "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
        "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        "check": '<path d="M20 6 9 17l-5-5"/>',
        "chevron-left": '<path d="m15 18-6-6 6-6"/>',
        "chevron-right": '<path d="m9 18 6-6-6-6"/>',
        "chevron-down": '<path d="m6 9 6 6 6-6"/>',
        "more": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
        "trash": '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        "undo": '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
        "edit": '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        "note": '<path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
        "filter": '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
        "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
        "repeat": '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
        "target": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        "piggy": '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>',
        "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
        "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
        "swap": '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
        "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        "shield": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
        "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        "eye-off": '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="m2 2 20 20"/>',
        "help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
        "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        "alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        "lightbulb": '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
        "tag": '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
        "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        "monitor": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
        "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        "file": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
        "refresh": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        "external": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        "copy": '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        "grip": '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
        "sort": '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>',
        "keyboard": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 16h8"/>',
        "wand": '<path d="m15 4 5 5L9 20l-5-5Z"/><path d="m14 5 5 5"/>',
    };

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
        [/travel|flight|airline|vacation|hotel|trip/, 'plane'],
        [/transport|transit|uber|lyft|ride/, 'bus'],
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

    const CURATED_COLORS = {
        groceries: 5, gas: 4, 'coffee and tea': 6, 'food & drink': 15, shopping: 2,
        rent: 1, insurance: 9, internet: 11, parking: 7, laundry: 14, haircut: 3,
        car: 8, phone: 10, entertainment: 12, subscriptions: 13, transfers: 14,
        banking: 7, transportation: 1, healthcare: 15, income: 5, others: 16,
        travel: 11, utilities: 6, fitness: 4, education: 2, 'gifts & donations': 3,
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
        return (h % 15) + 1;
    }

    window.getCategoryColorIndex = function (name) {
        const key = String(name || '').toLowerCase().trim();
        if (CURATED_COLORS[key]) return CURATED_COLORS[key];
        return hashIndex(key);
    };

    window.getCategoryColorVar = function (name) {
        return 'var(--cat-' + window.getCategoryColorIndex(name) + ')';
    };

    window.getCategoryIcon = function (name, size) {
        const s = size || 20;
        const inner = ICON_PATHS[iconKeyFor(name)] || ICON_PATHS.tag;
        return '<svg class="cat-icon-svg" viewBox="0 0 24 24" width="' + s + '" height="' + s +
            '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner + '</svg>';
    };

    window.getCategoryIconChip = function (name, options) {
        const opts = options || {};
        const chip = opts.size || 40;
        const iconSize = opts.icon || Math.round(chip * 0.5);
        const color = window.getCategoryColorVar(name);
        return '<span class="cat-chip" style="--cat:' + color + ';width:' + chip + 'px;height:' + chip +
            'px;">' + window.getCategoryIcon(name, iconSize) + '</span>';
    };

    window.getIcon = function (key, size) {
        const s = size || 20;
        const inner = UI_ICON_PATHS[key] || ICON_PATHS[key];
        if (!inner) return '';
        return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
            '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner + '</svg>';
    };
})();
