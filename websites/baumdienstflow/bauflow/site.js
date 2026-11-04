(() => {
  'use strict';
  const root = document.documentElement;
  const themeButtons = document.querySelectorAll('.theme-toggle');
  const metaColor = document.querySelector('meta[name="theme-color"]');
  const slides = [
  {
    "title": "Dashboard",
    "label": "DASHBOARD / BETRIEBSÜBERBLICK",
    "src": "assets/bauflow-dashboard.webp",
    "alt": "Originales BauFlow-Dashboard mit Team, Baustellen und Stundenübersicht",
    "caption": "Mitarbeitende, Baustellenfortschritt und Arbeitsstunden in einer Betriebsübersicht."
  },
  {
    "title": "Workzone",
    "label": "WORKZONE / BAUSTELLEN & FORTSCHRITT",
    "src": "assets/bauflow-workzone.webp",
    "alt": "Originale BauFlow-Workzone mit vier fiktiven Glasfaser-Baustellen",
    "caption": "Baustellen, Teams, Arbeitslisten und Hinweise in einem gemeinsamen Arbeitsbereich."
  },
  {
    "title": "Inventar & Geräte",
    "label": "INVENTAR / WERKZEUG & AUSRÜSTUNG",
    "src": "assets/bauflow-inventar.webp",
    "alt": "Originales BauFlow-Barcode-Inventar mit Werkzeug, Kleidung und Baustellenausrüstung",
    "caption": "Werkzeuge und Ausrüstung erfassen und die Zuordnung zum Team nachvollziehen."
  },
  {
    "title": "Mobile Baustelle",
    "label": "MOBIL / ARBEITEN DIREKT VOR ORT",
    "src": "assets/bauflow-mobil-baustelle.webp",
    "alt": "Originale mobile BauFlow-Baustelle mit Arbeitsliste und Arbeitszeit",
    "caption": "Arbeitslisten, Zeiten und Zusatzarbeiten direkt im Baustelleneinsatz.",
    "portrait": true
  },
  {
    "title": "Mobile Übersicht",
    "label": "MOBIL / DIE EINSÄTZE IM BLICK",
    "src": "assets/bauflow-mobil-workzone.webp",
    "alt": "Originale mobile BauFlow-Übersicht mit fiktiven Glasfaser-Baustellen",
    "caption": "Die relevanten Baustellen und Einsätze auf dem Handy überblicken.",
    "portrait": true
  }
];
  let activeSlide = 0;
  let dialogSlide = 0;
  const tabs = [...document.querySelectorAll('[data-slide]')];
  const tabList = document.querySelector('.explorer-tabs');
  const compactTabs = window.matchMedia('(max-width: 650px)');
  const updateTabOrientation = () => tabList?.setAttribute('aria-orientation', compactTabs.matches ? 'horizontal' : 'vertical');
  updateTabOrientation();
  compactTabs.addEventListener('change', updateTabOrientation);
  const explorerImage = document.getElementById('explorer-img');
  const dialog = document.getElementById('product-dialog');
  const imageFor = (slide) => slide.src || slide[root.dataset.theme === 'light' ? 'light' : 'dark'];
  function applyTheme() {
    const dark = root.dataset.theme !== 'light';
    themeButtons.forEach((button) => {
      button.setAttribute('aria-label', dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren');
      button.setAttribute('title', dark ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln');
    });
    document.querySelectorAll('.theme-screen[data-dark]').forEach((img) => { img.src = dark ? img.dataset.dark : img.dataset.light; });
    if (metaColor) metaColor.content = dark ? '#1c1c1c' : '#ededeb';
    if (dialog?.open) renderDialog();
  }
  themeButtons.forEach((button) => button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('bauflow-theme', root.dataset.theme); } catch (_) { /* Theme still works without browser storage. */ }
    applyTheme();
  }));
  applyTheme();
  window.addEventListener('storage', (event) => { if (event.key === 'bauflow-theme' && ['light', 'dark'].includes(event.newValue)) { root.dataset.theme = event.newValue; applyTheme(); } });
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  function closeMenu() { if (!menu || !nav) return; menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menü öffnen'); nav.classList.remove('is-open'); }
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen'); nav.classList.toggle('is-open', open); });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('click', (event) => { if (menu && nav && !nav.contains(event.target) && !menu.contains(event.target)) closeMenu(); });
  function selectSlide(index, focus = false) {
    activeSlide = (index + slides.length) % slides.length;
    const slide = slides[activeSlide];
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === activeSlide)); tab.tabIndex = i === activeSlide ? 0 : -1; });
    if (!explorerImage) return;
    explorerImage.src = imageFor(slide); explorerImage.alt = slide.alt;
    if (slide.dark) { explorerImage.dataset.dark = slide.dark; explorerImage.dataset.light = slide.light; } else { delete explorerImage.dataset.dark; delete explorerImage.dataset.light; }
    document.getElementById('product-panel').setAttribute('aria-labelledby', tabs[activeSlide].id);
    document.getElementById('panel-label').textContent = slide.label;
    document.getElementById('panel-caption').textContent = slide.caption;
    document.getElementById('panel-counter').textContent = `${String(activeSlide + 1).padStart(2, '0')} / 05`;
    document.getElementById('gallery-open').setAttribute('aria-label', `${slide.title} vergrößern`);
    explorerImage.parentElement.classList.toggle('is-mobile', Boolean(slide.portrait));
    if (focus) tabs[activeSlide].focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectSlide(index));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = index + 1;
      if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = slides.length - 1;
      if (next !== undefined) { event.preventDefault(); selectSlide(next, true); }
    });
  });
  function renderDialog() {
    const slide = slides[dialogSlide];
    document.getElementById('dialog-title').textContent = slide.title;
    const img = document.getElementById('dialog-img'); img.src = imageFor(slide); img.alt = slide.alt;
    document.getElementById('dialog-caption').textContent = `${String(dialogSlide + 1).padStart(2, '0')} / 05 — ${slide.caption}`;
  }
  function openDialog(index) { if (!dialog) return; dialogSlide = index; renderDialog(); dialog.showModal(); document.body.classList.add('dialog-open'); }
  function moveDialog(offset) { dialogSlide = (dialogSlide + offset + slides.length) % slides.length; renderDialog(); }
  document.querySelectorAll('[data-open-gallery]').forEach((button) => button.addEventListener('click', () => openDialog(Number(button.dataset.openGallery))));
  document.querySelectorAll('[data-open-current]').forEach((button) => button.addEventListener('click', () => openDialog(activeSlide)));
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  document.querySelector('.dialog-prev')?.addEventListener('click', () => moveDialog(-1));
  document.querySelector('.dialog-next')?.addEventListener('click', () => moveDialog(1));
  dialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveDialog(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); moveDialog(-1); } });
})();
