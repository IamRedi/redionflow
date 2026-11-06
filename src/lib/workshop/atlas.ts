import type { BotanicalKind } from "./botanical";
import type { StudioMediaId } from "./studio-media";

/** Compact editorial facts, translated in de/sq/en/it/pl/ro order. */
export const atlasText = (value: string, lang: string) => value.split("|")[({ de: 0, sq: 1, en: 2, it: 3, pl: 4, ro: 5 } as Record<string, number>)[lang] ?? 2];
export function atlasCopy(lang: string) {
  const l = (s: string) => atlasText(s, lang);
  return {
    open: l("Artenkarte öffnen|Hap kartën e llojit|Open species card|Apri scheda specie|Otwórz kartę gatunku|Deschide fișa speciei"),
    title: l("Artenatlas|Atlasi i pemëve|Tree atlas|Atlante degli alberi|Atlas drzew|Atlasul arborilor"),
    overview: l("Blueprint|Blueprint|Blueprint|Blueprint|Blueprint|Blueprint"),
    habit: l("Wuchsform|Forma|Tree form|Portamento|Pokrój|Formă"),
    leaf: l("Blatt / Nadeln|Gjethja / halat|Leaf / needles|Foglia / aghi|Liść / igły|Frunză / ace"),
    bark: l("Rinde|Lëvorja|Bark|Corteccia|Kora|Scoarță"),
    reproduction: l("Blüte · Frucht / Zapfen|Lulja · fruti / boçet|Flower · fruit / cones|Fiore · frutto / coni|Kwiat · owoc / szyszki|Floare · fruct / conuri"),
    more: l("Mehr über diese Art|Më shumë për këtë lloj|More about this species|Altre informazioni sulla specie|Więcej o tym gatunku|Mai multe despre specie"),
    attention: l("Vor Ort beachten|Kujdes në terren|On site|Sul posto|W terenie|Pe teren"),
    sources: l("Botanische Quellen|Burime botanike|Botanical sources|Fonti botaniche|Źródła botaniczne|Surse botanice"),
    representative: l("Beispielart zur eingetragenen Pflanzengruppe. Die genaue Art vor Ort vergleichen.|Lloj shembull për grupin e regjistruar. Krahaso llojin e saktë në terren.|Example species for the recorded plant group. Compare the exact species on site.|Specie di esempio per il gruppo registrato. Confronta la specie esatta sul posto.|Przykładowy gatunek dla zapisanej grupy. Porównaj dokładny gatunek w terenie.|Specie exemplu pentru grupul înregistrat. Compară specia exactă pe teren."),
    unknown: l("Für diesen Namen ist noch keine geprüfte Referenz hinterlegt. Art im Baumdatensatz präzisieren.|Për këtë emër ende nuk ka referencë të kontrolluar. Saktëso llojin te të dhënat e pemës.|No reviewed reference is available for this name. Refine the species in the tree record.|Nessun riferimento verificato per questo nome. Precisa la specie nella scheda dell’albero.|Brak sprawdzonego opisu dla tej nazwy. Uściślij gatunek w karcie drzewa.|Nu există încă o referință verificată pentru acest nume. Precizează specia în fișa arborelui."),
    illustration: l("KI-Lernillustration · unterschiedliche Jahreszeiten · keine Bestimmung des konkreten Baums|Ilustrim mësimor AI · stinë të ndryshme · nuk identifikon pemën konkrete|AI learning illustration · different seasons · does not identify the actual tree|Illustrazione didattica AI · stagioni diverse · non identifica l’albero reale|Ilustracja edukacyjna AI · różne pory roku · nie identyfikuje konkretnego drzewa|Ilustrație educativă AI · anotimpuri diferite · nu identifică arborele real"),
    compare: l("Blattstellung, Knospen, Rinde und Früchte gemeinsam vergleichen. Alter, Sorte und Schnitt verändern die Form.|Krahaso bashkë vendosjen e gjetheve, sythat, lëvoren dhe frutat. Mosha, varieteti dhe krasitja ndryshojnë formën.|Compare leaf arrangement, buds, bark and fruit together. Age, cultivar and pruning change the form.|Confronta insieme foglie, gemme, corteccia e frutti. Età, cultivar e potatura cambiano la forma.|Porównaj układ liści, pąki, korę i owoce. Wiek, odmiana i cięcie zmieniają pokrój.|Compară frunzele, mugurii, scoarța și fructele împreună. Vârsta, soiul și tăierea schimbă forma."),
    report: l("Abweichungen und Schäden mit Foto am tatsächlichen Baum dokumentieren und über „Melden“ weitergeben.|Dokumento ndryshimet dhe dëmtimet me foto të pemës reale dhe dërgoji te “Raporto”.|Document changes and damage with a photo of the actual tree and use Report.|Documenta anomalie e danni con una foto dell’albero reale e usa Segnala.|Udokumentuj zmiany i uszkodzenia zdjęciem drzewa i użyj Zgłoś.|Documentează modificările și daunele cu fotografia arborelui real și folosește Raportează."),
    hedge: l("Die Heckenform entsteht durch Schnitt. Blatt und Rinde gehören zur Pflanzenart; Blüten und Früchte können nach Schnitt fehlen.|Forma e gardhit krijohet nga krasitja. Gjethja dhe lëvorja i përkasin llojit; lulet dhe frutat mund të mungojnë pas krasitjes.|Pruning creates the hedge shape. Leaves and bark belong to the species; flowers and fruit may be absent after clipping.|La potatura crea la forma della siepe. Foglie e corteccia sono proprie della specie; fiori e frutti possono mancare dopo il taglio.|Cięcie tworzy kształt żywopłotu. Liście i kora należą do gatunku; po cięciu kwiaty i owoce mogą nie występować.|Tăierea creează forma gardului viu. Frunzele și scoarța țin de specie; florile și fructele pot lipsi după tundere."),
    catalogue: l("KI-Katalogillustration|Ilustrim AI i katalogut|AI catalogue illustration|Illustrazione AI di catalogo|Ilustracja katalogowa AI|Ilustrație AI de catalog"),
  };
}

