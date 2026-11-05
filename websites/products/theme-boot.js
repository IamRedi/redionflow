(() => {
  let theme = 'dark';
  try { const saved = localStorage.getItem('bdf-theme'); if (saved === 'light' || saved === 'dark') theme = saved; } catch (_) { /* Storage is optional. */ }
  document.documentElement.dataset.theme = theme;
})();
