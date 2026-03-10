/* ============================================
   Satoshi's Vision — Navigation Controller
   Unified nav behavior for all pages
   ============================================ */

(function () {
    'use strict';

    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.getElementById('mobileMenu');

    // Toggle mobile menu
    function toggleMenu() {
        if (!mobileMenu || !hamburger) return;
        const isOpen = mobileMenu.classList.toggle('active');
        hamburger.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    // Close menu
    function closeMenu() {
        if (!mobileMenu || !hamburger) return;
        mobileMenu.classList.remove('active');
        hamburger.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Hamburger click
    if (hamburger) {
        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMenu();
        });
    }

    // Close on mobile link click
    if (mobileMenu) {
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });

    // Close on outside tap
    document.addEventListener('click', function (e) {
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
                closeMenu();
            }
        }
    });

    // Active page highlighting
    var currentPath = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
    if (currentPath === '') currentPath = '/';

    var navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
    navLinks.forEach(function (link) {
        var href = link.getAttribute('href');
        if (!href) return;
        var linkPath = href.replace(/\/$/, '').replace(/\.html$/, '');
        if (linkPath === '' || linkPath === '/index' || linkPath === '.') linkPath = '/';
        if (linkPath === '.' || linkPath === './index') linkPath = '/';

        // Match current page
        if (linkPath === currentPath ||
            (currentPath === '/' && (linkPath === '/' || linkPath === '' || linkPath === '/index')) ||
            (linkPath !== '/' && currentPath.endsWith(linkPath))) {
            link.classList.add('active');
        }
    });

    // Nav scroll shadow
    var nav = document.querySelector('.nav');
    if (nav) {
        var lastScroll = 0;
        window.addEventListener('scroll', function () {
            var scrollY = window.scrollY;
            if (scrollY > 50) {
                nav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.5)';
            } else {
                nav.style.boxShadow = 'none';
            }
            lastScroll = scrollY;
        }, { passive: true });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                closeMenu();
                var offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 60;
                var top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });

    // Expose for inline onclick fallback
    window.toggleMenu = toggleMenu;
})();
