export function createMotion({ document, window }) {
  const revealObserver = 'IntersectionObserver' in window
    ? new window.IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' })
    : null;

  let scrollFrame = 0;
  let onScroll = null;

  function observe(root = document) {
    root.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => {
      if (revealObserver) revealObserver.observe(element);
      else element.classList.add('is-visible');
    });
  }

  function bindParallax() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const heroImage = document.querySelector('.hero-image');
    if (!heroImage) return;

    onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.1, 70);
        heroImage.style.setProperty('--parallax-y', `${-offset}px`);
        scrollFrame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function destroy() {
    revealObserver?.disconnect();
    if (onScroll) window.removeEventListener('scroll', onScroll);
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
  }

  return { observe, bindParallax, destroy };
}
