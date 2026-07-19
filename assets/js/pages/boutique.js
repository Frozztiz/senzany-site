(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const init = () => {
    document.body.classList.add('shop-page');

    const revealItems = [...document.querySelectorAll('[data-reveal]')];
    revealItems.forEach((item) => {
      const delay = Number.parseInt(item.dataset.revealDelay || '0', 10);
      item.style.setProperty('--reveal-delay', `${Number.isFinite(delay) ? delay : 0}ms`);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -45px' });

      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }

    const hero = document.querySelector('[data-shop-hero]');
    const grid = hero?.querySelector('.shop-hero__grid');
    const veil = hero?.querySelector('.shop-hero__veil');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (hero && grid && veil && !reducedMotion) {
      hero.addEventListener('pointermove', (event) => {
        const bounds = hero.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        grid.style.transform = `translate3d(${x * 12}px, ${y * 8}px, 0)`;
        veil.style.transform = `translate3d(${x * -18}px, ${y * -10}px, 0)`;
      }, { passive: true });

      hero.addEventListener('pointerleave', () => {
        grid.style.transform = '';
        veil.style.transform = '';
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* V7.0 — profondeur lumineuse des cartes, désactivée sur tactile/mouvement réduit */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reduced || !finePointer) return;

  const cards = document.querySelectorAll('.collection-visual');
  cards.forEach((card) => {
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      card.style.transform = '';
    };
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const ry = (px - .5) * 4.5;
      const rx = (.5 - py) * 3.2;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.transform = `translateY(-6px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        card.style.setProperty('--mouse-x', `${px * 100}%`);
        card.style.setProperty('--mouse-y', `${py * 100}%`);
      });
    }, { passive: true });
    card.addEventListener('pointerleave', reset, { passive: true });
    card.addEventListener('blur', reset, true);
  });
})();
