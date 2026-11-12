export type ExplicitWorkplace='OFFICE'|'WORKSHOP';
/** Recorded places, never inferred while displaying a clock. */
export function explicitWorkplaceLabel(place:string|null|undefined,language='en'){
 const locale=language.toLowerCase().slice(0,2),i=['sq','en','de','it','pl','ro'].indexOf(locale),n=i<0?1:i;
 return place==='OFFICE'?['Zyrë','Office','Büro','Ufficio','Biuro','Birou'][n]:place==='WORKSHOP'?['Oficinë','Workshop','Werkstatt','Officina','Warsztat','Atelier'][n]:null;
}
