import type { SupportedLanguage } from '@/lib/i18n/language';

const sq = {
  desk:'Zyra ime', reception:'Recepsioni', plan:'Plani ditor', tasks:'Detyrat & shënimet', mail:'Posta',
  privateHint:'Shënimet dhe detyrat personale i shikon vetëm ti.', mailHint:'Biseda private mes pjesëmarrësve. Dokumentet zyrtare mbeten te kantieri.',
  newTask:'Shto', compose:'Shkruaj', refresh:'Rifresko', back:'Kthehu', save:'Ruaj', cancel:'Anulo', edit:'Ndrysho',
  note:'Shënim privat', personal:'Detyrë personale', company:'Detyrë e zyrës', all:'Të gjitha', archived:'Arkiva',
  todo:'Për t’u bërë', doing:'Në punë', done:'Përfunduar', title:'Titulli', body:'Përshkrimi', type:'Lloji',
  category:'Kategoria', person:'Përgjegjësi', due:'Afati', priority:'Prioriteti', normal:'Normal', high:'I lartë',
  archive:'Arkivo', restore:'Rikthe', categories:'Kategoritë e punës', setup:'Vendos kategoritë fillestare',
  categoryName:'Emri i kategorisë', addCategory:'Shto kategori', choose:'Zgjidh', empty:'Ende asgjë këtu.',
  companyHint:'Këto detyra i shohin Megi dhe Almeti. Nuk ndryshojnë proceset ose planin ditor.',
  shareConfirm:'E kuptoj: ky shënim bëhet detyrë e përbashkët e zyrës dhe teksti i tij do të shihet nga Megi dhe Almeti.',
  inbox:'Të marra', sent:'Të nisura', unread:'Pa lexuar', to:'Për', subject:'Subjekti', message:'Mesazhi',
  files:'Bashkëngjit skedarë', fileHint:'Deri 3 skedarë: foto, PDF, Word ose Excel. 5 MB secili, 10 MB gjithsej.',
  send:'Dërgo', reply:'Përgjigju', download:'Shkarko', search:'Kërko', saved:'U ruajt.', sentOk:'Mesazhi u dërgua.',
  failed:'Nuk u krye veprimi. Provo përsëri.', conflict:'U ndryshua ndërkohë. Rifresko dhe provo përsëri.',
  denied:'Nuk ke më akses. Hyr përsëri në llogari.', invalid:'Kontrollo fushat dhe kufijtë e skedarëve.',
  limit:'U arrit kufiri. Provo më vonë ose kontakto administratorin.', loading:'Duke punuar…',
  private:'Vetëm unë', shared:'Zyra', notifications:'Mesazhe të palexuara', noRecipient:'Nuk ka marrës aktiv.',today:'Sot',status:'Gjendja',toTask:'Kthe në detyrë',
};
const en: typeof sq = {
  desk:'My office', reception:'Reception', plan:'Daily plan', tasks:'Tasks & notes', mail:'Mail',
  privateHint:'Only you can see your personal notes and tasks.', mailHint:'Private conversations between participants. Official documents stay with the site.',
  newTask:'Add', compose:'Compose', refresh:'Refresh', back:'Back', save:'Save', cancel:'Cancel', edit:'Edit',
  note:'Private note', personal:'Personal task', company:'Office task', all:'All', archived:'Archive',
  todo:'To do', doing:'In progress', done:'Done', title:'Title', body:'Description', type:'Type',
  category:'Category', person:'Assignee', due:'Due date', priority:'Priority', normal:'Normal', high:'High',
  archive:'Archive', restore:'Restore', categories:'Work categories', setup:'Set up initial categories',
  categoryName:'Category name', addCategory:'Add category', choose:'Choose', empty:'Nothing here yet.',
  companyHint:'Megi and Almet can see office tasks. These do not change production processes or the daily plan.',
  shareConfirm:'I understand: this note becomes a shared office task and its text will be visible to Megi and Almet.',
  inbox:'Received', sent:'Started by me', unread:'Unread', to:'To', subject:'Subject', message:'Message',
  files:'Attach files', fileHint:'Up to 3 files: photos, PDF, Word or Excel. 5 MB each, 10 MB total.',
  send:'Send', reply:'Reply', download:'Download', search:'Search', saved:'Saved.', sentOk:'Message sent.',
  failed:'The action could not be completed. Try again.', conflict:'Changed in the meantime. Refresh and try again.',
  denied:'Access is no longer available. Sign in again.', invalid:'Check the fields and file limits.',
  limit:'Limit reached. Try later or contact the administrator.', loading:'Working…',
  private:'Only me', shared:'Office', notifications:'Unread messages', noRecipient:'No active recipient.',today:'Today',status:'Status',toTask:'Make a task',
};
export function officeWorkCopy(lang: SupportedLanguage){ return lang==='sq'?sq:en; }
export type OfficeWorkCopy=typeof sq;
