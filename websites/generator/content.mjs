// Copy for the two product websites (BaumdienstFlow and BauFlow), four locales.
// Screenshots come from local runs of the real application with fictitious
// sample companies only (Baumdienst Musterstadt GmbH, Muster Steel).
export const locales = ['sq', 'en', 'de', 'it'];
const l = (sq, en, de, it) => ({ sq, en, de, it });

export const links = {
  admin: 'https://app-production-8741.up.railway.app/login',
  worker: 'https://app-production-8741.up.railway.app/workzone/login',
  baumDemo: 'https://redionflow-production.up.railway.app/demo',
  kidraht: 'https://kidraht-production-bc4a.up.railway.app/learn',
  contact: (lang) => `https://www.redioncekrezi.de/${lang}#contact`,
  portfolio: (lang) => `https://www.redioncekrezi.de/${lang}`,
};

export const common = {
  skip: l('Kalo te përmbajtja', 'Skip to content', 'Zum Inhalt', 'Vai al contenuto'),
  nav: {
    processes: l('Proceset', 'Processes', 'Abläufe', 'Processi'),
    dashboard: l('Dashboard', 'Dashboard', 'Dashboard', 'Dashboard'),
    tools: l('Mjete falas', 'Free tools', 'Gratis-Tools', 'Strumenti gratis'),
    access: l('Hyrja', 'Access', 'Zugang', 'Accesso'),
    login: l('Hyr', 'Sign in', 'Anmelden', 'Accedi'),
  },
  customer: {
    label: l('Je tashmë klient?', 'Already a customer?', 'Bereits Kunde?', 'Già cliente?'),
    admin: l('Zyra / Admin', 'Office / Admin', 'Büro / Admin', 'Ufficio / Admin'),
    worker: l('Punëtorët · PIN', 'Workers · PIN', 'Mitarbeitende · PIN', 'Lavoratori · PIN'),
  },
  demo: l('Hap demon live', 'Open the live demo', 'Live-Demo öffnen', 'Apri la demo live'),
  request: l('Kërko prezantim', 'Request a walkthrough', 'Präsentation anfragen', 'Richiedi una presentazione'),
  facts: [
    l('Në shfletues, pa instalim', 'In the browser, no installation', 'Im Browser, ohne Installation', 'Nel browser, senza installazione'),
    l('6 gjuhë për ekipin', '6 languages for the crew', '6 Sprachen fürs Team', '6 lingue per la squadra'),
    l('Hosting në BE', 'Hosted in the EU', 'Hosting in der EU', 'Hosting nell’UE'),
    l('Çdo firmë e ndarë veç', 'Every company kept separate', 'Jede Firma sauber getrennt', 'Ogni azienda separata'),
  ],
  roles: {
    eyebrow: l('Rolet', 'Roles', 'Rollen', 'Ruoli'),
    title: l('Çdo rol sheh atë që i duhet.', 'Every role sees what it needs.', 'Jede Rolle sieht, was sie braucht.', 'Ogni ruolo vede ciò che gli serve.'),
  },
  start: {
    eyebrow: l('Si fillohet', 'Getting started', 'So starten Sie', 'Come iniziare'),
    title: l('Gati brenda pak ditësh.', 'Ready within days.', 'In wenigen Tagen startklar.', 'Pronti in pochi giorni.'),
    steps: [
      [l('Shiko platformën', 'See the platform', 'Plattform ansehen', 'Guarda la piattaforma'), l('Demo live ose prezantim i shkurtër me një firmë shembull.', 'A live demo or a short walkthrough with a sample company.', 'Live-Demo oder kurze Präsentation mit einer Musterfirma.', 'Demo live o breve presentazione con un’azienda di esempio.')],
      [l('Ngrejmë firmën tënde', 'We set up your company', 'Wir richten Ihre Firma ein', 'Configuriamo la tua azienda'), l('Punëtorët, mjetet dhe kantieret importohen nga listat ekzistuese.', 'Workers, vehicles and sites are imported from your existing lists.', 'Mitarbeiter, Fahrzeuge und Baustellen werden aus Ihren bestehenden Listen übernommen.', 'Lavoratori, mezzi e cantieri vengono importati dalle tue liste esistenti.')],
      [l('Ekipi nis me PIN', 'The crew starts with a PIN', 'Das Team startet mit PIN', 'La squadra parte con il PIN'), l('Çdo punëtor hyn me telefon. Zyra sheh gjithçka live që në ditën e parë.', 'Every worker signs in on the phone. The office sees everything live from day one.', 'Jeder Mitarbeiter meldet sich am Handy an. Das Büro sieht alles live ab dem ersten Tag.', 'Ogni lavoratore accede dal telefono. L’ufficio vede tutto dal vivo dal primo giorno.')],
    ],
    contact: l('Na shkruaj', 'Get in touch', 'Kontakt aufnehmen', 'Contattaci'),
  },
  access: {
    eyebrow: l('Hyrja', 'Access', 'Zugang', 'Accesso'),
    title: l('Hyr me rolin tënd.', 'Sign in with your role.', 'Mit Ihrer Rolle anmelden.', 'Accedi con il tuo ruolo.'),
    text: l(
      'Zyra hyn me llogarinë e firmës. Punëtorët hyjnë me PIN-in e tyre personal në telefon.',
      'The office signs in with the company account. Workers sign in on the phone with their personal PIN.',
      'Das Büro meldet sich mit dem Firmenkonto an. Mitarbeitende melden sich am Handy mit ihrem persönlichen PIN an.',
      'L’ufficio accede con l’account aziendale. I lavoratori accedono dal telefono con il loro PIN personale.',
    ),
  },
  tools: {
    eyebrow: l('Mjete falas', 'Free tools', 'Kostenlose Tools', 'Strumenti gratuiti'),
    title: l('Mjete falas për firmat.', 'Free tools for companies.', 'Kostenlose Tools für Betriebe.', 'Strumenti gratuiti per le aziende.'),
    kidraht: {
      badge: l('Falas · live', 'Free · live', 'Kostenlos · live', 'Gratis · live'),
      text: l(
        'Biblioteka e dijes për punën në terren: libra të ilustruar, kurse bazë dhe teste për kujdesin e pemëve, ndërtimin dhe sigurinë. Përkthim me AI në gjuhën e punëtorit dhe një asistent që përgjigjet nga rregullat e firmës.',
        'The knowledge library for field work: illustrated books, basic courses and tests on tree care, construction and safety. AI translation into the worker’s language and an assistant that answers from the company’s rules.',
        'Die Wissensbibliothek für die Arbeit draußen: illustrierte Bücher, Grundkurse und Tests zu Baumpflege, Bau und Sicherheit. KI-Übersetzung in die Sprache des Mitarbeiters und ein Assistent, der aus den Firmenregeln antwortet.',
        'La biblioteca del sapere per il lavoro sul campo: libri illustrati, corsi base e test su cura degli alberi, edilizia e sicurezza. Traduzione AI nella lingua del lavoratore e un assistente che risponde dalle regole aziendali.',
      ),
      cta: l('Hap bibliotekën', 'Open the library', 'Bibliothek öffnen', 'Apri la biblioteca'),
      alt: l('Biblioteka KiDraht me libra të ilustruar', 'KiDraht library with illustrated books', 'KiDraht-Bibliothek mit illustrierten Büchern', 'Biblioteca KiDraht con libri illustrati'),
      phoneAlt: l('Një libër i KiDraht në telefon', 'A KiDraht book on a phone', 'Ein KiDraht-Buch am Handy', 'Un libro KiDraht sul telefono'),
    },
    arbor: {
      badge: l('Në zhvillim · beta lokale', 'In development · local beta', 'In Entwicklung · lokale Beta', 'In sviluppo · beta locale'),
      text: l(
        'Binjaku dixhital i pemës. Nga foto te dokumentimi: AI ndihmon me matjet, specialisti i rishikon, të dhënat e erës vijnë nga DWD dhe raporti del si PDF. Hapet nga karta e pemës në BaumdienstFlow dhe si mjet në KiDraht.',
        'The digital twin of a tree. From photo to documentation: AI helps with measurements, the specialist reviews them, wind data comes from DWD and the report is a PDF. Opens from the tree card in BaumdienstFlow and as a tool in KiDraht.',
        'Der digitale Zwilling eines Baumes. Vom Foto zur Dokumentation: KI hilft bei den Messwerten, die Fachkraft prüft, Winddaten kommen vom DWD, der Bericht als PDF. Öffnet sich aus der Baumkarte in BaumdienstFlow und als Tool in KiDraht.',
        'Il gemello digitale di un albero. Dalla foto alla documentazione: l’AI aiuta con le misure, lo specialista le verifica, i dati del vento arrivano dal DWD e il report è un PDF. Si apre dalla scheda albero in BaumdienstFlow e come strumento in KiDraht.',
      ),
      steps: [l('Foto', 'Photo', 'Foto', 'Foto'), l('AI', 'AI', 'KI', 'AI'), l('Kontroll', 'Review', 'Prüfung', 'Verifica'), l('Raport', 'Report', 'Bericht', 'Report')],
      note: l('Mjet ndihmës për dokumentim. Nuk zëvendëson kontrollin e sigurisë nga specialisti.', 'A documentation aid. It does not replace a safety inspection by a specialist.', 'Eine Hilfe zur Dokumentation. Ersetzt keine Verkehrssicherheitsprüfung durch eine Fachkraft.', 'Un aiuto alla documentazione. Non sostituisce un controllo di sicurezza da parte di uno specialista.'),
    },
    more: l('Më shumë mjete së shpejti', 'More tools coming soon', 'Weitere Tools folgen', 'Altri strumenti in arrivo'),
  },
  footer: {
    portfolio: l('Produkte nga Redion', 'Products by Redion', 'Produkte von Redion', 'Prodotti di Redion'),
    top: l('Lart', 'Back to top', 'Nach oben', 'Torna su'),
    imprint: l('Të dhënat ligjore', 'Imprint', 'Impressum', 'Note legali'),
    privacy: l('Privatësia', 'Privacy', 'Datenschutz', 'Privacy'),
    updated: l('Përditësuar më 08.11.2026', 'Updated 8 Nov 2026', 'Aktualisiert am 08.11.2026', 'Aggiornato l’08.11.2026'),
  },
};

