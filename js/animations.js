/* ============================================
   Satoshi's Vision — Scroll Animations
   Shared IntersectionObserver-based animations
   ============================================ */

(function () {
    'use strict';

    // Scroll-triggered fade-in using IntersectionObserver
    var fadeObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    // Observe all fade-in elements
    function initFadeAnimations() {
        document.querySelectorAll('.fade-in').forEach(function (el) {
            fadeObserver.observe(el);
        });
    }

    // Staggered children animation
    var staggerObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var children = entry.target.querySelectorAll('.fade-in');
                children.forEach(function (child, i) {
                    setTimeout(function () {
                        child.classList.add('visible');
                    }, i * 100);
                });
                staggerObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    function initStaggerAnimations() {
        document.querySelectorAll('.stagger-children').forEach(function (el) {
            staggerObserver.observe(el);
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initFadeAnimations();
            initStaggerAnimations();
        });
    } else {
        initFadeAnimations();
        initStaggerAnimations();
    }
})();
