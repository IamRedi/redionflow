const en={previous:"Previous sites",next:"Next sites",page:"Sites",information:"Archive & information"};
const de:typeof en={previous:"Vorherige Baustellen",next:"Nächste Baustellen",page:"Baustellen",information:"Archiv & Informationen"};
const sq:typeof en={previous:"Kantieret e mëparshme",next:"Kantieret e ardhshme",page:"Kantieret",information:"Arkivi & informacioni"};
const it:typeof en={previous:"Cantieri precedenti",next:"Cantieri successivi",page:"Cantieri",information:"Archivio e informazioni"};
const pl:typeof en={previous:"Poprzednie budowy",next:"Następne budowy",page:"Budowy",information:"Archiwum i informacje"};
const ro:typeof en={previous:"Șantierele anterioare",next:"Șantierele următoare",page:"Șantiere",information:"Arhivă și informații"};
export function sceneCopy(lang:string):typeof en{return ({de,sq,it,pl,ro} as Record<string,typeof en>)[lang]??en;}
