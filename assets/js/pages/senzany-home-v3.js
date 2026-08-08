
(() => {
  const init = () => {
    document.querySelectorAll('.v3-manifesto__copy,.v3-manifesto__visual,.v3-world__content,.v3-season__meta,.v3-season__copy,.v3-season__date,.v3-access__title,.v3-access-card,.v3-finale > *')
      .forEach(el => el.classList.add('v3-reveal'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, {threshold:.12,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.v3-reveal').forEach(el => io.observe(el));

    const hero = document.querySelector('.v3-hero');
    const bg = document.querySelector('.v3-hero__backdrop');
    if(hero && bg && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      hero.addEventListener('pointermove',e=>{
        const r=hero.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
        bg.style.transform=`scale(1.05) translate3d(${x*-9}px,${y*-6}px,0)`;
      });
      hero.addEventListener('pointerleave',()=>bg.style.transform='scale(1.03)');
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
