
(() => {
 const init=()=>{
   document.querySelectorAll('.aurora-vision>* ,.aurora-story__card,.aurora-duo__copy,.aurora-season__content>*,.aurora-community__copy,.aurora-destinations__head,.aurora-destinations__list a,.aurora-footer>*')
     .forEach(el=>el.classList.add('au-reveal'));
   const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -6% 0px'});
   document.querySelectorAll('.au-reveal').forEach(el=>io.observe(el));
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
