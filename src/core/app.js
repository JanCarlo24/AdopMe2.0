import { appConfig } from '../../config/app.config.js';
import { firebaseConfig as defaultFirebaseConfig } from '../../config/firebase.config.js';
import { createListenerGroup } from '../shared/utils/listen.js';
import { userMessage } from '../shared/errors.js';
import { queryApp } from './dom.js';
import { resolveServices, selectBackend } from './backend.js';
import { createToast } from '../ui/toast.js';
import { createMotion } from '../ui/motion.js';
import { createMobileNav } from '../ui/mobile-nav.js';
import { createCatalogController } from '../modules/catalog/controller.js';
import { createAdoptionController } from '../modules/adoptions/controller.js';
import { createAuthController } from '../modules/auth/controller.js';
import { createCompatibilityController } from '../modules/compatibility/controller.js';
import { refuges } from '../modules/refuges/data.js';
import { createRefugeMapController } from '../modules/refuges/controller.js';
import { createRefugePanelController } from '../modules/refuge-panel/controller.js';
import { createThemeController } from '../modules/theme/controller.js';
import { computeImpactStats } from '../modules/stats/service.js';

export async function createApp({
  document,
  window,
  localStorage,
  sessionStorage,
  config = appConfig,
  firebaseConfig = defaultFirebaseConfig
}) {
  const decision = selectBackend({
    firebaseConfig,
    storage: localStorage,
    backendKey: config.keys.backend
  });
  if (decision.mode === 'firebase') {
    const results = document.querySelector('#results-count');
    if (results) results.textContent = 'Cargando catálogo…';
  }

  const services = await resolveServices({ window, localStorage, sessionStorage, config, firebaseConfig });
  const { catalog, favorites, adoptions, auth, compatibility, persistent } = services;
  const dom = queryApp(document);
  const toast = createToast(dom.authToast, window);
  const motion = createMotion({ document, window });
  const mobileNav = createMobileNav({ document, window });
  const shell = createListenerGroup();
  let stopAuth = () => {};

  const actions = {
    notify(message) {
      toast.show(message);
    },
    observe(root) {
      motion.observe(root);
    },
    renderPets() {
      catalogController.render();
    },
    renderRecommendations() {
      compatibilityController.renderRecommendations();
    },
    renderTracking() {
      adoptionController.renderTracking();
    },
    openAdoption(id) {
      adoptionController.openForm(id);
    },
    openDetail(id) {
      catalogController.openDetail(id);
    },
    openTracking() {
      adoptionController.openTracking();
    },
    askForAccount(message, pending) {
      authController.ask(message, pending);
    },
    afterCatalogChange() {
      catalogController.render();
      compatibilityController.renderRecommendations();
      paintStats();
    },
    afterRequestsChange() {
      paintStats();
      adoptionController.renderTracking();
      refugePanel.render();
    }
  };

  const catalogController = createCatalogController({
    document, window, dom, catalog, favorites, actions, config
  });
  const adoptionController = createAdoptionController({
    document, window, dom, catalog, adoptions, auth, actions, config
  });
  const authController = createAuthController({ document, window, dom, auth, actions });
  const compatibilityController = createCompatibilityController({
    document, dom, catalog, favorites, compatibility, actions
  });
  const refugeMap = createRefugeMapController({
    document, window, dom, refuges, mapConfig: config.map
  });
  const refugePanel = createRefugePanelController({
    document, window, dom, catalog, adoptions, auth, actions, config, backendKind: services.kind
  });
  const theme = createThemeController({
    document,
    storage: persistent,
    key: config.keys.theme,
    toggle: dom.themeToggle
  });

  function paintStats() {
    const stats = computeImpactStats(catalog.getPets(), adoptions.list());
    dom.statsAvailable.textContent = String(stats.available);
    dom.statsRequests.textContent = String(stats.requests);
    dom.statsFamilies.textContent = String(stats.families);
    dom.petCount.textContent = String(stats.available);
  }

  async function syncAccount(event) {
    if (event.reason === 'expired') actions.notify('Tu sesión expiró. Vuelve a iniciar sesión.');
    if (event.reason === 'error') actions.notify('No hay conexión con Firebase. Inténtalo de nuevo.');
    try {
      if (event.user) {
        await Promise.all([
          favorites.hydrate?.(),
          compatibility.hydrate?.(),
          adoptions.hydrate?.(),
          catalog.hydrate?.({ asAdmin: Boolean(auth.canManageRefuge?.()) })
        ]);
      } else {
        favorites.replace?.([]);
        compatibility.replace?.(null);
        adoptions.replace?.([]);
        if (catalog.hydrate) await catalog.hydrate({ asAdmin: false });
      }
    } catch (error) {
      actions.notify(userMessage(error, 'No pudimos sincronizar tu cuenta.'));
    }
    authController.updateTrigger();
    catalogController.render();
    compatibilityController.renderRecommendations();
    paintStats();
    adoptionController.renderTracking();
    if (document.querySelector('#refuge-dialog')?.open) refugePanel.render();
  }

  function bindShell() {
    document.querySelectorAll('[data-open-requests]').forEach((button) => {
      shell.on(button, 'click', () => {
        if (auth.current()) adoptionController.openTracking();
        else authController.ask('Inicia sesión para consultar el estado de tus solicitudes.', { tracking: true });
      });
    });
    document.querySelectorAll('[data-open-refuge]').forEach((button) => {
      shell.on(button, 'click', () => refugePanel.open());
    });
    document.querySelectorAll('[data-close-dialog]').forEach((button) => {
      shell.on(button, 'click', () => {
        const dialogId = button.dataset.closeDialog;
        if (dialogId !== 'tracking-dialog' && dialogId !== 'refuge-dialog') return;
        document.querySelector(`#${dialogId}`)?.close();
      });
    });
  }

  function start() {
    document.documentElement.dataset.backend = services.kind;
    const note = document.querySelector('.auth-demo-note');
    if (note && services.kind === 'firebase') {
      note.textContent = 'La cuenta vive en Firebase. La contraseña no se guarda en este navegador ni en la base de datos.';
    }
    if (services.kind !== 'firebase') {
      try {
        adoptions.migrate();
      } catch {
        // Una cuota llena no debe impedir ver el catálogo.
      }
      try {
        favorites.persist();
      } catch {
        // Igual que arriba: la lista en memoria sigue usable.
      }
    }
    theme.apply(persistent.getItem(config.keys.theme));
    bindShell();
    catalogController.bind();
    adoptionController.bind();
    authController.bind();
    compatibilityController.bind();
    refugeMap.bind();
    refugePanel.bind();
    theme.bind();
    mobileNav.bind();
    catalogController.renderFilters();
    catalogController.render();
    compatibilityController.renderRecommendations();
    paintStats();
    refugeMap.initialize();
    motion.observe(document);
    authController.updateTrigger();
    motion.bindParallax();
    if (typeof auth.subscribe === 'function') stopAuth = auth.subscribe((event) => { syncAccount(event); });
    if (services.notice) toast.show(services.notice);
  }

  function destroy() {
    stopAuth();
    auth.destroy?.();
    shell.destroy();
    catalogController.destroy();
    adoptionController.destroy();
    authController.destroy();
    compatibilityController.destroy();
    refugeMap.destroy();
    refugePanel.destroy();
    theme.destroy();
    mobileNav.destroy();
    motion.destroy();
    toast.destroy();
  }

  return { start, destroy, catalog, favorites, adoptions, auth, compatibility };
}
