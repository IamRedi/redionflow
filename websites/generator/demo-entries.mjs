import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const demoEntriesRevision=createHash('sha256').update((await readFile(new URL('./demo-entries.css',import.meta.url),'utf8')).replace(/\r\n/g,'\n')).digest('hex').slice(0,12);

// Original approved marks from the three independent Muster installations.
// One static entry contract; no sign-in, provider call or demo data mutation.
export const demoEntries=[
 {id:'bauflow',brand:'BauFlow',logo:'bauflow-muster.webp',href:'https://bauflow-production-1344.up.railway.app/muster'},
 {id:'crane',brand:'RheinRuhr',logo:'crane-muster.svg',href:'https://rheinruhr-kran-muster-production.up.railway.app/muster'},
 {id:'baumdienst',brand:'Baumdienst',logo:'baumdienst-muster.webp',href:'https://redionflow-production.up.railway.app/demo'},
];
const copy={
 sq:{choose:'Zgjidh një demo',note:'Musterfirma · të dhëna fiktive',open:'Hap demon',bauflow:'Konstruksione',crane:'Vinça',baumdienst:'Pemë & dru'},
 en:{choose:'Choose a demo',note:'Sample companies · fictional data',open:'Open demo',bauflow:'Construction',crane:'Crane services',baumdienst:'Trees & timber'},
 de:{choose:'Demo auswählen',note:'Musterfirmen · fiktive Daten',open:'Demo öffnen',bauflow:'Stahlbau',crane:'Kranservice',baumdienst:'Baumpflege & Holz'},
 it:{choose:'Scegli una demo',note:'Aziende di esempio · dati fittizi',open:'Apri demo',bauflow:'Costruzioni',crane:'Servizi gru',baumdienst:'Alberi & legname'},
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderDemoEntries(lang,product){
 const c=copy[lang]??copy.de;
 return `<nav id="demos" class="demo-entry-group${product==='bau'?' demo-entry-bau':''}" aria-label="${esc(c.choose)}"><div class="demo-entry-caption"><span>${esc(c.choose)}</span><small>${esc(c.note)}</small></div><div class="demo-entry-links">${demoEntries.map(d=>`<a class="demo-entry" data-demo-entry="${d.id}" href="${d.href}" aria-label="${esc(`${c.open} · ${d.brand} · ${c[d.id]}`)}"><img src="/demo-assets/${d.logo}" width="48" height="48" alt="" decoding="async"><span class="demo-entry-copy"><strong translate="no">${d.brand}</strong><span>${esc(c[d.id])}</span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></a>`).join('')}</div></nav>`;
}
