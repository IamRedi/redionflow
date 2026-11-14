import copy from './product-identity-copy.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function applyProductIdentity(html,product,lang){
 if(html.includes('data-product-identity'))throw Error('Identity already applied');
 const c=copy[lang];if(!c||!['bau','baum'].includes(product))throw Error('Unsupported identity');
 const homes={bau:'https://www.baumdienstflow.de/bauflow/',baum:'https://www.baumdienstflow.de/'};
 const url=p=>lang==='de'?homes[p]:homes[p]+'about/'+lang;
 const marker=product==='bau'?'<div class="buyer-questions">':'<div class="buyer-faq">';
 if(!html.includes(marker))throw Error('Established FAQ missing');
 const summary=product==='bau'?`<span>${esc(c.question)}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`:esc(c.question);
 html=html.replace(marker,marker+`<details data-product-identity><summary>${summary}</summary><p>${esc(c.body)}</p><p><a href="${url('bau')}">${esc(c.bau)}</a> · <a href="${url('baum')}">${esc(c.baum)}</a></p></details>`);
 html=html.replace(/<a\b[^>]*>/g,tag=>{
  const href=tag.match(/href="([^"]+)"/)?.[1];if(!href)return tag;
  let parsed;try{parsed=new URL(href);}catch{return tag;}
  if(!['redionflow-production.up.railway.app','bauflow-production-1344.up.railway.app'].includes(parsed.hostname)||!parsed.pathname.startsWith('/demo'))return tag;
  return /rel="/.test(tag)?tag.replace(/rel="([^"]*)"/,(_,rel)=>`rel="${[...new Set([...rel.split(/\s+/).filter(Boolean),'nofollow'])].join(' ')}"`):tag.replace(/>$/,' rel="nofollow">');
 });
 return html.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/s,(_,a,text,z)=>{
  const data=JSON.parse(text),software=data['@graph'].find(x=>x['@type']==='SoftwareApplication');
  if(software.name!==(product==='bau'?'BauFlow':'BaumdienstFlow'))throw Error('Wrong software');
  software.description+=' '+c.body;
  software.creator={'@type':'Person',name:'Redion Çekrezi',url:'https://www.redioncekrezi.de/'};
  software.sameAs=['https://www.redioncekrezi.de/de/projects/'+(product==='bau'?'bauflow':'baumdienstflow')];
  software.isRelatedTo={'@id':homes[product==='bau'?'baum':'bau']+'#software'};
  return a+JSON.stringify(data).replace(/</g,'\\u003c')+z;
 });
}
