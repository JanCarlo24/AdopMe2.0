import { escapeHtml, safeImageUrl } from '../../shared/utils/html.js';

export function favoriteButton(pet, isSaved) {
  return `<button class="favorite-button${isSaved ? ' is-saved' : ''}" type="button" data-favorite="${escapeHtml(pet.id)}" aria-label="${isSaved ? 'Quitar' : 'Guardar'} a ${escapeHtml(pet.nombre)} ${isSaved ? 'de' : 'en'} favoritos" aria-pressed="${isSaved}"><span aria-hidden="true">${isSaved ? '♥' : '♡'}</span></button>`;
}

export function petCard(pet, index, isSaved) {
  const status = pet.estado || 'Disponible';
  const isAvailable = status === 'Disponible';
  const photo = safeImageUrl(pet.foto);
  return `
    <article class="pet-card reveal" tabindex="0" data-open-pet="${escapeHtml(pet.id)}" style="--reveal-delay:${Math.min(index, 4) * 75}ms">
      <div class="pet-photo-wrap">
        <img class="pet-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(pet.especie)} ${escapeHtml(pet.nombre)}, ${escapeHtml(pet.raza)}" loading="lazy" />
        <span class="pet-category">${escapeHtml(pet.especie)}</span>
        ${favoriteButton(pet, isSaved)}
      </div>
      <div class="pet-card-body">
        <div class="pet-name-row"><h3>${escapeHtml(pet.nombre)}</h3><span>${escapeHtml(pet.edad)}</span></div>
        <p class="pet-breed">${escapeHtml(pet.raza)}</p>
        <span class="pet-status${isAvailable ? '' : ' is-pending'}">${escapeHtml(status)}</span>
        <p class="pet-description">${escapeHtml(pet.descripcion)}</p>
        <button class="meet-button" type="button" data-adopt="${escapeHtml(pet.id)}" ${isAvailable ? '' : 'disabled'}>${isAvailable ? 'Me gustaría conocerle' : 'En proceso de adopción'} <span aria-hidden="true">${isAvailable ? '↗' : ''}</span></button>
      </div>
    </article>`;
}

export function recommendationCard(pet, isSaved, matchScore) {
  const photo = safeImageUrl(pet.foto);
  return `
    <article class="recommendation-card reveal">
      <div class="recommendation-photo-wrap">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(pet.nombre)}" loading="lazy" />
        ${favoriteButton(pet, isSaved)}
      </div>
      <div class="recommendation-body">
        <div class="pet-name-row"><h3>${escapeHtml(pet.nombre)}</h3><span>${escapeHtml(pet.edad)}</span></div>
        <p class="pet-breed">${escapeHtml(pet.raza)}</p>
        <p class="pet-description">${escapeHtml(pet.descripcion)}</p>
        <div class="recommendation-footer">
          <span class="match-badge">${matchScore ? `${matchScore}% match` : 'Match ideal'}</span>
          <button class="meet-button" type="button" data-adopt="${escapeHtml(pet.id)}">Conocerle <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </article>`;
}

export function filterChips(filters, active, attribute) {
  return filters.map((filter) => `
    <button class="facet-chip${active === filter ? ' is-active' : ''}" type="button" data-${attribute}="${escapeHtml(filter)}" aria-pressed="${String(active === filter)}">${escapeHtml(filter)}</button>
  `).join('');
}

export function quizResultItem(pet, score) {
  const photo = safeImageUrl(pet.foto);
  return `
    <article class="quiz-result-item">
      <img src="${escapeHtml(photo)}" alt="${escapeHtml(pet.nombre)}" loading="lazy" />
      <div><h3>${escapeHtml(pet.nombre)}</h3><p>${escapeHtml(pet.raza)} · ${escapeHtml(pet.edad)}</p></div>
      <span>${score}%</span>
      <button class="text-button" type="button" data-quiz-adopt="${escapeHtml(pet.id)}">Conocerle</button>
    </article>`;
}
