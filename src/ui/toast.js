export function createToast(element, window) {
  let timeoutId = 0;

  return {
    show(message) {
      element.textContent = message;
      element.classList.add('is-visible');
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => element.classList.remove('is-visible'), 3200);
    },
    destroy() {
      window.clearTimeout(timeoutId);
    }
  };
}
