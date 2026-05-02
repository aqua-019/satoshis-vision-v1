/**
 * GenUI Inspector — reusable hover/click → detail panel.
 * Parallels the legal-tooltips pattern from Prompt P.
 */

let inspectorEl = null;
let activeActorId = null;

function getOrCreate() {
    if (inspectorEl) return inspectorEl;
    inspectorEl = document.querySelector('#sim-inspector') ||
                   document.createElement('div');
    inspectorEl.className = 'genui-inspector';
    inspectorEl.setAttribute('role', 'tooltip');
    inspectorEl.hidden = true;
    if (!inspectorEl.parentNode) document.body.appendChild(inspectorEl);
    return inspectorEl;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

export function showInspector(actor, panelTitle, fields, anchorEl) {
    const el = getOrCreate();

    let html = `<div class="genui-inspector-title">${escapeHtml(panelTitle)}</div>`;
    for (const field of fields) {
        const value = field.valueFromActor.split('.').reduce(
            (obj, key) => (obj == null ? obj : obj[key]),
            actor
        );
        html += `
            <div class="genui-inspector-field">
                <span class="genui-inspector-field-label">${escapeHtml(field.label)}</span>
                <span class="genui-inspector-field-value">${escapeHtml(String(value ?? '—'))}</span>
            </div>
        `;
    }
    el.innerHTML = html;

    /* Position next to anchor, clamping to viewport */
    el.hidden = false;
    const rect = anchorEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    let top = rect.top - elRect.height - 8;
    let left = rect.left + (rect.width - elRect.width) / 2;

    if (top < 8) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - elRect.width - 8));

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    activeActorId = actor.id;
}

export function hideInspector() {
    if (inspectorEl) inspectorEl.hidden = true;
    activeActorId = null;
}

export function getActiveActorId() {
    return activeActorId;
}

/* Global click-outside / Esc dismiss */
document.addEventListener('click', e => {
    if (!e.target.closest('.genui-inspector') && !e.target.closest('[data-genui-actor]')) {
        hideInspector();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideInspector();
});
