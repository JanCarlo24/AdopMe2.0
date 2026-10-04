import { escapeHtml, safeImageUrl } from '../../shared/utils/html.js';

function options(values, current) {
  return values.map((status) => `<option value="${escapeHtml(status)}" ${status === current ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('');
}

export function trackingItem(request, progressSteps) {
  const date = new Date(request.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  const currentStatus = request.estadoSolicitud || 'Recibida';
  const currentStep = progressSteps.indexOf(currentStatus);
  const progress = currentStep < 0
    ? `<p class="tracking-outcome">${escapeHtml(currentStatus)}</p>`
    : `<ol class="status-timeline" aria-label="Progreso de la solicitud">${progressSteps.map((step, index) => `<li class="${index < currentStep ? 'is-complete' : ''} ${index === currentStep ? 'is-current' : ''}"><span class="timeline-dot"></span><span>${escapeHtml(step)}</span></li>`).join('')}</ol>`;

  return `<article class="tracking-item">
    <div class="tracking-item-heading"><div><p class="eyebrow eyebrow-dark">Solicitud del ${escapeHtml(date)}</p><h3>${escapeHtml(request.mascotaNombre || 'Mascota')}</h3></div><span class="status-chip">${escapeHtml(currentStatus)}</span></div>
    <p>${escapeHtml(request.tipoVivienda || 'Hogar por confirmar')} · ${escapeHtml(request.otrasMascotas || 'Convivencia por confirmar')}</p>
    ${progress}
    <span class="tracking-reference">Folio ${escapeHtml(request.solicitudId)}</span>
  </article>`;
}

export function managedPetRow(pet, petStatuses) {
  const photo = safeImageUrl(pet.foto);
  return `<article class="management-row">
    <img class="management-photo" src="${escapeHtml(photo)}" alt="" loading="lazy" />
    <div class="management-details"><h3>${escapeHtml(pet.nombre)}</h3><p>${escapeHtml(pet.especie)} · ${escapeHtml(pet.raza)} · ${escapeHtml(pet.edad)}</p></div>
    <label class="management-state">Disponibilidad<select data-pet-status="${escapeHtml(pet.id)}">${options(petStatuses, pet.estado || 'Disponible')}</select></label>
    <button class="remove-pet" type="button" data-delete-pet="${escapeHtml(pet.id)}" aria-label="Eliminar a ${escapeHtml(pet.nombre)}">Eliminar</button>
  </article>`;
}

export function managedRequestRow(request, requestStatuses) {
  const date = new Date(request.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  const requestId = request.solicitudId || '';
  return `<article class="review-item">
    <div class="review-item-heading"><div><p class="eyebrow eyebrow-dark">${escapeHtml(date)} · ${escapeHtml(request.mascotaNombre || 'Mascota')}</p><h3>${escapeHtml(request.nombreAdoptante || 'Adoptante')}</h3></div>
      <label class="management-state">Estado<select data-request-status="${escapeHtml(requestId)}">${options(requestStatuses, request.estadoSolicitud || 'Recibida')}</select></label>
    </div>
    <div class="review-facts"><span>${escapeHtml(request.correo)}</span><span>${escapeHtml(request.telefono)}</span><span>${escapeHtml(request.tipoVivienda || 'Hogar sin especificar')}</span><span>Otras mascotas: ${escapeHtml(request.otrasMascotas || 'Sin especificar')}</span><span>Experiencia: ${escapeHtml(request.experiencia || 'Sin especificar')}</span></div>
    ${request.mensaje ? `<p class="review-message">${escapeHtml(request.mensaje)}</p>` : ''}
    <span class="tracking-reference">Folio ${escapeHtml(requestId)}</span>
  </article>`;
}

export function refugeListItem(refuge, index) {
  return `
    <button class="refuge-list-item" type="button" data-refuge-id="${escapeHtml(refuge.id)}">
      <span class="refuge-list-index">0${index + 1}</span>
      <span><strong>${escapeHtml(refuge.nombre)}</strong><small>${escapeHtml(refuge.ciudad)} · ${refuge.mascotas} mascotas</small></span>
      <span aria-hidden="true">↗</span>
    </button>`;
}

export function summaryMarkup(values) {
  return values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}
