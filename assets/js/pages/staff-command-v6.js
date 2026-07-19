(() => {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.14 });
  reveals.forEach(el => observer.observe(el));

  const tabs = [...document.querySelectorAll('.unit-tabs a')];
  const sections = [...document.querySelectorAll('.command-section[id]')];
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      tabs.forEach(t => t.classList.toggle('is-active', t.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));
})();
