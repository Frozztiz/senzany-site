(() => {
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  async function refreshDiscordStats(){
    try{ const data = await window.SenzanyAPI.discord.getStats(); setText('commDiscordFull', data.members.toLocaleString('fr-FR')); }
    catch(error){ console.warn('Stats Discord indisponibles.', error); }
  }
  async function refreshGameStats(){
    const el = document.getElementById('commPlayers'); if(!el) return;
    try{
      const data = await window.SenzanyAPI.game.getStats();
      const valid = data.online && data.players != null && data.maxPlayers != null;
      el.textContent = valid ? `${data.players} / ${data.maxPlayers}` : (data.online ? 'Ouvert' : 'Hors ligne');
    }catch(error){ el.textContent = 'Bientôt'; console.warn('Stats DayZ indisponibles.', error); }
  }
  async function refreshTopServeursStats(){
    try{ const data = await window.SenzanyAPI.topServeurs.getStats(); setText('commVotesFull', data.monthlyVotes.toLocaleString('fr-FR')); }
    catch(error){ console.warn('Stats Top-Serveurs indisponibles.', error); }
  }

  function initializeGalleryToggle(){
    const button = document.getElementById('toggleGallery');
    const gallery = document.getElementById('galleryMore');
    if(!button || !gallery) return;
    button.addEventListener('click', () => {
      const open = gallery.classList.toggle('open');
      button.innerHTML = open ? 'Réduire la galerie <span>↑</span>' : 'Voir toutes les captures <span>↓</span>';
      button.setAttribute('aria-expanded', String(open));
    });
  }

  function initializeLightbox(){
    const lightbox = document.getElementById('communityLightbox'); if(!lightbox) return;
    const items = [...document.querySelectorAll('.gallery-item')];
    const image = lightbox.querySelector('img');
    const title = lightbox.querySelector('.lightbox-meta strong');
    const text = lightbox.querySelector('.lightbox-meta small');
    const count = lightbox.querySelector('.lightbox-count');
    let current = 0;
    const show = index => {
      current = (index + items.length) % items.length;
      const item = items[current], source = item.querySelector('img');
      image.src = source.src; image.alt = source.alt;
      title.textContent = item.querySelector('figcaption strong')?.textContent || source.alt;
      text.textContent = item.querySelector('figcaption small')?.textContent || '';
      count.textContent = `${current + 1} / ${items.length}`;
    };
    const open = index => { show(index); lightbox.classList.add('open'); document.body.style.overflow='hidden'; };
    const close = () => { lightbox.classList.remove('open'); document.body.style.overflow=''; };
    items.forEach((item,index) => item.addEventListener('click',()=>open(index)));
    lightbox.querySelector('.lightbox-close')?.addEventListener('click',close);
    lightbox.querySelector('.lightbox-prev')?.addEventListener('click',e=>{e.stopPropagation();show(current-1)});
    lightbox.querySelector('.lightbox-next')?.addEventListener('click',e=>{e.stopPropagation();show(current+1)});
    lightbox.addEventListener('click',e=>{if(e.target===lightbox) close()});
    document.addEventListener('keydown',e=>{if(!lightbox.classList.contains('open')) return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(current-1);if(e.key==='ArrowRight')show(current+1)});
  }

  function initializeReveal(){
    const elements = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){ elements.forEach(el=>el.classList.add('visible')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);} }),{threshold:.12});
    elements.forEach(el=>observer.observe(el));
  }

  refreshDiscordStats(); refreshGameStats(); refreshTopServeursStats();
  initializeGalleryToggle(); initializeLightbox(); initializeReveal();
  setInterval(refreshDiscordStats,120000); setInterval(refreshGameStats,60000); setInterval(refreshTopServeursStats,300000);
})();
