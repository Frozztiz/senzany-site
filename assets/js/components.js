(() => {
  // Lecteur audio global : chargé une seule fois sur toutes les pages.
  const ambientStylesheet = 'assets/css/shared/ambient-player.css';
  if (!document.querySelector('link[data-senzany-ambient-player]')) {
    const ambientLink = document.createElement('link');
    ambientLink.rel = 'stylesheet';
    ambientLink.href = `${ambientStylesheet}?v=1.0.1`;
    ambientLink.dataset.senzanyAmbientPlayer = 'v1';
    document.head.appendChild(ambientLink);
  }

  if (!document.querySelector('script[data-senzany-ambient-player]')) {
    const ambientScript = document.createElement('script');
    ambientScript.src = 'assets/js/shared/ambient-player.js?v=1.0.1';
    ambientScript.defer = true;
    ambientScript.dataset.senzanyAmbientPlayer = 'v1';
    document.head.appendChild(ambientScript);
  }

  // Feuilles de style communes : navigation et footer partagés sur toutes les pages.
  const sharedNavStylesheet = 'assets/css/shared/navigation-unified-v1.css';
  const sharedFooterStylesheet = 'assets/css/shared/footer-v2.css';
  if (!document.querySelector(`link[data-senzany-shared-nav="v1"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${sharedNavStylesheet}?v=1.0.0`;
    link.dataset.senzanySharedNav = 'v1';
    document.head.appendChild(link);
  }

  if (!document.querySelector('link[data-senzany-shared-footer="v2"]')) {
    const footerLink = document.createElement('link');
    footerLink.rel = 'stylesheet';
    footerLink.href = `${sharedFooterStylesheet}?v=2.1.0`;
    footerLink.dataset.senzanySharedFooter = 'v2';
    document.head.appendChild(footerLink);
  }

  const NAV = [
    ['accueil','index.html','Accueil'],
    ['map','senzany-map.html','Carte'],
    ['communaute','senzany-communaute.html','Communauté'],
    ['wiki','senzany-wiki.html','Wiki'],
    ['evenements','senzany-evenements.html','Événements'],
    ['boutique','senzany-boutique.html','Boutique'],
    ['profil','senzany-profil.html','Mon profil'],
    ['staff','senzany-staff.html','Staff']
  ];
  const current = document.body.dataset.page || '';
  const links = NAV.map(([id, href, label]) =>
    `<a href="${href}"${id === current ? ' class="active" aria-current="page"' : ''}>${label}</a>`
  ).join('');

  const header = document.querySelector('[data-site-header]');
  if (header) header.innerHTML = `
    <header>
      <nav class="wrap">
        <a class="brand" href="index.html" aria-label="Accueil Senzany">
          <img alt="Logo Senzany" class="badge" src="assets/images/branding/logo.png">
          <span class="brand-name">SENZANY</span>
        </a>
        <div class="navlinks">${links}<span data-commandement-nav></span></div>
        <div class="nav-right">
          <a class="btn-join" href="https://discord.gg/aJ2eGmqAQv" rel="noopener" target="_blank">Rejoindre le serveur</a>
          <button aria-label="Ouvrir le menu" aria-expanded="false" class="burger" id="burgerBtn">☰</button>
        </div>
      </nav>
      <div class="mobile-menu" id="mobileMenu">${links}<span data-commandement-nav-mobile></span></div>
    </header>`;

  async function revealCommandementLink() {
    try {
      const response = await fetch('/api/commandement/access', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const access = await response.json();
      if (!access.authorized) return;

      const active = current === 'commandement'
        ? ' class="active commandement-link" aria-current="page"'
        : ' class="commandement-link"';
      const link = `<a href="senzany-admin.html"${active}>Commandement</a>`;
      document.querySelectorAll('[data-commandement-nav], [data-commandement-nav-mobile]')
        .forEach(slot => { slot.outerHTML = link; });
    } catch (_) {
      // En cas d'indisponibilité du backend, le lien reste invisible.
    }
  }

  revealCommandementLink();

  const footer = document.querySelector('[data-site-footer]');
  if (footer) footer.innerHTML = `
    <footer class="site-footer-v2">
      <div class="wrap site-footer-v2__inner">
        <div class="site-footer-v2__main">
          <section class="site-footer-v2__brand" aria-label="Présentation Senzany">
            <a class="brand site-footer-v2__logo-link" href="index.html" aria-label="Accueil Senzany">
              <img alt="Logo Senzany" class="badge footer-logo" src="assets/images/branding/logo.png">
              <span class="brand-name footer-brand-name">SENZANY</span>
            </a>
            <p>Senzany est un serveur DayZ PVE immersif sur Chernarus, avec une progression évolutive, des événements réguliers et une communauté francophone active.</p>
            <div class="site-footer-v2__socials" aria-label="Liens externes Senzany">
              <a href="https://discord.gg/aJ2eGmqAQv" rel="noopener" target="_blank">Discord officiel</a>
              <a href="https://top-serveurs.net/dayz/senzany-wipe2303-pve-fr-voici-le-recit-de-votre-mort" rel="noopener" target="_blank">Top-Serveurs</a>
              <a href="steam://connect/208.115.196.109:2302">Se connecter</a>
            </div>
          </section>

          <nav class="site-footer-v2__links" aria-label="Navigation de pied de page">
            <div class="site-footer-v2__column">
              <h4>Navigation</h4>
              <a href="index.html">Accueil</a>
              <a href="senzany-map.html">Carte</a>
              <a href="senzany-communaute.html">Communauté</a>
              <a href="senzany-evenements.html">Événements</a>
              <a href="senzany-wiki.html">Wiki</a>
              <a href="senzany-boutique.html">Boutique</a>
              <a href="senzany-profil.html">Mon profil</a>
            </div>

            <div class="site-footer-v2__column">
              <h4>Informations</h4>
              <span class="site-footer-v2__pending">Règlement du serveur <small>à venir</small></span>
              <span class="site-footer-v2__pending">Conditions d’utilisation <small>à venir</small></span>
              <span class="site-footer-v2__pending">Politique de confidentialité <small>à venir</small></span>
              <span class="site-footer-v2__pending">Mentions légales <small>à venir</small></span>
            </div>

            <div class="site-footer-v2__column site-footer-v2__server-column">
              <h4>Serveur DayZ</h4>
              <span class="site-footer-v2__server-address">208.115.196.109:2302</span>
              <a class="site-footer-v2__server-connect" href="steam://connect/208.115.196.109:2302">Se connecter au serveur</a>
              <span class="site-footer-v2__portal-info"><small>Portail</small>Version 1.0</span>
            </div>
          </nav>
        </div>

        <div class="site-footer-v2__bottom">
          <div>
            <strong>© 2026 Senzany.</strong>
            <span>Tous droits réservés.</span>
          </div>
          <div class="site-footer-v2__legal-note">DayZ et ses éléments associés appartiennent à Bohemia Interactive. Senzany est un serveur communautaire indépendant et non affilié.</div>
          <div class="site-footer-v2__version">Portail Senzany <strong>v1.0</strong></div>
        </div>
      </div>
    </footer>`;

  const burger = document.getElementById('burgerBtn');
  const mobile = document.getElementById('mobileMenu');
  if (burger && mobile) {
    burger.addEventListener('click', () => {
      const open = mobile.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobile.classList.remove('open')));
  }
})();
