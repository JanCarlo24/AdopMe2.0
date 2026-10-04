import { escapeHtml } from '../../shared/utils/html.js';
import { createListenerGroup } from '../../shared/utils/listen.js';
import { refugeListItem } from '../../ui/render/management.js';

export function createRefugeMapController({ document, window, dom, refuges, mapConfig }) {
  const listen = createListenerGroup();
  let map = null;
  const markers = new Map();

  function popup(refuge) {
    return `<strong>${escapeHtml(refuge.nombre)}</strong><br>${escapeHtml(refuge.direccion)}`;
  }

  function showFallback() {
    const message = document.createElement('p');
    message.className = 'map-fallback';
    message.textContent = 'El mapa interactivo no está disponible ahora. Consulta los refugios de la lista.';
    dom.refugeMapElement.replaceChildren(message);
  }

  function focus(refuge) {
    if (!map) return;
    map.setView([refuge.lat, refuge.lng], mapConfig.focusZoom);
    map.closePopup();
    markers.get(refuge.id)?.openPopup();
  }

  function initialize() {
    dom.refugeList.innerHTML = refuges.map((refuge, index) => refugeListItem(refuge, index)).join('');
    if (!window.L) {
      showFallback();
      return;
    }

    map = window.L.map(dom.refugeMapElement, { scrollWheelZoom: false }).setView(mapConfig.center, mapConfig.zoom);
    window.L.tileLayer(mapConfig.tileUrl, { attribution: mapConfig.attribution }).addTo(map);
    refuges.forEach((refuge) => {
      const marker = window.L.marker([refuge.lat, refuge.lng]).addTo(map).bindPopup(popup(refuge));
      markers.set(refuge.id, marker);
    });
  }

  function bind() {
    listen.on(dom.refugeList, 'click', (event) => {
      const button = event.target.closest('[data-refuge-id]');
      const refuge = refuges.find((entry) => entry.id === button?.dataset.refugeId);
      if (refuge) focus(refuge);
    });
  }

  function destroy() {
    listen.destroy();
    map?.remove();
    map = null;
    markers.clear();
  }

  return { initialize, bind, destroy };
}
