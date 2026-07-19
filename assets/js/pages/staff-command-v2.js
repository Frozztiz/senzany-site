(() => {
 const reveals=[...document.querySelectorAll('.reveal')];
 const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});
 reveals.forEach((el,i)=>{el.style.transitionDelay=`${Math.min(i%4,3)*80}ms`;io.observe(el)});
 document.querySelectorAll('[data-tilt]').forEach(card=>{
  card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width;const y=(e.clientY-r.top)/r.height;card.style.setProperty('--mx',`${x*100}%`);card.style.setProperty('--my',`${y*100}%`);card.style.transform=`translateY(-10px) rotateX(${(0.5-y)*2.2}deg) rotateY(${(x-0.5)*2.2}deg)`});
  card.addEventListener('pointerleave',()=>card.style.transform='');
 });
})();