(() => {
  // Feuille de style commune : uniformise le header, le menu et le footer sur toutes les pages.
  const sharedNavStylesheet = 'assets/css/shared/navigation-unified-v1.css';
  if (!document.querySelector(`link[data-senzany-shared-nav="v1"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${sharedNavStylesheet}?v=1.0.0`;
    link.dataset.senzanySharedNav = 'v1';
    document.head.appendChild(link);
  }

  const NAV = [
    ['accueil','index.html','Accueil'],
    ['jouer','senzany-jouer.html','Jouer'],
    ['communaute','senzany-communaute.html','Communauté'],
    ['wiki','senzany-wiki.html','Wiki'],
    ['evenements','senzany-evenements.html','Événements'],
    ['boutique','senzany-boutique.html','Boutique'],
    ['support','senzany-support.html','Support'],
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
        <div class="navlinks">${links}</div>
        <div class="nav-right">
          <a class="btn-join" href="https://discord.gg/aJ2eGmqAQv" rel="noopener" target="_blank">Rejoindre le serveur</a>
          <button aria-label="Ouvrir le menu" aria-expanded="false" class="burger" id="burgerBtn">☰</button>
        </div>
      </nav>
      <div class="mobile-menu" id="mobileMenu">${links}</div>
    </header>`;

  const footer = document.querySelector('[data-site-footer]');
  if (footer) footer.innerHTML = `
    <footer>
      <div class="wrap">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="brand" href="index.html">
              <img alt="Logo Senzany" class="badge footer-logo" src="assets/images/branding/logo.png">
              <span class="brand-name footer-brand-name">SENZANY</span>
            </a>
            <p>Serveur PVE DayZ sur Chernarus. Communauté 100% française.</p>
          </div>
          <div class="footer-links">
            <div class="footer-col"><h4>Liens utiles</h4><a href="index.html">Accueil</a><a href="senzany-communaute.html">Communauté</a><a href="senzany-staff.html">Staff</a><a href="senzany-wiki.html">Wiki</a><a href="senzany-evenements.html">Événements</a><a href="senzany-boutique.html">Boutique</a><a href="senzany-support.html">Support</a></div>
            <div class="footer-col"><h4>Informations</h4><a href="#">Règlement</a><a href="#">Conditions d'utilisation</a><a href="#">Politique de confidentialité</a></div>
            <div class="footer-col"><h4>Nous contacter</h4><a href="mailto:support@senzany.com">support@senzany.com</a><a href="https://discord.gg/aJ2eGmqAQv" rel="noopener" target="_blank">Discord</a></div>
          </div>
        </div>
        <div class="footer-bottom"><span>© 2026 Senzany. Serveur communautaire non affilié à Bohemia Interactive.</span><span>IP : 208.115.196.109:2302</span></div>
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
