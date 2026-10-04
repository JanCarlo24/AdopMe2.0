import { userMessage } from '../../shared/errors.js';
import { createListenerGroup } from '../../shared/utils/listen.js';
import { managedPetRow, managedRequestRow } from '../../ui/render/management.js';

export function createRefugePanelController({ document, window, dom, catalog, adoptions, auth, actions, config, backendKind = 'local' }) {
  const listen = createListenerGroup();

  function renderPets() {
    const pets = catalog.getPets();
    dom.managedPets.innerHTML = pets.length === 0
      ? '<p class="panel-empty">Aún no hay mascotas publicadas.</p>'
      : pets.map((pet) => managedPetRow(pet, config.petStatuses)).join('');
  }

  function renderRequests() {
    const requests = adoptions.list();
    dom.panelRequestCount.textContent = String(requests.length);
    dom.managedRequests.innerHTML = requests.length === 0
      ? '<p class="panel-empty">Todavía no hay solicitudes por revisar.</p>'
      : requests.map((request) => managedRequestRow(request, config.requestStatuses)).join('');
  }

  function render() {
    renderPets();
    renderRequests();
  }

  function setTab(tab) {
    const showRequests = tab === 'requests';
    document.querySelectorAll('[data-refuge-tab]').forEach((button) => {
      const active = button.dataset.refugeTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelector('#refuge-pets-view').hidden = showRequests;
    document.querySelector('#refuge-requests-view').hidden = !showRequests;
  }

  function canManage() {
    return typeof auth?.canManageRefuge === 'function' ? auth.canManageRefuge() : true;
  }

  function open() {
    setTab('pets');
    render();
    const disclaimer = document.querySelector('.panel-disclaimer');
    if (backendKind === 'firebase' && !canManage()) {
      dom.petFormFeedback.textContent = 'Este panel escribe en Firebase solo si tu uid está en admins/{uid}.';
      if (disclaimer) disclaimer.textContent = 'Tu cuenta no es de refugio. Las lecturas públicas siguen disponibles; las altas las hace un administrador.';
    } else if (backendKind === 'firebase' && disclaimer) {
      disclaimer.textContent = 'Los cambios se guardan en Firebase para esta cuenta de refugio.';
    }
    dom.refugeDialog.showModal();
  }

  function bind() {
    listen.on(document.querySelector('.refuge-tabs'), 'click', (event) => {
      const tab = event.target.closest('[data-refuge-tab]');
      if (tab) setTab(tab.dataset.refugeTab);
    });

    listen.on(dom.petCreateForm, 'submit', async (event) => {
      event.preventDefault();
      const submitButton = dom.petCreateForm.querySelector('[type="submit"]');
      const payload = Object.fromEntries(new FormData(dom.petCreateForm).entries());
      const file = dom.petCreateForm.elements.fotoArchivo?.files?.[0];
      if (file && file.size) payload.fotoArchivo = file;
      submitButton.disabled = true;
      dom.petFormFeedback.textContent = 'Publicando…';
      try {
        await catalog.addPet(payload);
        dom.petCreateForm.reset();
        dom.petFormFeedback.textContent = backendKind === 'firebase'
          ? 'Mascota publicada en Firebase.'
          : 'Mascota publicada en el catálogo de este navegador.';
        actions.notify('Mascota publicada correctamente.');
        actions.afterCatalogChange();
        renderPets();
      } catch (error) {
        dom.petFormFeedback.textContent = userMessage(error, 'No pudimos publicar la mascota.');
      } finally {
        submitButton.disabled = false;
      }
    });

    listen.on(dom.managedPets, 'change', async (event) => {
      const statusSelect = event.target.closest('[data-pet-status]');
      if (!statusSelect) return;
      try {
        const pet = await catalog.setStatus(statusSelect.dataset.petStatus, statusSelect.value, config.petStatuses);
        if (!pet) return;
        actions.afterCatalogChange();
        renderPets();
        actions.notify(`Estado de ${pet.nombre} actualizado.`);
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos actualizar el estado.'));
        renderPets();
      }
    });

    listen.on(dom.managedPets, 'click', async (event) => {
      const removeButton = event.target.closest('[data-delete-pet]');
      if (!removeButton) return;
      const pet = catalog.getPetById(removeButton.dataset.deletePet);
      if (!pet || !window.confirm(`¿Eliminar a ${pet.nombre} del catálogo?`)) return;
      try {
        await catalog.remove(pet.id);
        actions.afterCatalogChange();
        renderPets();
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos eliminar la mascota.'));
      }
    });

    listen.on(dom.managedRequests, 'change', async (event) => {
      const statusSelect = event.target.closest('[data-request-status]');
      if (!statusSelect || !config.requestStatuses.includes(statusSelect.value)) return;
      try {
        const updated = await adoptions.update(statusSelect.dataset.requestStatus, {
          estadoSolicitud: statusSelect.value,
          actualizado: new Date().toISOString()
        });
        if (!updated) return;
        if (updated.estadoSolicitud === 'Adopción completada') {
          await catalog.markAdopted(updated.mascotaId);
          actions.afterCatalogChange();
        }
        actions.afterRequestsChange();
        renderRequests();
        actions.notify(`Solicitud actualizada a ${updated.estadoSolicitud}.`);
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos actualizar la solicitud.'));
      }
    });
  }

  return { bind, render, open, destroy: () => listen.destroy() };
}
