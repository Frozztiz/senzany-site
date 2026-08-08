
(() => {
  const init = () => {
    const slider = document.querySelector('[data-gp-slider]');
    if (!slider) return;

    const slides = [...slider.querySelectorAll('[data-slide]')];
    const dots = [...document.querySelectorAll('[data-dot]')];
    const prev = document.querySelector('.gp-arrow--prev');
    const next = document.querySelector('.gp-arrow--next');
    let index = 0;
    let timer;

    const show = (i) => {
      index = (i + slides.length) % slides.length;
      slides.forEach((slide, n) => slide.classList.toggle('is-active', n === index));
      dots.forEach((dot, n) => dot.classList.toggle('is-active', n === index));
    };

    const autoplay = () => {
      clearInterval(timer);
      timer = setInterval(() => show(index + 1), 7000);
    };

    prev?.addEventListener('click', () => { show(index - 1); autoplay(); });
    next?.addEventListener('click', () => { show(index + 1); autoplay(); });
    dots.forEach(dot => dot.addEventListener('click', () => { show(Number(dot.dataset.dot)); autoplay(); }));

    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', autoplay);

    show(0);
    autoplay();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
