(() => {
  const cards = [...document.querySelectorAll('.operator-card')];
  cards.forEach((card) => {
    ['tl','tr','br','bl'].forEach((pos) => {
      const corner = document.createElement('span');
      corner.className = `hud-corner hud-corner--${pos}`;
      card.appendChild(corner);
    });
  });

  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = cards.indexOf(entry.target);
      window.setTimeout(() => entry.target.classList.add('is-visible'), (index % 3) * 110);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  cards.forEach((card) => observer.observe(card));
})();