const ai = { shot: 'p-phone-ai', title: l('Asistenti AI', 'AI assistant', 'KI-Assistent', 'Assistente AI'), body: l('Pyet në gjuhën tënde. Përgjigjja vjen nga rregullat dhe manualet e firmës, me burim.', 'Ask in your own language. The answer comes from the company’s rules and manuals, with a source.', 'In der eigenen Sprache fragen. Die Antwort kommt aus Regeln und Handbüchern der Firma, mit Quelle.', 'Chiedi nella tua lingua. La risposta arriva da regole e manuali dell’azienda, con la fonte.') };

export const baum = {
  key: 'baum',
  name: 'BaumdienstFlow',
  origin: 'https://www.baumdienstflow.de',
  home: '/',
  aboutDir: 'about',
  themeColor: '#262624',
  ogImage: 'b-desk-wz',
  start: {
    ...common.start,
    title: l('Nga demonstrimi te firma jote.', 'From the demo to your own company.', 'Von der Demo zum eigenen Betrieb.', 'Dalla demo alla tua azienda.'),
    steps: [
      [l('Shiko demonstrimin', 'Explore the demo', 'Demo ansehen', 'Esplora la demo'), l('Njihu me proceset në firmën shembull fiktive. Demoja nuk hap firmën tënde.', 'Explore the workflows in a fictitious sample company. The demo does not create your company.', 'Lernen Sie die Abläufe in einer fiktiven Musterfirma kennen. Die Demo legt Ihre Firma nicht an.', 'Scopri i processi in un’azienda di esempio fittizia. La demo non crea la tua azienda.')],
      [l('Qartëso ofertën dhe konfigurimin', 'Agree the quote and setup', 'Angebot und Einrichtung klären', 'Chiarisci preventivo e configurazione'), l('Para nisjes, qartëso çmimin, shërbimet e përfshira, marrjen e të dhënave dhe afatin e konfigurimit.', 'Before starting, confirm the price, included services, data import and setup timing.', 'Klären Sie vor dem Start Preis, Leistungsumfang, Datenübernahme und Einrichtungstermin.', 'Prima di iniziare, chiarisci prezzo, servizi inclusi, importazione dei dati e tempi di configurazione.')],
      [l('Nis me firmën e konfiguruar', 'Start with your configured company', 'Mit eingerichteter Firma starten', 'Inizia con l’azienda configurata'), l('Pas konfigurimit të veçantë dhe konfirmimit të kushteve, zyra përdor hyrjen e firmës dhe ekipi PIN-et personale.', 'After separate setup and confirmation of the terms, the office uses the company account and the crew uses personal PINs.', 'Nach separater Einrichtung und Bestätigung der Konditionen nutzt das Büro den Firmenzugang und das Team persönliche PINs.', 'Dopo la configurazione separata e la conferma delle condizioni, l’ufficio usa l’account aziendale e la squadra i PIN personali.')],
    ],
    contact: l('Kërko çmimin dhe konfigurimin', 'Request pricing and setup', 'Preis und Einrichtung anfragen', 'Richiedi prezzo e configurazione'),
  },
  buyerInfo: {
    eyebrow: l('Para nisjes', 'Before you start', 'Vor dem Einstieg', 'Prima di iniziare'),
    title: l('Kostoja dhe konfigurimi i firmës.', 'Pricing and company setup.', 'Kosten und Firmeneinrichtung.', 'Costi e configurazione aziendale.'),
    lead: l(
      'Nuk publikojmë çmime fikse në këtë faqe. Kërko ofertë për përdorimin e BaumdienstFlow dhe konfigurimin e firmës; çmimi dhe shërbimet duhen konfirmuar para nisjes.',
      'No fixed price is published on this page. Request a quote for BaumdienstFlow use and company setup; confirm the price and included services before starting.',
      'Auf dieser Seite ist kein Festpreis veröffentlicht. Fragen Sie ein Angebot für die Nutzung von BaumdienstFlow und die Firmeneinrichtung an; bestätigen Sie Preis und Leistungsumfang vor dem Start.',
      'Non pubblichiamo prezzi fissi su questa pagina. Richiedi un preventivo per l’uso di BaumdienstFlow e la configurazione aziendale; conferma prezzo e servizi inclusi prima di iniziare.',
    ),
    questions: [
      [l('Çfarë duhet të qartësojë oferta?', 'What should the quote clarify?', 'Was sollte das Angebot klären?', 'Che cosa deve chiarire il preventivo?'), l(
        'Kërko të ndahen konfigurimi fillestar dhe përdorimi i mëtejshëm: çmimi, periudha e faturimit, modulet e përfshira, marrja e listave ekzistuese dhe mbështetja. Ky website nuk përcakton tarifë ose paketë të detyrueshme.',
        'Ask for initial setup and ongoing use to be set out separately: price, billing period, included modules, import of existing lists and support. This website does not set a binding tariff or package.',
        'Lassen Sie Ersteinrichtung und laufende Nutzung getrennt aufführen: Preis, Abrechnungszeitraum, enthaltene Module, Übernahme vorhandener Listen und Support. Diese Website legt keinen verbindlichen Tarif oder Leistungsumfang fest.',
        'Chiedi di distinguere configurazione iniziale e uso successivo: prezzo, periodo di fatturazione, moduli inclusi, importazione degli elenchi esistenti e assistenza. Questo sito non stabilisce una tariffa o un pacchetto vincolante.',
      )],
      [l('Çfarë të dërgoj në kërkesën e parë?', 'What should I include in my first enquiry?', 'Welche Angaben braucht die erste Anfrage?', 'Quali informazioni servono nella prima richiesta?'), l(
        'Përshkruaj firmën, vendin, madhësinë e ekipit, mjetet dhe kantieret, gjuhët dhe proceset që dëshiron të organizosh. Fillimisht mjaftojnë numrat e përgjithshëm; mënyra dhe përmbajtja e marrjes së listave të firmës qartësohen veçmas. Afati i konfigurimit përcaktohet sipas kërkesës.',
        'Describe your company, country, team size, vehicles and sites, languages and the workflows you want to organise. Aggregate counts are enough initially; agree the method and scope of importing company lists separately. Setup timing depends on the agreed scope.',
        'Beschreiben Sie Betrieb, Land, Teamgröße, Fahrzeuge und Baustellen, Sprachen und gewünschte Abläufe. Für die erste Anfrage genügen Gesamtzahlen; Weg und Umfang der Übernahme von Firmenlisten werden separat geklärt. Der Einrichtungstermin richtet sich nach dem vereinbarten Umfang.',
        'Descrivi azienda, paese, dimensioni della squadra, mezzi e cantieri, lingue e processi desiderati. Inizialmente bastano i numeri complessivi; modalità e contenuto dell’importazione degli elenchi aziendali si concordano separatamente. I tempi dipendono dall’ambito concordato.',
      )],
      [l('A e hap demoja firmën time?', 'Does the demo create my company?', 'Legt die Demo meine Firma an?', 'La demo crea la mia azienda?'), l(
        'Jo. Demoja publike paraqet një firmë shembull me të dhëna fiktive. Hapja e saj ose dërgimi i një kërkese nuk krijon llogari produktive, nuk importon të dhënat e firmës dhe nuk aktivizon shërbim. Hyrja reale dhe konfigurimi qartësohen veçmas; demoja nuk është pranimi operacional i firmës tënde.',
        'No. The public demo shows a sample company with fictitious data. Opening it or sending an enquiry does not create a production account, import company data or activate a service. Real access and setup are agreed separately; the demo is not operational acceptance for your company.',
        'Nein. Die öffentliche Demo zeigt eine Musterfirma mit erfundenen Daten. Das Öffnen der Demo oder eine Anfrage legt kein produktives Firmenkonto an, übernimmt keine Firmendaten und aktiviert keinen Dienst. Echter Zugang und Einrichtung werden separat abgestimmt; die Demo ist keine betriebliche Abnahme für Ihre Firma.',
        'No. La demo pubblica mostra un’azienda di esempio con dati fittizi. Aprirla o inviare una richiesta non crea un account produttivo, non importa dati aziendali e non attiva un servizio. Accesso reale e configurazione si concordano separatamente; la demo non è il collaudo operativo della tua azienda.',
      )],
    ],
    updated: l('Përditësuar më 14.11.2026', 'Updated 14 Nov 2026', 'Aktualisiert am 14.11.2026', 'Aggiornato il 14.11.2026'),
  },
  sister: { name: 'BauFlow', href: (lang) => `/bauflow/about/${lang}.html`, label: l('Për ndërtime çeliku: BauFlow', 'For steel construction: BauFlow', 'Für Stahlbau: BauFlow', 'Per costruzioni in acciaio: BauFlow') },
  title: l('BaumdienstFlow · Softueri për kujdesin e pemëve', 'BaumdienstFlow · Software for tree care companies', 'BaumdienstFlow · Software für Baumdienste und Baumpflege', 'BaumdienstFlow · Software per la cura degli alberi'),
  description: l(
    'BaumdienstFlow lidh zyrën dhe ekipet e kujdesit të pemëve: çdo pemë me kartën e vet dhe atlasin e llojeve, flota, punishtja, punishtja e drurit dhe dashboard live.',
    'BaumdienstFlow connects the office and tree care crews: every tree with its own card and species atlas, fleet, workshop, wood yard and a live dashboard.',
    'BaumdienstFlow verbindet Büro und Baumpflege-Teams: jeder Baum mit eigener Karte und Artenatlas, Flotte, Werkstatt, Holzwerkstatt und Live-Dashboard.',
    'BaumdienstFlow collega ufficio e squadre di cura degli alberi: ogni albero con la sua scheda e l’atlante delle specie, flotta, officina, laboratorio del legno e dashboard live.',
  ),
  hero: {
    eyebrow: l('Për kujdesin e pemëve dhe shërbimet e pemëve', 'For tree care and arborist companies', 'Für Baumpflege und Baumdienste', 'Per la cura degli alberi e servizi arboricoli'),
    h1a: l('Çdo pemë. Çdo ekip.', 'Every tree. Every crew.', 'Jeder Baum. Jedes Team.', 'Ogni albero. Ogni squadra.'),
    h1b: l('Një flow i vetëm.', 'One single flow.', 'Ein einziger Flow.', 'Un unico flusso.'),
    lead: l(
      'Zyra planifikon kantieret, ekipi punon me telefon, dhe të gjithë shohin të njëjtën gjendje, live. Nga atlasi i pemëve te flota, punishtja dhe druri në stok.',
      'The office plans the sites, the crew works from the phone, and everyone sees the same status, live. From the tree atlas to the fleet, the workshop and the wood in stock.',
      'Das Büro plant die Baustellen, das Team arbeitet mit dem Handy, und alle sehen denselben Stand, live. Vom Baum-Atlas über Flotte und Werkstatt bis zum Holzbestand.',
      'L’ufficio pianifica i cantieri, la squadra lavora dal telefono e tutti vedono lo stesso stato, in tempo reale. Dall’atlante degli alberi a flotta, officina e legna in magazzino.',
    ),
    alt: l('Workzone e BaumdienstFlow me kantieret e ditës, firma shembull fiktive', 'BaumdienstFlow Workzone with today’s sites, fictitious sample company', 'BaumdienstFlow-Workzone mit den Baustellen des Tages, fiktive Musterfirma', 'Workzone di BaumdienstFlow con i cantieri del giorno, azienda di esempio fittizia'),
    bar: 'baumdienstflow · workzone',
  },
  processes: {
    eyebrow: l('Proceset', 'Processes', 'Abläufe', 'Processi'),
    title: l('Çdo proces, në xhepin e ekipit.', 'Every process, in the crew’s pocket.', 'Jeder Ablauf, in der Hosentasche.', 'Ogni processo, in tasca alla squadra.'),
    text: l('Zyra punon në kompjuter, ekipi në telefon. Kështu duken proceset kryesore, me të dhëna shembull.', 'The office works on the computer, the crew on the phone. This is how the main processes look, with sample data.', 'Das Büro arbeitet am Rechner, das Team am Handy. So sehen die wichtigsten Abläufe aus, mit Musterdaten.', 'L’ufficio lavora al computer, la squadra al telefono. Ecco i processi principali, con dati di esempio.'),
    cards: [
      { shot: 'p-phone-wz', title: l('Workzone live', 'Live Workzone', 'Workzone live', 'Workzone live'), body: l('Kantieret e ditës me ekipin, progresin, shënimet dhe mjetet. Një prekje dhe hapet kantieri.', 'Today’s sites with crew, progress, notes and equipment. One tap opens the site.', 'Die Baustellen des Tages mit Team, Fortschritt, Hinweisen und Geräten. Ein Tipp öffnet die Baustelle.', 'I cantieri del giorno con squadra, avanzamento, note e attrezzature. Un tocco apre il cantiere.') },
      { shot: 'p-phone-atlas', title: l('Atlasi i pemëve', 'Tree atlas', 'Baum-Atlas', 'Atlante degli alberi'), body: l('Çdo pemë ka kartën e vet. Atlasi tregon llojin me ilustrim: forma, gjethja, lëvorja, lulja.', 'Every tree has its own card. The atlas shows the species illustrated: shape, leaf, bark, flower.', 'Jeder Baum hat seine Karte. Der Atlas zeigt die Art illustriert: Wuchsform, Blatt, Rinde, Blüte.', 'Ogni albero ha la sua scheda. L’atlante mostra la specie illustrata: forma, foglia, corteccia, fiore.') },
      { shot: 'p-phone-fleet', title: l('Flota & kontrollet', 'Fleet & inspections', 'Flotte & Prüftermine', 'Flotta & scadenze'), body: l('Çdo automjet me targë, foto, vend dhe status: në punë, në punishte apo i lirë. Afatet e kontrollit nuk harrohen.', 'Every vehicle with plate, photo, location and status: out, in the workshop or free. Inspection dates are not forgotten.', 'Jedes Fahrzeug mit Kennzeichen, Foto, Standort und Status: unterwegs, in der Werkstatt oder frei. Prüftermine gehen nicht verloren.', 'Ogni veicolo con targa, foto, posizione e stato: fuori, in officina o libero. Le scadenze non si dimenticano.') },
      { shot: 'p-phone-repair', title: l('Punishtja & riparimet', 'Workshop & repairs', 'Werkstatt & Reparaturen', 'Officina & riparazioni'), body: l('Defekti raportohet me foto ose skanim. Punishtja e merr, e riparon dhe e lëshon sërish, me histori.', 'A defect is reported with a photo or a scan. The workshop accepts, repairs and releases it, with history.', 'Defekt per Foto oder Scan melden. Die Werkstatt nimmt an, repariert und gibt frei, mit Historie.', 'Il guasto si segnala con foto o scansione. L’officina lo prende, lo ripara e lo rilascia, con storico.') },
      { shot: 'p-phone-wood', title: l('Punishtja e drurit', 'Wood workshop', 'Holzwerkstatt', 'Laboratorio del legno'), body: l('Nga druri që hyn te dru zjarri i paketuar: hyrja, prodhimi dhe stoku, me sasi dhe porosi.', 'From incoming timber to packed firewood: intake, production and stock, with quantities and orders.', 'Vom Holzeingang bis zum verpackten Brennholz: Eingang, Produktion und Bestand, mit Mengen und Aufträgen.', 'Dal legno in entrata alla legna confezionata: ingresso, produzione e magazzino, con quantità e ordini.') },
      { shot: 'p-phone-tools', title: l('Inventari', 'Inventory', 'Inventar', 'Inventario'), body: l('Sharra, makineri dhe vegla me kod. Një skanim tregon ku është, kush e ka dhe a është në rregull.', 'Saws, machines and tools with a code. One scan shows where it is, who has it and whether it is fine.', 'Sägen, Maschinen und Werkzeuge mit Code. Ein Scan zeigt, wo es ist, wer es hat und ob es in Ordnung ist.', 'Motoseghe, macchine e attrezzi con codice. Una scansione mostra dov’è, chi ce l’ha e se è a posto.') },
      { shot: 'p-phone-dash', title: l('Dashboard view', 'Dashboard view', 'Dashboard view', 'Dashboard view'), body: l('Orët e muajit, progresi i çdo kantieri dhe ekipi në grafika të qarta. Edhe në ekranin e madh të zyrës.', 'Hours of the month, progress per site and the crew in clear charts. Also on the big office screen.', 'Stunden des Monats, Fortschritt je Baustelle und Team in klaren Grafiken. Auch auf dem großen Büro-Bildschirm.', 'Ore del mese, avanzamento per cantiere e squadra in grafici chiari. Anche sul grande schermo dell’ufficio.') },
      ai,
    ],
  },
  showcase: {
    eyebrow: l('Në kompjuter', 'On the desktop', 'Am Rechner', 'Al computer'),
    title: l('Nga atlasi te druri në stok.', 'From the atlas to the wood in stock.', 'Vom Atlas bis zum Holzbestand.', 'Dall’atlante alla legna in magazzino.'),
    text: l(
      'Çdo pemë ka kartën e vet me llojin nga atlasi. Ekipi e shënon direkt në punë, ndërsa zyra sheh kantieret, flotën, riparimet dhe drurin në stok.',
      'Every tree has its own card with the species from the atlas. The crew ticks it off on the job, while the office sees sites, fleet, repairs and wood in stock.',
      'Jeder Baum hat seine Karte mit der Art aus dem Atlas. Das Team hakt direkt im Einsatz ab, das Büro sieht Baustellen, Flotte, Reparaturen und Holzbestand.',
      'Ogni albero ha la sua scheda con la specie dall’atlante. La squadra spunta sul lavoro, l’ufficio vede cantieri, flotta, riparazioni e legna in magazzino.',
    ),
    points: [
      l('Atlasi i llojeve: çdo pemë me ilustrim, gjethe, lëvore dhe lule', 'Species atlas: every tree illustrated with leaf, bark and flower', 'Artenatlas: jeder Baum illustriert mit Blatt, Rinde und Blüte', 'Atlante delle specie: ogni albero illustrato con foglia, corteccia e fiore'),
      l('Kartat e pemëve me status, pengesa dhe material sigurie', 'Tree cards with status, blockers and safety material', 'Baumkarten mit Status, Problemen und Sicherheitsmaterial', 'Schede albero con stato, problemi e materiale di sicurezza'),
      l('Punishtja e drurit: hyrja, prodhimi, stoku', 'Wood workshop: intake, production, stock', 'Holzwerkstatt: Eingang, Produktion, Bestand', 'Laboratorio del legno: ingresso, produzione, magazzino'),
      l('Punishtja, inventari dhe flota me skanim, nga defekti te lëshimi', 'Workshop, inventory and fleet with scanning, from defect to release', 'Werkstatt, Inventar und Flotte mit Scan, vom Defekt bis zur Freigabe', 'Officina, inventario e flotta con scansione, dal guasto al rilascio'),
    ],
    shots: [
      ['b-desk-atlas', l('Atlasi · Mështekna me gjethe, lëvore dhe lule', 'Atlas · birch with leaf, bark and catkins', 'Artenatlas · Birke mit Blatt, Rinde und Kätzchen', 'Atlante · betulla con foglia, corteccia e amenti')],
      ['b-desk-grid', l('Kantieri · çdo pemë si kartë', 'Site · every tree as a card', 'Baustelle · jeder Baum als Karte', 'Cantiere · ogni albero come scheda')],
      ['b-desk-tree', l('Karta e pemës · status dhe siguria', 'Tree card · status and safety', 'Baumkarte · Status und Absicherung', 'Scheda albero · stato e sicurezza')],
      ['b-desk-wood', l('Punishtja e drurit · nga hyrja te stoku', 'Wood workshop · from intake to stock', 'Holzwerkstatt · vom Eingang zum Bestand', 'Laboratorio del legno · dall’ingresso al magazzino')],
      ['b-desk-workshop', l('Punishtja · defekt, riparim, lëshim', 'Workshop · defect, repair, release', 'Werkstatt · Defekt, Reparatur, Freigabe', 'Officina · guasto, riparazione, rilascio')],
    ],
    note: l('Në foto: firma shembull Baumdienst Musterstadt GmbH. Të gjithë personat dhe të dhënat janë fiktive.', 'Shown: sample company Baumdienst Musterstadt GmbH. All people and data are fictitious.', 'Gezeigt: Musterfirma Baumdienst Musterstadt GmbH. Alle Personen und Daten sind erfunden.', 'Nelle immagini: azienda di esempio Baumdienst Musterstadt GmbH. Persone e dati sono fittizi.'),
  },
  dashboard: {
    title: l('E gjithë firma, në një shikim.', 'The whole company at a glance.', 'Der ganze Betrieb auf einen Blick.', 'Tutta l’azienda in un colpo d’occhio.'),
    text: l('Dashboard view tregon ditën dhe muajin në grafika: kush punon, sa orë, sa ka përparuar çdo kantier. Mund të hapet edhe si ekran i madh në zyrë.', 'The dashboard view shows the day and the month in charts: who works, how many hours, how far each site has come. It also runs as a big screen in the office.', 'Die Dashboard-Ansicht zeigt Tag und Monat in Grafiken: wer arbeitet, wie viele Stunden, wie weit jede Baustelle ist. Läuft auch als großer Bildschirm im Büro.', 'La vista dashboard mostra giorno e mese in grafici: chi lavora, quante ore, a che punto è ogni cantiere. Funziona anche come grande schermo in ufficio.'),
    points: [
      l('Trendi i orëve të muajit', 'Monthly hours trend', 'Monatstrend der Stunden', 'Andamento mensile delle ore'),
      l('Progresi i kantiereve sipas pemëve të kryera', 'Site progress by finished trees', 'Baustellen-Fortschritt nach erledigten Bäumen', 'Avanzamento dei cantieri per alberi completati'),
      l('Orët e javës sipas kantierit dhe punëtorit', 'Weekly hours per site and worker', 'Wochenstunden je Baustelle und Mitarbeiter', 'Ore settimanali per cantiere e lavoratore'),
    ],
    main: ['b-desk-dash', l('Dashboard view · orë dhe progres', 'Dashboard view · hours and progress', 'Dashboard view · Stunden und Fortschritt', 'Dashboard view · ore e avanzamento')],
    phone: 'p-phone-dash',
  },
  roles: [
    [l('Zyra & pronari', 'Office & owner', 'Büro & Inhaber', 'Ufficio & titolare'), l('Planifikim, personel, flotë dhe raporte. Hyrje me llogarinë e firmës.', 'Planning, people, fleet and reports. Sign-in with the company account.', 'Planung, Personal, Flotte und Auswertungen. Anmeldung mit dem Firmenkonto.', 'Pianificazione, personale, flotta e report. Accesso con l’account aziendale.')],
    [l('Kryepunëtorët', 'Crew leads', 'Vorarbeiter', 'Capisquadra'), l('Kontrollojnë pemët, sigurinë e kantierit dhe mjetet e ekipit.', 'Check trees, site safety and the crew’s equipment.', 'Prüfen Bäume, Absicherung und die Geräte des Teams.', 'Controllano alberi, sicurezza del cantiere e attrezzature della squadra.')],
    [l('Punëtorët', 'Workers', 'Mitarbeitende', 'Lavoratori'), l('PIN personal me 6 shifra. Nisin kohën, shënojnë pemët, dërgojnë foto, në gjuhën e tyre.', 'A personal 6-digit PIN. Start the clock, tick off trees, send photos, in their own language.', 'Persönlicher 6-stelliger PIN. Zeit starten, Bäume abhaken, Fotos senden, in der eigenen Sprache.', 'PIN personale di 6 cifre. Avviano il tempo, spuntano gli alberi, inviano foto, nella propria lingua.')],
  ],
  tools: ['kidraht', 'arbor'],
  toolsText: l('Përveç platformës, ofrojmë mjete që i ndihmojnë ekipet çdo ditë. Të parat janë KiDraht dhe ArborTwin.', 'Alongside the platform we offer tools that help crews every day. The first are KiDraht and ArborTwin.', 'Neben der Plattform bieten wir Tools, die Teams jeden Tag helfen. Die ersten sind KiDraht und ArborTwin.', 'Oltre alla piattaforma offriamo strumenti che aiutano le squadre ogni giorno. I primi sono KiDraht e ArborTwin.'),
};

