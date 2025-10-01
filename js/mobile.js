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

    // Close menu when clicking nav links
    const navLinks = document.querySelectorAll('.nav-btn');
    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const nav = document.getElementById('mobileNav');
                const overlay = document.getElementById('navOverlay');
                const toggle = document.querySelector('.menu-toggle');

                if (nav) nav.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                if (toggle) toggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
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
