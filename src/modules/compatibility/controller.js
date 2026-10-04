import { userMessage } from '../../shared/errors.js';
import { createListenerGroup } from '../../shared/utils/listen.js';
import { quizResultItem, recommendationCard } from '../../ui/render/pets.js';

export function createCompatibilityController({ document, dom, catalog, favorites, compatibility, actions }) {
  const listen = createListenerGroup();

  function renderRecommendations() {
    const recommended = compatibility.recommended(catalog.getPets());
    dom.recommendationGrid.innerHTML = recommended.map((pet) => recommendationCard(
      pet,
      favorites.has(pet.id),
      compatibility.score(pet)
    )).join('');
    actions.observe(dom.recommendationGrid);
  }

  function renderQuizResults() {
    const matches = compatibility.recommended(catalog.getPets());
    dom.quizResultList.innerHTML = matches.map((pet) => quizResultItem(pet, compatibility.score(pet))).join('');
  }

  function bind() {
    document.querySelectorAll('[data-open-quiz]').forEach((button) => {
      listen.on(button, 'click', () => {
        dom.quizFormView.hidden = false;
        dom.quizResult.hidden = true;
        const preferences = compatibility.get();
        if (preferences) {
          Object.entries(preferences).forEach(([name, value]) => {
            const field = dom.compatibilityForm.elements[name];
            if (field) field.value = value;
          });
        }
        dom.compatibilityDialog.showModal();
      });
    });

    listen.on(dom.compatibilityForm, 'submit', async (event) => {
      event.preventDefault();
      try {
        await compatibility.save(Object.fromEntries(new FormData(dom.compatibilityForm).entries()));
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos guardar tus preferencias.'));
        return;
      }
      renderRecommendations();
      renderQuizResults();
      dom.quizFormView.hidden = true;
      dom.quizResult.hidden = false;
    });

    listen.on(document.querySelector('#quiz-close'), 'click', () => dom.compatibilityDialog.close());
    listen.on(document.querySelector('#quiz-retry'), 'click', () => {
      dom.quizResult.hidden = true;
      dom.quizFormView.hidden = false;
    });
    listen.on(dom.quizResultList, 'click', (event) => {
      const button = event.target.closest('[data-quiz-adopt]');
      if (!button) return;
      dom.compatibilityDialog.close();
      actions.openDetail(button.dataset.quizAdopt);
    });

    listen.on(dom.recommendationGrid, 'click', async (event) => {
      const favoriteButton = event.target.closest('[data-favorite]');
      const adoptButton = event.target.closest('[data-adopt]');
      if (favoriteButton) {
        try {
          await favorites.toggle(favoriteButton.dataset.favorite);
        } catch (error) {
          actions.notify(userMessage(error, 'No pudimos guardar el favorito.'));
        }
        actions.renderPets();
        renderRecommendations();
        return;
      }
      if (adoptButton) actions.openAdoption(adoptButton.dataset.adopt);
    });
  }

  return { bind, renderRecommendations, renderQuizResults, destroy: () => listen.destroy() };
}
