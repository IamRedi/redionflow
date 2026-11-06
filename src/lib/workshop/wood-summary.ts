export function woodSummary(lang:string){
  const copy={
    de:{title:"Holzwerkstatt",text:"Holz aus der Baustelle annehmen, eigene Arbeitsphasen festlegen und verpackten Bestand in Fm, Rm oder Srm führen. Team, Geräte und Fotos bleiben verknüpft; Reparaturen haben ihren eigenen Bereich. Nur in der fiktiven Musterfirma.",open:"Holzwerkstatt ausprobieren"},
    en:{title:"Wood workshop",text:"Receive timber from a worksite, choose your own work phases and track packaged stock in Fm, Rm or Srm. Team, equipment and photos stay linked; repairs have their own area. Fictional Musterfirma only.",open:"Try the wood workshop"},
    sq:{title:"Punëtoria e drurit",text:"Prano dru nga kantieri, cakto fazat e punës dhe ndiq stokun e paketuar në Fm, Rm ose Srm. Ekipi, pajisjet dhe fotot mbeten të lidhura; riparimet kanë zonën e vet. Vetëm në Musterfirma-n fiktive.",open:"Provo punëtorinë e drurit"},
    it:{title:"Laboratorio del legno",text:"Ricevi legname dal cantiere, scegli le fasi di lavoro e gestisci le confezioni in Fm, Rm o Srm. Squadra, attrezzature e foto restano collegate; le riparazioni hanno una sezione distinta. Solo nell’azienda dimostrativa fittizia.",open:"Prova il laboratorio del legno"},
  };return copy[lang as keyof typeof copy]??copy.de;
}
