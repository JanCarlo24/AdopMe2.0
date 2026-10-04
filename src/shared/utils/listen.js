export function createListenerGroup() {
  const cleanups = [];

  return {
    on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    },
    destroy() {
      while (cleanups.length) cleanups.pop()();
    }
  };
}
