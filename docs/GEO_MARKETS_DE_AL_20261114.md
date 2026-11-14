# GeoFindbar — markat/alias-et dhe tregjet Essen/NRW–Tiranë

14 nëntor 2026 · DY KANDIDATË TË TESTUAR / PUBLIKIMI NUK ËSHTË KRYER · API me pagesë: 0.

## Përgjigjja për dukshmërinë

BauFlow dhe BaumdienstFlow kanë tashmë live qartësimet e ofertës, kostos dhe hyrjes nga ciklet e mëparshme. Nuk kemi ende prova që shfaqen mirë për blerësit në Essen/NRW ose Tiranë. Në tetë kërkime të kufizuara, domain-i i produkteve nuk u kthye në URL-të e rezultateve; për BaumdienstFlow dolën portofoli dhe burime të lidhura. Kjo nuk provon mosindeksim ose zero trafik, nuk mat renditjen lokale në Google dhe nuk është benchmark i pavarur AI. Metadata e pyetjeve/rezultateve ruhet pa kopjuar artikuj të plotë.

Search Console u hap në sesionin ekzistues Google te faqja Welcome / Add a website. Në atë pamje nuk kishte matje të pronës së verifikuar për impressions, klikime, vende ose pozicione. Nuk u shtua pronë, u nis verifikim ose u ndryshua DNS. Google shpjegon se indeksimi dhe shfaqja nuk garantohen edhe kur plotësohen kushtet teknike; AI Overviews/AI Mode përdorin bazat e zakonshme SEO, jo një skemë magjike GEO. [Udhëzimi zyrtar](https://developers.google.com/search/docs/appearance/ai-features).

## Kandidati i motorit GeoFindbar

Aplikacioni i testuar: 72393af6b7de12262208996d2f204a2c855e7e75. Runtime aktual mbetet source3b3cb21 / versioni i miratuar më parë. Kontrolli buyer vazhdon explicit_buyer_signals_v4; përmirësohet productScope në version2. Nuk aktivizohet AI provider ose API me pagesë.

Motori lexon markën e header-it me lidhje të sigurt brenda origin-it, pjesët e titullit dhe nyje SoftwareApplication/WebApplication/Product të përputhshme me faqen. Alias-et mësohen vetëm nga nyja e produktit të faqes së konfirmuar dhe emri i dukshëm. Publisher, Organization, sameAs, përmendja e AL-Steel ose një alias i pretenduar nga një produkt tjetër nuk i bashkon produktet. Kufiri i path-it mbetet i veçantë; alias-et nuk zgjerojnë origin/path automatikisht. Leximi është i kufizuar; kodet e shkarkuara nuk ekzekutohen. Mosmarrëveshjet dhe identitetet e paqarta ruhen si unverified me URL/hash/emrat e vëzhguar dhe arsyen, jo si mangësi e provuar e biznesit.

| Platforma | Faqe native me motorin aktual | Faqe të pranuara nga kandidati | Identitete të paverifikuara | Buyer reviews të reja |
|---|---:|---:|---:|---:|
| BauFlow | 7 | 7 | 0 | 0 |
| BaumdienstFlow | 5 | 5 | 0 | 0 |
| KiDraht | 10 | 7 | 3 | 0 |
| FlowGastronomie | 10 | 8 | 2 | 0 |

Katër baseline-t native u kryen realisht nga worker-i aktual. Kandidati u lexoi sërish faqet publike me crawler-in normal: të 27 faqet e pranuara kanë të njëjtat hash-e. Tri faqe KiDraht përfshijnë shell-et JS me emër më të shkurtër; dy pamje demo Flow kanë etiketë masthead-i me monogram që nuk përputhet qartë. Këto pesë përjashtime nuk janë pesë defekte website-i dhe nuk u korrigjuan me hamendësim. Ndarja është qëllimisht konservative, jo njohje universale markash. Raportet mbeten kampione partial.

32 faqe reale të ngrira testojnë identitetin dhe 36 kopje historike mbajnë të pandryshuara rregullat buyer dhe noindex. Testet sintetike veçmas provojnë alias-in eksplicit të dukshëm, titujt e përkthyer, publisher-in e përbashkët, konfliktet dhe inputet e pasigurta. Nuk u rishkrua asnjë raport/përgjigje e mëparshme dhe nuk pretendohet matje e re e një website-i historik. Kaluan TypeScript, 311 teste, build, 54 integrime DB/worker të izoluar, 18 E2E desktop/tablet/mobile dhe audit0 vulnerabilities. Fixture-i i limitit të faqeve u bë me identitet eksplicit; tri pohimet e limitit nuk u ndryshuan. Gabimet fillestare/proba e veçuar dhe PASS-i final ruhen.

## Kandidati konkret GEO për dy website-et

Synimi i pronarit ruhet si **Gjermani, veçanërisht Essen/NRW**, dhe **Shqipëri, kryesisht Tiranë**. Të dyja janë produkte software për firma. BaumdienstFlow nuk reklamohet si firmë lokale prerjeje pemësh; BauFlow nuk ngatërrohet me AL-Steel dhe nuk shpiket zyrë në Tiranë.

Janë përgatitur katër gjuhë reale DE/SQ/EN/IT: një FAQ për audiencën dhe tregjet, title/description për secilin produkt, identitete SoftwareApplication të ndara dhe përshkrime JSON-LD që përputhen me tekstin e dukshëm. Nuk u shpikën çmime, ratings, dëshmi, LocalBusiness, adresë, fiskalizim ose integrim komunal. WebSite/name i domain-it ruhet në nivel domain-i; BauFlow nën /bauflow/ mbetet entitet software më vete. Google nuk mbështet një site-name të veçantë në nivel nëndosjeje. [Site names](https://developers.google.com/search/docs/appearance/site-names).

Canonical-i gjerman konsolidohet te homepage-i përkatës; variantet DE /about/de mbeten alias-e të disponueshme. Hreflang, lidhjet e gjuhëve dhe sitemap përdorin targetet direkte konsistente. Nuk krijohen faqe qytetesh të përsëritura ose premtime renditjeje. [Udhëzimi shumëgjuhësh](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites).

Paketa e plotë statike ka 118 asete + headers: vetëm 10 HTML dhe sitemap ndryshojnë, ndërsa 108 skedarët e tjerë, përfshirë headers, janë byte-identikë me paketën e publikuar f1af3512. Source-i bashkon vetëm parakushtet statike Baum të publikuara më parë me branch-in Bau; aplikacioni nuk ndryshon. Gjeneratori normal riprodhon saktësisht dhjetë faqet e kandidatit pa humbur FAQ-të ekzistuese. 38 vëzhgime reale Chrome para/kandidat kaluan: desktop/narrow, katër gjuhë, temat përkatëse, FAQ me klikim/Enter, target44px+, footer natyral dhe materialet/fontet/kontrollet e pandryshuara. Kandidatët u lexuan edhe nga motori v4 dhe motori i ri pa reviews buyer ose schema-description alarms; kjo nuk mat dukshmërinë AI.

ZIP: BauFlow_BaumdienstFlow_GEO_DE_AL_Kandidat_20261114.zip; 6,066,702 byte; SHA256 8a0af3983964d65e66ceca06d4ea6d499129b438e59ff1c719449cf9c73969d4. Target i propozuar vetëm Cloudflare Pages ekzistues baumdienstflow. Pa merge main/pilot, Railway, AL-Steel app/DB ose provider settings. Paketa nuk është publikuar.

## Marketingu dhe matja

Janë ruajtur tekste të shkurtra draft për reklama DE/SQ dhe synimi B2B i ndarë për dy produktet. Nuk u hap/nisi fushatë reklame, llogari, shpenzim ose mesazh. Për Essen, faqja zyrtare e qytetit përshkruan përdorimin e proMDE për bashkëpunimin komunal; nuk pretendojmë se BaumdienstFlow e zëvendëson ose integrohet me të. [Burimi i qytetit](https://www.essen.de/dasistessen/leben_im_gruenen_/baeume_in_der_stadt/infos_dienstleister_stadtbaummanagement.de.html).

Pas një publikimi të veçantë të miratuar, bëhet readback real i paketës, audit native para/pas dhe përsëriten pyetjet e njëjta të kërkimit në data të dokumentuara. Për rezultate të matshme sipas shtetit/faqes/pyetjes nevojitet akses/pronë Search Console e verifikuar nën scope-in përkatës. Ende nuk ka impressions/clicks/pozicione ose përmirësim të provuar. Asnjë schedule nuk aktivizohet automatikisht.

## Baza dhe kufijtë

1,325 skedarët historikë dhe rreshtat origjinalë në 32 tabela, çelësat/config/financat/profilet ruhen; vetëm katër auditime normale v4 para u shtuan. Backup privat para/kandidat archive-readback PASS, restore i pavarur NOT_RUN. Chrome/serverët/fixture-container i vetë testit janë mbyllur. Source-i, provat, data sintetike, build/cache dhe paketat ruhen në pritje të pranimit; puna tjetër nuk ndërpritet. Pajisja fizike, text zoom/tastiera e sistemit dhe UAT i plotë NOT_VERIFIED. Nuk u nis GitHub Actions ose API me pagesë.

Mbeten dy miratime të ndara: revision-i konkret i GeoFindbar për Studio/worker + katër rikontrolle native, dhe paketa konkrete statike e website-eve + rikontrolli live GEO. Miratimet e vjetra PR23/PR195/PR196 nuk publikojnë këto versione të reja. Presentation/card/About/readiness të aplikacioneve nuk marrin aftësi ose pozicione të reja nga ky kandidat; vetëm PR shoqërues teknik dhe materiale private DRAFT. Pa successor ose schedule automatik.
