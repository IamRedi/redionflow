import type {Metadata} from 'next';
export function publicDemoMetadata(host: string | null, base: Metadata): Metadata {
 const normalized=(host||'').toLowerCase().replace(/:\d+$/,'');
 const product=normalized==='redionflow-production.up.railway.app'?'BaumdienstFlow':normalized==='bauflow-production-1344.up.railway.app'?'BauFlow':null;
 if(!product)return base;
 return {...base,title:product+' · öffentliche Demo',description:product==='BauFlow'?'Öffentliche BauFlow-Demo für Bau- und Stahlbauunternehmen. Fiktive Beispieldaten; Produkt und Angebot: https://www.baumdienstflow.de/bauflow/':'Öffentliche BaumdienstFlow-Demo für Baumdienst- und Baumpflegebetriebe. Fiktive Beispieldaten; Produkt und Angebot: https://www.baumdienstflow.de/',robots:{index:false,follow:true}};
}
