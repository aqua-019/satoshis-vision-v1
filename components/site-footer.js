/**
 * <site-footer> Web Component
 *
 * Usage:
 *   <site-footer></site-footer>                     – default (quote + links)
 *   <site-footer variant="minimal"></site-footer>    – nav links only
 *   <site-footer variant="custom">...</site-footer>  – keeps inner HTML as-is
 *
 * Attributes:
 *   variant – "default" (quote + external links), "minimal" (nav links only),
 *             "custom" (preserves child content inside <footer>)
 */
class SiteFooter extends HTMLElement {
    connectedCallback() {
        var variant = this.getAttribute('variant') || 'default';

        if (variant === 'custom') {
            var inner = this.innerHTML;
            this.innerHTML = '<footer>' + inner + '</footer>';
            return;
        }

        if (variant === 'minimal') {
            this.innerHTML =
                '<footer>' +
                    '<nav class="footer-nav">' +
                        '<a href="index.html">Home</a>' +
                        '<a href="secrets.html">Secret Threads</a>' +
                        '<a href="quotes.html">Quotes</a>' +
                        '<a href="timeline.html">Full Timeline</a>' +
                        '<a href="https://satoshi.nakamotoinstitute.org" target="_blank">Satoshi Institute</a>' +
                    '</nav>' +
                '</footer>';
            return;
        }

        // default variant
        this.innerHTML =
            '<footer>' +
                '<p class="footer-quote">\u201CI\u2019ve moved on to other things. It\u2019s in good hands with Gavin and everyone.\u201D</p>' +
                '<p class="footer-attribution">\u2014 Satoshi Nakamoto, Final Email, April 2011</p>' +
                '<div class="footer-links">' +
                    '<a href="https://satoshi.nakamotoinstitute.org" target="_blank">Satoshi Nakamoto Institute</a>' +
                    '<a href="https://getmonero.org" target="_blank">GetMonero.org</a>' +
                    '<a href="https://bitcoin.org" target="_blank">Bitcoin.org</a>' +
                '</div>' +
                '<p class="footer-copy">Educational resource. Not financial advice. DYOR.</p>' +
            '</footer>';
    }
}

customElements.define('site-footer', SiteFooter);
