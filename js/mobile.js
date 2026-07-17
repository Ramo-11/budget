function toggleMobileMenu() {
    const nav = document.getElementById('mobileNav');
    const overlay = document.getElementById('navOverlay');
    const toggle = document.querySelector('.menu-toggle');

    nav.classList.toggle('active');
    overlay.classList.toggle('active');
    toggle.classList.toggle('active');

    // Prevent body scroll when menu is open
    document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
}

function closeMobileMenu() {
    const nav = document.getElementById('mobileNav');
    const overlay = document.getElementById('navOverlay');
    const toggle = document.querySelector('.menu-toggle');
    if (nav) nav.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (toggle) toggle.classList.remove('active');
    document.body.style.overflow = '';
}
window.closeMobileMenu = closeMobileMenu;

// Initialize mobile menu visibility on load
function initializeMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    if (toggle && window.innerWidth <= 768) {
        toggle.style.display = 'flex';
    }
}

// Show hamburger on mobile
document.addEventListener('DOMContentLoaded', () => {
    // Initialize on load
    initializeMobileMenu();

    // Close the drawer when a navigation link or the in-drawer Help button is
    // clicked. The theme toggle is intentionally left out so the user can see
    // the theme change with the drawer still open. Delegated so it also covers
    // controls injected after load.
    const nav = document.getElementById('mobileNav');
    if (nav) {
        nav.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const target = e.target.closest('.nav-btn, .help-btn');
            if (target && !target.classList.contains('theme-toggle-mobile')) {
                closeMobileMenu();
            }
        });
    }
});

window.addEventListener('resize', () => {
    const toggle = document.querySelector('.menu-toggle');
    if (toggle) {
        if (window.innerWidth <= 768) {
            toggle.style.display = 'flex';
        } else {
            toggle.style.display = 'none';
        }
    }

    // Close menu on resize to desktop
    if (window.innerWidth > 768) {
        const nav = document.getElementById('mobileNav');
        const overlay = document.getElementById('navOverlay');
        const toggle = document.querySelector('.menu-toggle');

        if (nav) nav.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (toggle) toggle.classList.remove('active');
        document.body.style.overflow = '';
    }
});
