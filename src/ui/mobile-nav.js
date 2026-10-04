import { createListenerGroup } from '../shared/utils/listen.js';

const MOBILE_QUERY = '(max-width: 700px)';

export function createMobileNav({ document, window }) {
  const listen = createListenerGroup();
  const toggle = document.querySelector('#nav-toggle');
  const nav = document.querySelector('#main-nav');
  if (!toggle || !nav) {
    throw new Error('Falta el botón o el menú de navegación.');
  }

  let open = false;

  function setOpen(next, { restoreFocus = false } = {}) {
    open = next;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (!open && restoreFocus) {
      window.setTimeout(() => toggle.focus(), 0);
    }
  }

  function close(options) {
    if (!open) return;
    setOpen(false, options);
  }

  function onToggleClick() {
    setOpen(!open);
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !open) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    close({ restoreFocus: true });
  }

  function onDocumentClick(event) {
    if (!open) return;
    const target = event.target;
    if (nav.contains(target) || toggle.contains(target)) return;
    close({ restoreFocus: true });
  }

  function onNavClick(event) {
    const actionable = event.target.closest('a, button');
    if (!actionable || !nav.contains(actionable)) return;
    const opensDialog = actionable.matches('button');
    close({ restoreFocus: !opensDialog });
  }

  function onMediaChange(event) {
    if (!event.matches) close({ restoreFocus: false });
  }

  function bind() {
    listen.on(toggle, 'click', onToggleClick);
    listen.on(document, 'keydown', onKeydown);
    listen.on(document, 'click', onDocumentClick);
    listen.on(nav, 'click', onNavClick);
    listen.on(window.matchMedia(MOBILE_QUERY), 'change', onMediaChange);
  }

  return { bind, close, destroy: () => listen.destroy() };
}