const art = (key, sq, en, de, it) => [key, l(sq, en, de, it)];

export const bau = {
  key: 'bau',
  reference: {
    name: 'AL-Steel Construction',
    photoAlt: l('Montim konstruksioni metalik, foto nga faqja zyrtare e AL-Steel', 'Steel structure assembly, photo from AL-Steel’s official website', 'Montage einer Stahlkonstruktion, Foto von der offiziellen AL-Steel-Website', 'Montaggio di una struttura metallica, foto dal sito ufficiale di AL-Steel'),
    href: 'https://alsteel.al/',
    label: l('Në përdorim real', 'Used in real operations', 'Im betrieblichen Einsatz', 'In uso operativo'),
    location: l('Qerekë, Krujë · Shqipëri', 'Qerekë, Krujë · Albania', 'Qerekë, Krujë · Albanien', 'Qerekë, Krujë · Albania'),
    description: l(
      'Projektim, prodhim dhe montim konstruksionesh metalike për objekte industriale dhe ambiente logjistike.',
      'Design, fabrication and assembly of steel structures for industrial buildings and logistics facilities.',
      'Planung, Fertigung und Montage von Stahlkonstruktionen für Industriegebäude und Logistikanlagen.',
      'Progettazione, produzione e montaggio di strutture metalliche per edifici industriali e spazi logistici.',
    ),
    usage: l(
      'AL-Steel përdor realisht BauFlow për të lidhur zyrën, punishten dhe kantierin në punën e përditshme.',
      'AL-Steel uses BauFlow in its daily operations to connect the office, workshop and construction site.',
      'AL-Steel nutzt BauFlow im Arbeitsalltag, um Büro, Werkstatt und Baustelle zu verbinden.',
      'AL-Steel utilizza BauFlow nel lavoro quotidiano per collegare ufficio, officina e cantiere.',
    ),
    cta: l('Vizito alsteel.al', 'Visit alsteel.al', 'alsteel.al besuchen', 'Visita alsteel.al'),
  },
  name: 'BauFlow',
  origin: 'https://www.baumdienstflow.de/bauflow',
  home: '/bauflow/',
  aboutDir: 'bauflow/about',
  // Current BauFlow editions live in bauflow-copy.mjs; no parallel legacy copy.
};
