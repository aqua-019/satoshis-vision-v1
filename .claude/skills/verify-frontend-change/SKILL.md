---
name: verify-frontend-change
description: Verify any UI change end-to-end before declaring it done. Use after every frontend or payment-UI edit, before reporting completion.
---

# Verifying frontend changes

Never report a UI change as complete based on a successful edit alone. Verify it the way a human reviewer would:

1. Start the dev server and open the edited page in the browser.
2. Interact with the change directly. For a new control (button, input, toggle): activate it, confirm the expected state change, and capture before/after screenshots.
3. Check the browser console: zero new errors or warnings.
4. Check responsive rendering at 360px, 768px, and 1280px widths.
5. Run the project's tests and linter if present.

## Additional checks for payment/checkout surfaces

6. Confirm the displayed address and QR encode the exact same payable string; copy button copies it verbatim.
7. Confirm amounts render at full precision for the currency (8 decimals BTC/LTC, 12 XMR) and the unit label is correct.
8. Grep the built client bundle/output for key material or RPC credentials — result must be empty.
9. Confirm the page is served without mixed content and third-party scripts are absent from checkout.

If any step fails, fix the issue and rerun from step 1 — do not hand back partially verified work. The more quantitative the check (test counts, Lighthouse scores, console-error counts), the better it feeds `/goal` stop criteria.
