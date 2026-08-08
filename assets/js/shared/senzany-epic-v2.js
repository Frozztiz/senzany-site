
(() => {
 const excluded = '.entry-terminal,.senzany-entry-terminal,.intro-cinematic,.cinematic-overlay';
 const start = () => {
   // Chapter treatment for major sections.
   [...document.querySelectorAll('main > section')].forEach((section,i)=>{
     if(section.matches(excluded) || section.closest(excluded)) return;
     section.classList.add('rz-epic-chapter');
     section.dataset.rzChapter=String(i+1).padStart(2,'0');
   });

   // Interactive light on content cards.
   document.querySelectorAll('main [class*="card"], main [class*="panel"]').forEach(card=>{
     if(card.closest(excluded)) return;
     card.classList.add('rz-spotlight');
     card.addEventListener('pointermove',e=>{
       const r=card.getBoundingClientRect();
       card.style.setProperty('--mx',`${e.clientX-r.left}px`);
       card.style.setProperty('--my',`${e.clientY-r.top}px`);
     });
   });
 };
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
 else start();
})();
