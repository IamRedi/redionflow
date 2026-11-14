import {applyProductIdentity} from './product-identity.mjs';
import copy from './geo-markets-copy.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function applyGeoMarkets(html,product,lang,isIndex=false){
 if(!['bau','baum'].includes(product)||!copy[lang])throw Error('Unknown product or locale');
 if(html.includes('data-geo-markets'))throw Error('Market copy already applied');
 const c=copy[lang],name=product==='bau'?'BauFlow':'BaumdienstFlow',origin='https://www.baumdienstflow.de'+(product==='bau'?'/bauflow':''),home=origin+'/',url=(isIndex||lang==='de')?home:origin+'/about/'+lang;
 html=html.replace(/<title>[^<]*<\/title>/,`<title>${esc(c[product+'Title'])}</title>`).replace(/(<meta name="description" content=")[^"]*(")/,`$1${esc(c[product+'Desc'])}$2`).replace(/(<meta property="og:title" content=")[^"]*(")/,`$1${esc(c[product+'Title'])}$2`).replace(/(<meta property="og:description" content=")[^"]*(")/,`$1${esc(c[product+'Desc'])}$2`);
 html=html.replace(/(<link rel="canonical" href=")[^"]*(")/,`$1${url}$2`).replace(/(<meta property="og:url" content=")[^"]*(")/,`$1${url}$2`);
 for(const l of ['de','en','it','sq'])html=html.replace(new RegExp(`(<link rel="alternate" hreflang="${l}" href=")[^"]*(")`),`$1${l==='de'?home:origin+'/about/'+l}$2`);
 const homePath=product==='bau'?'/bauflow/':'/';
 html=html.replace(/href="((?:about\/|\.\/)(de|en|it|sq))\.html"/g,(_,path,l)=>`href="${l==='de'?homePath:path}"`);
 html=html.replace(/href="(\/(?:bauflow\/)?about\/)(de|en|it|sq)\.html"/g,(_,path,l)=>`href="${l==='de'?(path.startsWith('/bauflow/')?'/bauflow/':'/'):path+l}"`);
 const marker=product==='bau'?'<div class="buyer-questions">':'<div class="buyer-faq">';if(!html.includes(marker))throw Error('Published buyer FAQ must be preserved');
 const summary=product==='bau'?`<span>${esc(c.question)}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`:esc(c.question);
 html=html.replace(marker,marker+`<details data-geo-markets><summary>${summary}</summary><p>${esc(c[product])}</p></details>`);
 const softwareId=home+'#software',graph=[{'@type':'SoftwareApplication','@id':softwareId,name,url:home,applicationCategory:'BusinessApplication',operatingSystem:'Web browser',description:c[product],inLanguage:['de','sq','en','it'],audience:{'@type':'BusinessAudience',audienceType:product==='bau'?'Construction and steel-construction businesses':'Tree-service and tree-care businesses',geographicArea:[{'@type':'Country',name:'Germany'},{'@type':'City',name:'Essen'},{'@type':'AdministrativeArea',name:'North Rhine-Westphalia'},{'@type':'Country',name:'Albania'},{'@type':'City',name:'Tirana'}]}},{'@type':'WebPage','@id':url+'#webpage',url,name:c[product+'Title'],inLanguage:lang,mainEntity:{'@id':softwareId}}];
 // Google site names are domain/subdomain scoped. BauFlow remains a distinct software entity in a subdirectory.
 if(product==='baum'&&isIndex)graph.push({'@type':'WebSite','@id':home+'#website',url:home,name:'BaumdienstFlow'});
 const json=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');
 return applyProductIdentity(html.replace('</head>',`<meta property="og:site_name" content="BaumdienstFlow"><script type="application/ld+json">${json}</script></head>`),product,lang);
}
