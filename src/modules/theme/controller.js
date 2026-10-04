import { createListenerGroup } from '../../shared/utils/listen.js';

export function createThemeController({ document, storage, key, toggle }) {
  const listen = createListenerGroup();

  function apply(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    const icon = toggle.querySelector('.theme-toggle-icon');
    const text = toggle.querySelector('.theme-toggle-text');
    const isDark = nextTheme === 'dark';
    if (icon) icon.textContent = isDark ? '☾' : '☼';
    if (text) text.textContent = isDark ? 'Claro' : 'Oscuro';
    toggle.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    try {
      storage.setItem(key, nextTheme);
    } catch {
      // El tema sigue aplicado en esta visita aunque el navegador rechace la escritura.
    }
    return nextTheme;
  }

  function bind() {
    listen.on(toggle, 'click', () => {
      apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  return { apply, bind, destroy: () => listen.destroy() };
}
