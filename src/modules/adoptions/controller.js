import { userMessage } from '../../shared/errors.js';
import { createId } from '../../shared/utils/id.js';
import { createListenerGroup } from '../../shared/utils/listen.js';
import { summaryMarkup, trackingItem } from '../../ui/render/management.js';

const STEP_LABELS = ['Contacto', 'Tu hogar', 'Confirmación'];

export function createAdoptionController({ document, window, dom, catalog, adoptions, auth, actions, config }) {
  const listen = createListenerGroup();
  let applicationStep = 1;

  function setApplicationStep(step) {
    applicationStep = step;
    document.querySelectorAll('[data-application-step]').forEach((panel) => {
      panel.hidden = Number(panel.dataset.applicationStep) !== step;
      panel.classList.toggle('is-active', !panel.hidden);
    });
    document.querySelector('#application-step-label').textContent = `Paso ${step} de 3 · ${STEP_LABELS[step - 1]}`;
    document.querySelector('#application-progress-fill').style.width = `${(step / 3) * 100}%`;
    document.querySelector('#application-back').hidden = step === 1;
    document.querySelector('#application-next').hidden = step === 3;
    document.querySelector('#application-submit').hidden = step !== 3;
  }

  function updateApplicationSummary() {
    const values = [
      ['Mascota', document.querySelector('#selected-pet-name-input').value],
      ['Hogar', dom.adoptionForm.elements.tipoVivienda.value],
      ['Otras mascotas', dom.adoptionForm.elements.otrasMascotas.value],
      ['Experiencia', dom.adoptionForm.elements.experiencia.value]
    ];
    dom.applicationSummary.innerHTML = summaryMarkup(values);
  }

  function openForm(petId) {
    const pet = catalog.getPetById(petId);
    if (!pet) return;
    const session = auth.current();
    if (!session) {
      actions.askForAccount('Inicia sesión o crea una cuenta para guardar y seguir tu solicitud.', { petId });
      return;
    }

    document.querySelector('#selected-pet-name').textContent = pet.nombre;
    dom.adoptionForm.reset();
    document.querySelector('#selected-pet-id').value = pet.id;
    document.querySelector('#selected-pet-name-input').value = pet.nombre;
    document.querySelector('#applicant-name').value = session.nombre;
    document.querySelector('#applicant-email').value = session.correo;
    setApplicationStep(1);
    dom.dialogFormView.hidden = false;
    dom.dialogSuccess.hidden = true;
    dom.adoptionDialog.showModal();
  }

  function renderTracking() {
    const session = auth.current();
    if (!session) {
      dom.trackingList.innerHTML = '<p class="panel-empty">Inicia sesión para revisar tus solicitudes.</p>';
      return;
    }

    const requests = adoptions.forAccount(session.correo);
    if (requests.length === 0) {
      dom.trackingList.innerHTML = '<p class="panel-empty">Aún no tienes solicitudes. Cuando encuentres a tu compañero, podrás seguir aquí cada paso.</p>';
      return;
    }

    dom.trackingList.innerHTML = requests.map((request) => trackingItem(request, config.progressSteps)).join('');
  }

  function openTracking() {
    renderTracking();
    dom.trackingDialog.showModal();
  }

  function bind() {
    listen.on(dom.adoptionForm, 'submit', async (event) => {
      event.preventDefault();
      const session = auth.current();
      const request = Object.fromEntries(new FormData(dom.adoptionForm).entries());
      const submitButton = document.querySelector('#application-submit');
      submitButton.disabled = true;
      try {
        await adoptions.save({
          ...request,
          solicitudId: createId(window.crypto),
          cuentaCorreo: session?.correo,
          estadoSolicitud: 'Recibida'
        });
        dom.adoptionForm.reset();
        setApplicationStep(1);
        dom.dialogFormView.hidden = true;
        dom.dialogSuccess.hidden = false;
        actions.afterRequestsChange();
        actions.notify('Solicitud enviada correctamente.');
      } catch (error) {
        actions.notify(userMessage(error, 'No pudimos guardar tu solicitud. Inténtalo de nuevo.'));
      } finally {
        submitButton.disabled = false;
      }
    });

    listen.on(document.querySelector('#application-next'), 'click', () => {
      const activeStep = document.querySelector(`[data-application-step="${applicationStep}"]`);
      const controls = [...activeStep.querySelectorAll('input, select, textarea')];
      if (!controls.every((control) => control.reportValidity())) return;
      const nextStep = applicationStep + 1;
      if (nextStep === 3) updateApplicationSummary();
      setApplicationStep(nextStep);
    });

    listen.on(document.querySelector('#application-back'), 'click', () => {
      if (applicationStep > 1) setApplicationStep(applicationStep - 1);
    });

    listen.on(document.querySelector('#dialog-close'), 'click', () => dom.adoptionDialog.close());
    listen.on(document.querySelector('#success-close'), 'click', () => dom.adoptionDialog.close());
    listen.on(document.querySelector('#view-my-requests'), 'click', () => {
      dom.adoptionDialog.close();
      openTracking();
    });
  }

  return { bind, openForm, renderTracking, openTracking, destroy: () => listen.destroy() };
}
