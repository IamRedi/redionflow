(() => { const root=document.documentElement; const button=document.querySelector('.theme-toggle'); if(!button)return;
const text={de:['Helles Design aktivieren','Dunkles Design aktivieren'],en:['Use light theme','Use dark theme'],it:['Attiva il tema chiaro','Attiva il tema scuro'],sq:['Aktivizo pamjen e çelët','Aktivizo pamjen e errët']}[root.lang]||['Use light theme','Use dark theme'];
function render(){const dark=root.dataset.theme!=='light';button.setAttribute('aria-label',text[dark?0:1]);button.setAttribute('aria-pressed',String(dark));}render();
button.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem("bdf-theme",root.dataset.theme)}catch{}render();});})();
