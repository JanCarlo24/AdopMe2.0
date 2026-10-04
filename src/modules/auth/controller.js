import { userMessage } from '../../shared/errors.js';
import { createListenerGroup } from '../../shared/utils/listen.js';

export function createAuthController({ document, window, dom, auth, actions }) {
  const listen = createListenerGroup();
  let pendingPetId = null;
  let pendingTracking = false;

  function updateTrigger() {
    const session = auth.current();
    dom.authTrigger.textContent = session ? 'Salir' : 'Iniciar sesión';
    dom.authTrigger.title = session ? `Sesión de ${session.nombre}` : 'Iniciar sesión';
    dom.authTrigger.setAttribute('aria-label', session ? `Cerrar sesión de ${session.nombre}` : 'Iniciar sesión');
  }

  function setAuthMode(mode) {
    const isRegistering = mode === 'register';
    dom.loginForm.hidden = isRegistering;
    dom.registerForm.hidden = !isRegistering;
    document.querySelector('#auth-eyebrow').textContent = isRegistering ? 'Una nueva historia' : 'Tu próxima historia';
    document.querySelector('#auth-title').textContent = isRegistering ? 'Bienvenido a casa.' : 'Qué gusto verte.';
    document.querySelector('#auth-intro').textContent = isRegistering
      ? 'Crea tu cuenta para guardar favoritos y seguir tus solicitudes.'
      : 'Entra para guardar tus favoritos y seguir tus solicitudes.';
    document.querySelector('#auth-switch-row').firstChild.textContent = isRegistering
      ? '¿Ya tienes cuenta? '
      : '¿Primera vez por aquí? ';
    document.querySelector('#auth-switch').textContent = isRegistering ? 'Inicia sesión' : 'Crea tu cuenta';
    dom.authFeedback.textContent = '';
  }

  function clearPending() {
    pendingPetId = null;
    pendingTracking = false;
  }

  function ask(message, { petId = null, tracking = false } = {}) {
    pendingPetId = petId;
    pendingTracking = tracking;
    setAuthMode('login');
    dom.authFeedback.textContent = message;
    dom.authDialog.showModal();
  }

  function continueAfterAuthentication() {
    const nextPetId = pendingPetId;
    const shouldShowTracking = pendingTracking;
    clearPending();
    dom.authDialog.close();
    window.setTimeout(() => {
      if (nextPetId !== null) actions.openAdoption(nextPetId);
      else if (shouldShowTracking) actions.openTracking();
    }, 0);
  }

  async function handleSubmit(form, mode) {
    const submitButton = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    submitButton.disabled = true;
    dom.authFeedback.textContent = mode === 'register' ? 'Creando tu cuenta…' : 'Iniciando sesión…';

    try {
      const account = mode === 'register'
        ? await auth.register({
          nombre: String(formData.get('nombre') ?? ''),
          correo: String(formData.get('correo') ?? ''),
          password: String(formData.get('password') ?? '')
        })
        : await auth.login({
          correo: String(formData.get('correo') ?? ''),
          password: String(formData.get('password') ?? '')
        });
      form.reset();
      updateTrigger();
      continueAfterAuthentication();
      const firstName = account.nombre.split(' ')[0];
      actions.notify(mode === 'register' ? `¡Bienvenido, ${firstName}!` : `Qué gusto verte, ${firstName}.`);
    } catch (error) {
      dom.authFeedback.textContent = userMessage(
        error,
        mode === 'register'
          ? 'No pudimos guardar tu cuenta. Inténtalo de nuevo.'
          : 'No pudimos iniciar sesión. Inténtalo de nuevo.'
      );
    } finally {
      submitButton.disabled = false;
    }
  }

  function bind() {
    listen.on(dom.authTrigger, 'click', async () => {
      if (auth.current()) {
        try {
          await auth.logout();
          updateTrigger();
          actions.notify('Has cerrado tu sesión.');
          actions.renderTracking();
          actions.renderPets();
          actions.renderRecommendations();
        } catch (error) {
          actions.notify(userMessage(error, 'No pudimos cerrar la sesión.'));
        }
        return;
      }
      setAuthMode('login');
      dom.authDialog.showModal();
    });

    listen.on(document.querySelector('#auth-switch'), 'click', () => {
      setAuthMode(dom.registerForm.hidden ? 'register' : 'login');
      dom.loginForm.reset();
      dom.registerForm.reset();
    });

    listen.on(document.querySelector('#auth-close'), 'click', () => {
      clearPending();
      dom.authDialog.close();
    });
    listen.on(dom.authDialog, 'cancel', clearPending);
    listen.on(dom.authDialog, 'close', () => {
      if (!auth.current()) clearPending();
    });
    listen.on(dom.authDialog, 'click', (event) => {
      if (event.target === dom.authDialog) {
        clearPending();
        dom.authDialog.close();
      }
    });
    listen.on(dom.forgotPassword, 'click', async () => {
      const correo = String(new FormData(dom.loginForm).get('correo') ?? '');
      if (typeof auth.resetPassword !== 'function') {
        dom.authFeedback.textContent = 'En este navegador la cuenta es local. Si no recuerdas la contraseña, crea una cuenta nueva.';
        return;
      }
      dom.forgotPassword.disabled = true;
      dom.authFeedback.textContent = 'Enviando enlace…';
      try {
        await auth.resetPassword(correo);
        dom.authFeedback.textContent = 'Si existe una cuenta con ese correo, enviamos un enlace para restablecer la contraseña.';
      } catch (error) {
        dom.authFeedback.textContent = userMessage(error, 'No pudimos enviar el correo de restablecimiento.');
      } finally {
        dom.forgotPassword.disabled = false;
      }
    });
    listen.on(dom.loginForm, 'submit', (event) => {
      event.preventDefault();
      handleSubmit(dom.loginForm, 'login');
    });
    listen.on(dom.registerForm, 'submit', (event) => {
      event.preventDefault();
      handleSubmit(dom.registerForm, 'register');
    });
  }

  return { bind, ask, updateTrigger, destroy: () => listen.destroy() };
}
