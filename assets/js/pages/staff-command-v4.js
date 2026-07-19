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


(() => {
  const links=[...document.querySelectorAll('.staff-unit-nav a')];
  const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if(!('IntersectionObserver' in window)) return;
  const observer=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')===`#${entry.target.id}`));
    });
  },{rootMargin:'-35% 0px -55% 0px',threshold:0});
  sections.forEach(s=>observer.observe(s));
})();
