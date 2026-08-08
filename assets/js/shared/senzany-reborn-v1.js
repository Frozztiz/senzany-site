
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const terminalPending = document.documentElement.classList.contains('senzany-terminal-pending');

  const init = () => {
    if (!reduce) {
      const selectors = [
        'main section > .wrap',
        'main article',
        '.home-live-card',
        '.home-pillar',
        '.home-news-card',
        '.operator-card',
        '.vote-wallet-panel',
        '.battlepass-command'
      ];
      const nodes = [...new Set(selectors.flatMap(s => [...document.querySelectorAll(s)]))]
        .filter(el => !el.closest('.entry-terminal,.senzany-entry-terminal,.intro-cinematic,.cinematic-overlay'));

      nodes.forEach((el, i) => {
        el.classList.add('rz-reveal');
        el.style.transitionDelay = `${Math.min((i % 5) * 55, 220)}ms`;
      });

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('rz-visible');
            io.unobserve(entry.target);
          }
        });
      }, {threshold:.08, rootMargin:'0px 0px -6% 0px'});
      nodes.forEach(el => io.observe(el));
    }

    // Cinematic mouse parallax only on homepage, never on the terminal/cinematic overlays.
    if (document.body?.dataset?.page === 'accueil' && !reduce) {
      const hero = document.querySelector('.home-hero');
      const content = document.querySelector('.home-hero__content');
      const live = document.querySelector('.home-live-card');
      if (hero) {
        hero.addEventListener('pointermove', e => {
          const r = hero.getBoundingClientRect();
          const x = (e.clientX-r.left)/r.width-.5;
          const y = (e.clientY-r.top)/r.height-.5;
          if(content) content.style.transform = `translate3d(${x*-8}px,${y*-5}px,0)`;
          if(live) live.style.transform = `translate3d(${x*9}px,${y*6}px,0)`;
        });
        hero.addEventListener('pointerleave', () => {
          if(content) content.style.transform = '';
          if(live) live.style.transform = '';
        });
      }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
