import { userMessage } from '../../shared/errors.js';
import { filterCatalog, resultsLabel } from './model.js';
import { filterChips, petCard } from '../../ui/render/pets.js';
import { escapeHtml, safeImageUrl } from '../../shared/utils/html.js';
import { createListenerGroup } from '../../shared/utils/listen.js';

export function createCatalogController({ document, window, dom, catalog, favorites, actions, config }) {
  const listen = createListenerGroup();
  const filters = {
    category: 'Todas',
    age: 'Todos',
    size: 'Todos',
    savedOnly: false
  };

  function paintFavoriteCount() {
    dom.savedCount.textContent = String(favorites.count());
  }

  function renderFilters() {
    dom.ageFilters.innerHTML = filterChips(config.ageFilters, filters.age, 'age-filter');
    dom.sizeFilters.innerHTML = filterChips(config.sizeFilters, filters.size, 'size-filter');
  }

  function render() {
    const matchingPets = filterCatalog(catalog.getPets(), {
      term: dom.searchInput.value,
      category: filters.category,
      age: filters.age,
      size: filters.size,
      savedOnly: filters.savedOnly,
      isSaved: (id) => favorites.has(id)
    });

    dom.resultsCount.textContent = resultsLabel(matchingPets);
    dom.emptyState.hidden = matchingPets.length > 0;
    dom.petGrid.hidden = matchingPets.length === 0;
    dom.petGrid.innerHTML = matchingPets.map((pet, index) => petCard(pet, index, favorites.has(pet.id))).join('');
    dom.petGrid.classList.remove('is-refreshing');
    window.requestAnimationFrame(() => dom.petGrid.classList.add('is-refreshing'));
    actions.observe(dom.petGrid);
    paintFavoriteCount();
  }

  async function toggleFavorite(petId) {
    try {
      await favorites.toggle(petId);
    } catch (error) {
      actions.notify(userMessage(error, 'No pudimos guardar el favorito.'));
    }
    render();
    actions.renderRecommendations();
  }

  function openDetail(petId) {
    const pet = catalog.getPetById(petId);
    if (!pet) return;

    const isSaved = favorites.has(pet.id);
    const detailTags = [pet.especie, pet.edad, pet.raza, isSaved ? 'Favorito' : 'Disponible'];
    dom.petDetailTitle.textContent = pet.nombre;
    dom.petDetailBreed.textContent = pet.raza;
    dom.petDetailImage.src = safeImageUrl(pet.foto);
    dom.petDetailImage.alt = `${pet.especie} ${pet.nombre}, ${pet.raza}`;
    dom.petDetailStatus.textContent = pet.estado || 'Disponible';
    dom.petDetailTags.innerHTML = detailTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    dom.petDetailDescription.textContent = pet.descripcion || 'Una mascota que busca un hogar lleno de cariño y estabilidad.';
    dom.petDetailAge.textContent = pet.edad;
    dom.petDetailSpecies.textContent = pet.especie;
    dom.petDetailFavorite.textContent = isSaved ? 'Quitar de favoritos' : 'Guardar en favoritos';
    dom.petDetailFavorite.dataset.petId = String(pet.id);
    dom.petDetailAdopt.dataset.petId = String(pet.id);
    dom.petDetailDialog.showModal();
  }

  function resetFilters() {
    dom.searchInput.value = '';
    filters.category = 'Todas';
    filters.savedOnly = false;
    filters.age = 'Todos';
    filters.size = 'Todos';
    dom.savedFilter.classList.remove('is-active');
    dom.savedFilter.setAttribute('aria-pressed', 'false');
    document.querySelectorAll('.filter-button').forEach((button) => {
      const isActive = button.dataset.category === 'Todas';
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    renderFilters();
    render();
  }

  function bind() {
    listen.on(dom.filterGroup, 'click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      filters.category = button.dataset.category;
      document.querySelectorAll('.filter-button').forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle('is-active', isActive);
        filterButton.setAttribute('aria-pressed', String(isActive));
      });
      render();
    });

    listen.on(dom.ageFilters, 'click', (event) => {
      const button = event.target.closest('[data-age-filter]');
      if (!button) return;
      filters.age = button.dataset.ageFilter;
      renderFilters();
      render();
    });

    listen.on(dom.sizeFilters, 'click', (event) => {
      const button = event.target.closest('[data-size-filter]');
      if (!button) return;
      filters.size = button.dataset.sizeFilter;
      renderFilters();
      render();
    });

    listen.on(dom.searchInput, 'input', render);
    listen.on(dom.savedFilter, 'click', () => {
      filters.savedOnly = !filters.savedOnly;
      dom.savedFilter.classList.toggle('is-active', filters.savedOnly);
      dom.savedFilter.setAttribute('aria-pressed', String(filters.savedOnly));
      render();
    });

    listen.on(dom.petGrid, 'click', (event) => {
      const favoriteButtonNode = event.target.closest('[data-favorite]');
      const adoptButton = event.target.closest('[data-adopt]');
      const card = event.target.closest('.pet-card');

      if (favoriteButtonNode) {
        toggleFavorite(favoriteButtonNode.dataset.favorite);
        return;
      }
      if (adoptButton) {
        actions.openAdoption(adoptButton.dataset.adopt);
        return;
      }
      if (card?.dataset.openPet) openDetail(card.dataset.openPet);
    });

    listen.on(dom.petGrid, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('button, a, input, select, textarea')) return;
      const card = event.target.closest('.pet-card');
      if (!card?.dataset.openPet) return;
      event.preventDefault();
      openDetail(card.dataset.openPet);
    });

    listen.on(dom.petDetailFavorite, 'click', async () => {
      const petId = dom.petDetailFavorite.dataset.petId;
      if (!petId) return;
      try {
        await favorites.toggle(petId);
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos guardar el favorito.'));
      }
      render();
      actions.renderRecommendations();
      openDetail(petId);
    });

    listen.on(dom.petDetailAdopt, 'click', () => {
      const petId = dom.petDetailAdopt.dataset.petId;
      if (!petId) return;
      dom.petDetailDialog.close();
      actions.openAdoption(petId);
    });

    listen.on(document.querySelector('#pet-detail-close'), 'click', () => dom.petDetailDialog.close());
    listen.on(dom.petDetailDialog, 'click', (event) => {
      if (event.target === dom.petDetailDialog) dom.petDetailDialog.close();
    });
    listen.on(dom.resetSearch, 'click', resetFilters);
    listen.on(document, 'keydown', (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        dom.searchInput.focus();
      }
    });
  }

  return { render, renderFilters, bind, openDetail, paintFavoriteCount, destroy: () => listen.destroy() };
}
