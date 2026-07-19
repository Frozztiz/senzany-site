(() => {
  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  async function refreshDiscordStats() {
    try {
      const data = await window.SenzanyAPI.discord.getStats();
      setText('commDiscordFull', data.members.toLocaleString('fr-FR'));
    } catch (error) {
      console.warn('Stats Discord indisponibles.', error);
    }
  }

  async function refreshGameStats() {
    const playersElement = document.getElementById('commPlayers');
    if (!playersElement) return;

    try {
      const data = await window.SenzanyAPI.game.getStats();
      const hasPlayerCount = data.online &&
        data.players !== null && data.players !== undefined &&
        data.maxPlayers !== null && data.maxPlayers !== undefined;

      playersElement.textContent = hasPlayerCount
        ? `${data.players} / ${data.maxPlayers}`
        : (data.online ? 'Bientôt disponible' : 'Hors ligne');
    } catch (error) {
      playersElement.textContent = 'Bientôt disponible';
      console.warn('Stats DayZ indisponibles.', error);
    }
  }

  async function refreshTopServeursStats() {
    try {
      const data = await window.SenzanyAPI.topServeurs.getStats();
      setText('commVotesFull', data.monthlyVotes.toLocaleString('fr-FR'));
    } catch (error) {
      console.warn('Stats Top-Serveurs indisponibles.', error);
    }
  }

  function initializeGallery() {
    const lightbox = document.getElementById('communityLightbox');
    if (!lightbox) return;

    const galleryItems = [...document.querySelectorAll('.gallery-item')];
    const lightboxImage = lightbox.querySelector('img');
    const lightboxTitle = lightbox.querySelector('.lightbox-meta strong');
    const lightboxText = lightbox.querySelector('.lightbox-meta small');
    const lightboxCount = lightbox.querySelector('.lightbox-count');
    let currentIndex = 0;

    const showImage = (index) => {
      currentIndex = (index + galleryItems.length) % galleryItems.length;
      const item = galleryItems[currentIndex];
      const image = item.querySelector('img');
      const title = item.querySelector('figcaption strong');
      const text = item.querySelector('figcaption small');
      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt;
      lightboxTitle.textContent = title ? title.textContent : image.alt;
      lightboxText.textContent = text ? text.textContent : '';
      lightboxCount.textContent = `${currentIndex + 1} / ${galleryItems.length}`;
    };

    const openLightbox = (index) => {
      showImage(index);
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    galleryItems.forEach((item, index) => item.addEventListener('click', () => openLightbox(index)));
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', (event) => {
      event.stopPropagation();
      showImage(currentIndex - 1);
    });
    lightbox.querySelector('.lightbox-next').addEventListener('click', (event) => {
      event.stopPropagation();
      showImage(currentIndex + 1);
    });
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
      if (!lightbox.classList.contains('open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
      if (event.key === 'ArrowRight') showImage(currentIndex + 1);
    });
  }

  refreshDiscordStats();
  refreshGameStats();
  refreshTopServeursStats();
  initializeGallery();

  setInterval(refreshDiscordStats, 120000);
  setInterval(refreshGameStats, 60000);
  setInterval(refreshTopServeursStats, 300000);
})();