const facts = {
  spreading: "Breite, ausladende Krone|Kurorë e gjerë|Broad spreading crown|Chioma ampia|Szeroka korona|Coroană largă",
  rounded: "Rundliche Krone|Kurorë e rrumbullakët|Rounded crown|Chioma arrotondata|Zaokrąglona korona|Coroană rotunjită",
  airy: "Lichte Krone, feine Zweige|Kurorë e ajrosur, degë të holla|Airy crown, fine twigs|Chioma rada, rami fini|Lekka korona, cienkie gałązki|Coroană aerată, ramuri fine",
  conical: "Kegelförmige Krone|Kurorë konike|Conical crown|Chioma conica|Stożkowata korona|Coroană conică",
  shrub: "Dicht verzweigter Strauch|Shkurre me degë të dendura|Densely branched shrub|Arbusto fitto|Gęsto rozgałęziony krzew|Arbust dens ramificat",
  graySmooth: "Glatt, graubraun|E lëmuar, gri-kafe|Smooth, gray-brown|Liscia, grigio-bruna|Gładka, szarobrązowa|Netedă, gri-brună",
  smooth: "Glatt, silbergrau|E lëmuar, gri e argjendtë|Smooth, silver-gray|Liscia, grigio argento|Gładka, srebrzystoszara|Netedă, gri-argintie",
  fissured: "Im Alter graubraun, rissig|Gri-kafe, e çarë në moshë|Gray-brown, fissured with age|Grigio-bruna, fessurata con l’età|Szarobrązowa, spękana z wiekiem|Gri-brună, fisurată cu vârsta",
  scaly: "Im Alter schuppige Platten|Pllaka luspuese në moshë|Scaly plates with age|Placche squamose con l’età|Łuszczące płaty z wiekiem|Plăci solzoase cu vârsta",
  flaky: "Fleckig abblätternde Borke|Lëvore që zhvishet me njolla|Mottled flaking bark|Corteccia a chiazze sfogliata|Łuszcząca się plamista kora|Scoarță exfoliată în pete",
  birch: "Weiß, papierartig ablösend|E bardhë, zhvishet si letër|White, papery peeling|Bianca, sfoglie cartacee|Biała, papierowo łuszcząca|Albă, exfoliere ca hârtia",
  fluted: "Grau, längs gerippt|Gri, me brinjë gjatësore|Gray, vertically fluted|Grigia, scanalata verticalmente|Szara, podłużnie żebrowana|Gri, canelată vertical",
  orange: "Oben orange, unten tief rissig|Portokalli sipër, e çarë poshtë|Orange above, deeply fissured below|Arancione in alto, fessurata sotto|Pomarańczowa u góry, spękana u dołu|Portocalie sus, fisurată jos",
  fibrous: "Rotbraun, faserig ablösend|Kafe e kuqërremtë, fibroze|Reddish brown, fibrous peeling|Bruno-rossa, fibrosa|Czerwonobrązowa, włóknista|Roșcat-brună, fibroasă",
  oak: "Kätzchen; gestielte Eicheln|Maceza; lende me bisht|Catkins; stalked acorns|Amenti; ghiande peduncolate|Kotki; żołędzie na szypułkach|Amenți; ghinde pedunculate",
  maple: "Gelbgrüne Trauben; Flügelfrüchte|Tufa verdhë-jeshile; fara me krahë|Yellow-green racemes; winged samaras|Racemi giallo-verdi; samare|Żółtozielone grona; skrzydlaki|Raceme galben-verzi; samare",
  redMaple: "Rote Frühblüten; Flügelfrüchte|Lule të hershme të kuqe; fara me krahë|Early red flowers; winged samaras|Fiori rossi precoci; samare|Wczesne czerwone kwiaty; skrzydlaki|Flori roșii timpurii; samare",
  plane: "Kugelige Blüten- und Fruchtstände|Tufa lulesh dhe frutash sferike|Spherical flower and seed heads|Infiorescenze e frutti sferici|Kuliste kwiatostany i owocostany|Inflorescențe și fructificații sferice",
  catkins: "Männliche und weibliche Kätzchen|Maceza mashkullore dhe femërore|Male and female catkins|Amenti maschili e femminili|Kotki męskie i żeńskie|Amenți masculi și femeli",
  beech: "Kugelige Blüten; stachelige Bucheckernhülle|Lule sferike; kupulë me gjemba|Rounded flowers; prickly mast cupules|Fiori globosi; cupole spinose|Kuliste kwiaty; kolczaste miseczki|Flori globuloase; cupe spinoase",
  hornbeam: "Kätzchen; dreilappige Fruchthüllen|Maceza; mbështjellje me tri lobe|Catkins; three-lobed fruit bracts|Amenti; brattee trilobate|Kotki; trójklapowe podsadki|Amenți; bractee trilobate",
  ash: "Violette Blüten; Flügelfrüchte|Lule vjollcë; fara me krahë|Purple flowers; winged keys|Fiori porpora; samare|Fioletowe kwiaty; skrzydlaki|Flori purpurii; samare",
  lime: "Helle Blüten mit flügelartigem Hochblatt|Lule të çelëta me brakte si krah|Pale flowers with strap-like bract|Fiori chiari con brattea allungata|Jasne kwiaty z języczkowatą podsadką|Flori deschise cu bractee alungită",
  apple: "Fünf helle Blütenblätter; Äpfel|Pesë petale të çelëta; mollë|Five pale petals; apples|Cinque petali chiari; mele|Pięć jasnych płatków; jabłka|Cinci petale deschise; mere",
  chestnut: "Weiße Blütenkerzen; stachelige Fruchthüllen|Tufa të bardha; mbështjellje me gjemba|White flower panicles; spiny husks|Pannocchie bianche; ricci spinosi|Białe wiechy; kolczaste łupiny|Panicule albe; învelișuri spinoase",
  rowan: "Weiße Blütendolden; rote Früchte|Tufa të bardha; fruta të kuqe|White flower clusters; red fruit|Corimbi bianchi; frutti rossi|Białe kwiatostany; czerwone owoce|Inflorescențe albe; fructe roșii",
  ginkgo: "Pollenstände oder fleischig umhüllte Samen|Tufa poleni ose fara të mbështjella|Pollen structures or fleshy-coated seeds|Strutture polliniche o semi carnosi|Struktury pyłkowe lub mięsiste nasiona|Structuri polinice sau semințe cărnoase",
  spruce: "Lange, hängende Zapfen|Boçe të gjata, të varura|Long hanging cones|Coni lunghi pendenti|Długie, zwisające szyszki|Conuri lungi pendente",
  fir: "Aufrechte Zapfen, zerfallen am Baum|Boçe përpjetë, shpërbëhen në pemë|Upright cones disintegrate on tree|Coni eretti, si disgregano sull’albero|Szyszki stojące, rozpadają się na drzewie|Conuri erecte, se dezintegrează pe arbore",
  pine: "Holzige Zapfen; gelbliche Pollenstände|Boçe drunore; tufa poleni të verdha|Woody cones; yellowish pollen cones|Coni legnosi; strobili pollinici gialli|Zdrewniałe szyszki; żółte strobile|Conuri lemnoase; conuri polinice gălbui",
  larch: "Kleine Zapfen; junge weibliche rötlich|Boçe të vogla; femëroret e reja të kuqërremta|Small cones; young female cones reddish|Coni piccoli; femminili giovani rossastri|Małe szyszki; młode żeńskie czerwonawe|Conuri mici; cele femele tinere roșcate",
  yew: "Pollenstände; rote Samenmäntel (Arillus)|Tufa poleni; mbështjellje të kuqe farash|Pollen cones; red seed arils|Strobili pollinici; arilli rossi|Strobile pyłkowe; czerwone osnówki|Conuri polinice; arile roșii",
  thuja: "Kleine längliche Zapfen|Boçe të vogla të zgjatura|Small elongated cones|Coni piccoli allungati|Małe wydłużone szyszki|Conuri mici alungite",
  privet: "Weiße Rispen; schwarze Früchte|Tufa të bardha; fruta të zeza|White panicles; black fruit|Pannocchie bianche; frutti neri|Białe wiechy; czarne owoce|Panicule albe; fructe negre",
  box: "Kleine gelbgrüne Achselblüten|Lule të vogla verdhë-jeshile|Small yellow-green axillary flowers|Piccoli fiori ascellari giallo-verdi|Małe żółtozielone kwiaty pachwinowe|Flori axilare mici galben-verzi",
  photinia: "Weiße Blütenstände; rote Jungblätter|Tufa të bardha; gjethe të reja të kuqe|White flower clusters; red young leaves|Corimbi bianchi; foglie giovani rosse|Białe kwiatostany; czerwone młode liście|Inflorescențe albe; frunze tinere roșii",
  norway: "Gelbgrüne Blütenbüschel; Flügelfrüchte|Tufa verdhë-jeshile; fara me krahë|Yellow-green flower clusters; samaras|Corimbi giallo-verdi; samare|Żółtozielone kwiatostany; skrzydlaki|Inflorescențe galben-verzi; samare",
  larchLeaf: "Weiche Nadeln in Rosetten; im Herbst gelb|Hala të buta në tufa; të verdha në vjeshtë|Soft needles in rosettes; yellow in autumn|Aghi morbidi in rosette; gialli in autunno|Miękkie igły w rozetkach; żółte jesienią|Ace moi în rozete; galbene toamna",
} as const;
type Fact = keyof typeof facts;
type Profile = { id: StudioMediaId; latin: string; kind: BotanicalKind; habit: Fact; bark: Fact; reproduction: Fact; source: string; aliases: readonly string[]; generic?: readonly string[]; leaf?: Fact };
const wt = (slug: string) => `https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/british-trees/a-z-of-british-trees/${slug}/`;
export const atlasProfiles: readonly Profile[] = [
  {id:"tree-norway-maple",latin:"Acer platanoides",kind:"maple",habit:"rounded",bark:"fissured",reproduction:"norway",source:wt("norway-maple"),aliases:["spitzahorn","acer platanoides","norway maple"]},
  {id:"tree-large-lime",latin:"Tilia platyphyllos",kind:"lime",habit:"rounded",bark:"fissured",reproduction:"lime",source:wt("large-leaved-lime"),aliases:["sommerlinde","tilia platyphyllos","large leaved lime"]},
  {id:"tree-copper-beech",latin:"Fagus sylvatica · Purpurea Group",kind:"beech",habit:"rounded",bark:"smooth",reproduction:"beech",source:wt("copper-beech"),aliases:["blutbuche","copper beech","fagus sylvatica atropurpurea","fagus sylvatica purpurea"]},
  {id:"tree-hornbeam",latin:"Carpinus betulus",kind:"hornbeam",habit:"rounded",bark:"fluted",reproduction:"hornbeam",source:wt("hornbeam"),aliases:["hainbuche","hainbuchenhecke","hornbeam","carpinus betulus"]},
  {id:"tree-rowan",latin:"Sorbus aucuparia",kind:"rowan",habit:"rounded",bark:"smooth",reproduction:"rowan",source:wt("rowan"),aliases:["eberesche","vogelbeere","rowan","sorbus aucuparia"]},
  {id:"tree-oak",latin:"Quercus robur",kind:"oak",habit:"spreading",bark:"fissured",reproduction:"oak",source:wt("english-oak"),aliases:["stieleiche","quercus robur","english oak"],generic:["eiche","oak","quercus"]},
  {id:"tree-maple",latin:"Acer pseudoplatanus",kind:"maple",habit:"rounded",bark:"scaly",reproduction:"maple",source:wt("sycamore"),aliases:["bergahorn","acer pseudoplatanus","sycamore"],generic:["ahorn","acer","maple"]},
  {id:"tree-red-maple",latin:"Acer rubrum",kind:"maple",habit:"rounded",bark:"fissured",reproduction:"redMaple",source:"https://www.rhs.org.uk/plants/276/acer-rubrum/details",aliases:["rotahorn","roter ahorn","red maple","acer rubrum"]},
  {id:"tree-plane",latin:"Platanus × hispanica",kind:"plane",habit:"spreading",bark:"flaky",reproduction:"plane",source:wt("london-plane"),aliases:["platanus hispanica","platanus x hispanica","platanus acerifolia","platanus x acerifolia","london plane"],generic:["platane","platanus","plane tree"]},
  {id:"tree-birch",latin:"Betula pendula",kind:"birch",habit:"airy",bark:"birch",reproduction:"catkins",source:wt("silver-birch"),aliases:["hangebirke","sandbirke","betula pendula","silver birch"],generic:["birke","betula","birch"]},
  {id:"tree-beech",latin:"Fagus sylvatica",kind:"beech",habit:"rounded",bark:"smooth",reproduction:"beech",source:wt("common-beech"),aliases:["rotbuche","buchenhecke","fagus sylvatica","common beech"],generic:["buche","beech","fagus"]},
  {id:"tree-ash",latin:"Fraxinus excelsior",kind:"ash",habit:"airy",bark:"fissured",reproduction:"ash",source:wt("ash"),aliases:["gemeine esche","fraxinus excelsior","common ash"],generic:["esche","ash","fraxinus"]},
  {id:"tree-lime",latin:"Tilia cordata",kind:"lime",habit:"rounded",bark:"fissured",reproduction:"lime",source:wt("small-leaved-lime"),aliases:["winterlinde","tilia cordata","small leaved lime"],generic:["linde","tilia","lime","linden"]},
  {id:"tree-willow",latin:"Salix alba",kind:"willow",habit:"spreading",bark:"fissured",reproduction:"catkins",source:wt("white-willow"),aliases:["silberweide","salix alba","white willow"],generic:["weide","salix","willow"]},
  {id:"tree-fruit",latin:"Malus domestica",kind:"fruit",habit:"rounded",bark:"scaly",reproduction:"apple",source:wt("apple"),aliases:["apfelbaum","kulturapfel","malus domestica","apple tree"],generic:["malus","apfel"]},
  {id:"tree-chestnut",latin:"Aesculus hippocastanum",kind:"chestnut",habit:"rounded",bark:"scaly",reproduction:"chestnut",source:wt("horse-chestnut"),aliases:["rosskastanie","aesculus hippocastanum","horse chestnut"]},
  {id:"tree-ginkgo",latin:"Ginkgo biloba",kind:"ginkgo",habit:"spreading",bark:"fissured",reproduction:"ginkgo",source:"https://www.kew.org/plants/ginkgo-tree",aliases:["ginkgo biloba"],generic:["ginkgo"]},
  {id:"tree-spruce",latin:"Picea abies",kind:"spruce",habit:"conical",bark:"scaly",reproduction:"spruce",source:wt("norway-spruce"),aliases:["gemeine fichte","picea abies","norway spruce"],generic:["fichte","picea","spruce"]},
  {id:"tree-fir",latin:"Abies alba",kind:"fir",habit:"conical",bark:"fissured",reproduction:"fir",source:"https://forest.jrc.ec.europa.eu/media/atlas/Abies_alba.pdf",aliases:["weisstanne","abies alba","silver fir"],generic:["tanne","abies","fir"]},
  {id:"tree-pine",latin:"Pinus sylvestris",kind:"pine",habit:"airy",bark:"orange",reproduction:"pine",source:wt("scots-pine"),aliases:["waldkiefer","pinus sylvestris","scots pine"],generic:["kiefer","pinus","pine"]},
  {id:"tree-larch",latin:"Larix decidua",kind:"larch",habit:"conical",bark:"fissured",reproduction:"larch",leaf:"larchLeaf",source:"https://naturescalendar.woodlandtrust.org.uk/what-we-record-and-why/species-we-record/trees/european-larch/",aliases:["europaische larche","larix decidua","european larch"],generic:["larche","larix","larch"]},
  {id:"tree-yew",latin:"Taxus baccata",kind:"yew",habit:"shrub",bark:"fibrous",reproduction:"yew",source:wt("yew"),aliases:["eibe","eibenhecke","taxus baccata","common yew"],generic:["taxus","yew"]},
  {id:"tree-thuja",latin:"Thuja occidentalis",kind:"thuja",habit:"conical",bark:"fibrous",reproduction:"thuja",source:"https://www.rhs.org.uk/plants/18137/thuja-occidentalis/details",aliases:["thuja occidentalis","abendlandischer lebensbaum"],generic:["thuja","thujahecke","lebensbaum"]},
  {id:"tree-privet",latin:"Ligustrum vulgare",kind:"privet",habit:"shrub",bark:"graySmooth",reproduction:"privet",source:"https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=1053",aliases:["ligustrum vulgare","wild privet"],generic:["liguster","ligusterhecke","ligustrum","privet"]},
  {id:"tree-box",latin:"Buxus sempervirens",kind:"box",habit:"shrub",bark:"scaly",reproduction:"box",source:wt("box"),aliases:["buxus sempervirens","common box"],generic:["buchs","buchsbaum","buchshecke","buxus","boxwood"]},
  {id:"tree-photinia",latin:"Photinia × fraseri",kind:"photinia",habit:"shrub",bark:"fissured",reproduction:"photinia",source:"https://landscapeplants.oregonstate.edu/plants/photinia-fraseri",aliases:["photinia fraseri","photinia x fraseri","red robin"],generic:["glanzmispel","glanzmispelhecke","photinia"]},
];
const normal = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g,"ss").replace(/×/g,"x").replace(/[-·']/g," ").replace(/\s+/g," ").trim().toLowerCase();
/** Exact aliases only. An unlisted species is never silently assigned another species' plate. */
export function resolveAtlas(name: string) {
  const n = normal(name);
  for (const profile of atlasProfiles) {
    if (profile.aliases.some(a => normal(a) === n)) return { profile, representative: false };
    if (profile.generic?.some(a => normal(a) === n)) return { profile, representative: true };
  }
  return null;
}
export const atlasFact = (key: Fact, lang: string) => atlasText(facts[key], lang);
