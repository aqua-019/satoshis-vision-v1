/* ============================================
   Satoshi's Vision — Particle Background
   ============================================ */

(function () {
    'use strict';

    function createParticles() {
        var container = document.getElementById('particles');
        if (!container) return;

        var isMobile = window.innerWidth < 768;
        var count = isMobile ? 15 : 35;

        for (var i = 0; i < count; i++) {
            var particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.background = Math.random() > 0.5 ? '#F7931A' : '#FF6600';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (10 + Math.random() * 10) + 's';
            particle.style.width = (2 + Math.random() * 3) + 'px';
            particle.style.height = particle.style.width;
            container.appendChild(particle);
        }
    }

    // Respect prefers-reduced-motion
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!motionQuery.matches) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createParticles);
        } else {
            createParticles();
        }
    }
})();
