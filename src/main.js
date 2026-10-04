import { createApp } from './core/app.js';

document.documentElement.setAttribute('aria-busy', 'true');

const app = await createApp({
  document,
  window,
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage
});

document.documentElement.removeAttribute('aria-busy');
app.start();
