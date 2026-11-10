# Steel platform guide (BauFlow, steel companies)

How the platform works for a steel construction company (factory + sites).
The AI assistant reads this guide to explain the app step by step. It is
written for people, not engineers: labels in quotes are the Albanian UI
labels (other languages show the same button translated).

Format: each topic starts with `## <id> | <title>`, then `Who:` (roles that
can do it) and `Words:` (search words in sq/de/en/it). Keep steps short and
true to the app. When something is not in the app, put it in the
"not available" topic instead of inventing a path.

Roles: owner/admin (boss), office (Punonjës zyre), field engineer (Inxhinier
terreni), factory engineer (Inxhinier fabrike), mechanic (Mekanik), field
worker (Punëtor terreni), factory worker (Punëtor fabrike).

## login | Logging in
Who: everyone
Words: hyr, hyrje, login, kodi, pin, fjalëkalim, anmelden, passwort, accesso

- Workers: open the app, type your name and your 6-digit login code, press "Hyrje".
- The owner can also log in with name + 8-digit PIN (set once in the owner's admin profile). Admins can also use email + password.
- Forgot the code: the boss (or office) sets a new code on your profile. You can change your own code in your profile: "Ndrysho kodin e hyrjes" (type the old code, then the new one twice).
- On the phone, the app can be put on the home screen from the browser menu ("Add to home screen").

## language | Changing the language
Who: everyone
Words: gjuha, gjuhë, language, sprache, lingua, shqip, deutsch, italiano

- Press the language button in the top bar ("Gjuha") until your language shows. The choice is saved on your profile.
- Available: Shqip, Deutsch, English, Italiano, Polski, Română.

## home | Workzone home and navigation
Who: everyone
Words: faqja kryesore, home, workzone, menu, ku gjej, navigim, kantieret, startseite

- Workzone home shows the announcement bar, the factory panel ("Fabrika") and one card per construction site (kantier).
- Tap a site card to open the site. The top bar has: your profile, language, notifications, the AI assistant (logo / "AI Ndihmës") and, for admins, "Flota" and "Oficina".
- Admins also have the admin area (dashboard "Panel", "Personel & Flota", settings).

## announcement | Team announcement
Who: everyone can read; writing as shown in the bar
Words: njoftim, lajmërim, mesazh për ekipin, announcement, ankündigung, avviso

- The announcement bar at the top of Workzone shows the current team message.
- Press the small edit icon on the right, type the message, press publish. Your name appears before it. An empty message removes it.

## start-stop-work | Starting and stopping work (hours)
Who: everyone with a worker profile
Words: fillo punën, nis, ndalo, stop, orët, pauza, check in, puno këtu, gabim, arbeit starten, stempeln, ore lavoro

- Open your profile (your photo is always first in the team strip) and press "Start". The site for the day comes from the daily plan.
- Pause: "Pauzë"; end of day: "Stop". The hours are saved only after stop.
- Engineers (field/factory) also have a small "▶ Puno këtu" button on a site page to work on that site; it becomes "■ Ndalo" while they work there.
- A wrong tap undone within 5 seconds is not recorded (start then stop, stop then start again, or a pause ended right away), and the boss gets no notice for it.
- If you forgot to stop, tell the office; they correct the day on your profile.
- Hours history and the monthly report are in your profile. The "Pushime të marra" box shows the holiday days already taken.

## profile | Own profile
Who: everyone
Words: profili, profil, të dhënat, foto profili, dokumentet e mia, profile, mein profil

- Press your name/photo in the top bar.
- There you see: hours (day/month), vacation ("Pushimi"), your tools and clothing ("Pajisje & veshje"), your documents, and "Ndrysho kodin e hyrjes".
- "Ngarko foto profili" sets your photo. Personal data are changed by the office/boss.

## vacation | Asking for vacation
Who: workers ask; admin approves
Words: pushim, leje, kërkoj pushim, urlaub, ferie, vacation, leave, ditë pushimi

- Worker: profile → "Pushimi" → "Kërko pushim" → choose from/to dates → send. Weekends and public holidays are subtracted automatically; the remaining days are shown.
- Admin: the request appears on the worker's profile (and in notifications) → "Aprovo" or reject with a reason. The worker is notified.

## new-project | Creating a new project/site from the drawing office documents
Who: office, admin
Words: projekt i ri, kantier i ri, krijo kantier, ngarko listat, tekla, assemblaggi, lista parti, neues projekt, nuovo progetto

- Workzone → factory panel → "Projekt i ri".
- "Zgjidh dokumentet": choose up to 10 files (Lista assemblaggi .xls/.xlsx, Lista parti, Porositë, drawings PDF, photos).
- Type the site address (the site appears on the map by itself). The name is optional: it is taken from the list.
- Press "Krijo kantierin". Element lists become the factory and field lists; other files become site documents.
- If a site with the same name exists, it is updated, not created twice.
- Optionally choose the engineers for this site while creating it.

## element-lists | Factory list and field list (elements)
Who: everyone can view; factory engineer confirms factory steps; field engineer confirms field steps; admin both
Words: lista e fabrikës, lista e terrenit, element, pjesë, copë, markë, B/12, montim, saldim, prerje, konfirmo, liste, elemente

- Open the site → "Lista e fabrikës" or "Lista e terrenit". Search by mark or profile ("Kërko element, profil…"). Filters: "Të gjitha", "Pa mbaruar".
- Factory steps: Prerje, Montim, Saldim, Pastrim, Lyerje, Ngarkim. Field steps: Pranuar, Montuar, Bulonuar / saldim, Ritokim boje. Parts ("Pjesët") only have Prerje.
- Confirm a step: open the element → tap the step tile → "Sa copë u bënë në këtë proces?" pick the pieces → pick the workers who did them → "Konfirmo <step> · N copë".
- Tile colours: grey nothing, orange some pieces, green all pieces.
- A wrong confirmation is removed with the X on that row (not possible if the site already worked on those pieces).
- "Përfundo elementin": the steps done so far are this element's route; the others are not needed ("Nuk iu desh"). Needs at least one confirmed step. "Rihap" undoes it.
- Pieces go to the field list only when they passed all route steps. Elements still in the factory are grey with a lock ("Në fabrikë") in the field list.
- In the field list the field engineer does the same: step → pieces (only those that arrived) → workers → confirm, then "Përfundo elementin në kantier".
- Ordinary workers can view and report missing material, but cannot confirm.

## reimport-list | Uploading a newer element list
Who: office, admin, authorised engineers
Words: ngarko listat e reja, rifresko listën, lista e re, version i ri, reimport, neue liste

- Site → list → "Ngarko listat e reja (kontrollet mbeten)". Elements are updated by mark; confirmations stay.
- An element missing from the new list is deleted, unless work was already recorded on it.

## process-plan | Which processes an element needs (process editor) and the work catalog
Who: office, engineers, admin
Words: proceset, katalogu i punëve, detyrat e kantierit, detyrë e re, proces i ri, route, prozess, katalog

- The company has one shared work catalog: "Detyrat e kantierit", "Proceset e fabrikës", "Proceset në kantier".
- On a site, choose only the tasks this site needs ("Zgjidh vetëm detyrat që i duhen këtij kantieri"). "Detyrë e re" / "Proces i ri" adds to the catalog. Archive hides a definition, history stays.
- After importing materials, the process editor sets which processes one element (or a whole list) needs. New imports start unconfigured.
- A task can be completed automatically from confirmed pieces of a linked process ("Nga materialet") or manually.
- Each task can have a photo or an illustration (the AI drawing button makes one image; limited per day).
- The site board shows the tasks in the order they were chosen (numbered 1, 2, 3 …); a task chosen again goes to the end. Each task shows who added it ("Shtuar nga …").

## missing-material | Reporting missing material
Who: everyone on the site
Words: mungon materiali, mungesë, bulona, elektroda, bojë, material fehlt, manca materiale

- Open the site → the phase/task → "Mungon material" → write what is missing (e.g. "bulona M20, 40 copë") or tap a chip (Bulona, Pllaka bazë, Elektroda, Bojë, Profile, Disqe prerjeje) → "Ruaj".
- When it arrives, the office/engineer presses "Materiali erdhi".

## site-documents | Site documents, photos and costs
Who: everyone reads documents and photos; office/admin/authorised engineers upload; costs only office/admin
Words: dokumentet, foto, fatura, kosto, ngarko dokument, shkrep foto, dokumente, fotos, rechnung

- Site → "Dokumentet": tabs "Dokumentet", "Foto", "Kosto & fatura", "Detajet e kantierit".
- "Ngarko dokument", "Shkrep foto" / "Ngarko foto". Invoices and orders ("Ngarko faturë", amount in lek) are seen only by the office.
- Change the address or name: "Detajet e kantierit" → "Ndrysho".
- Deleting a document asks for confirmation and also deletes what was read from it: an Excel element list takes its elements (and their confirmations) with it, an order PDF its production groups. Phase documents ("Fazat") can be deleted too, with their versions and receipts.
- In the element lists the materials are grouped by the document they came from; the trash button on a group deletes that document's elements.

## phase-documents | Documents by phase ("Fazat") and confirming receipt ("E mora")
Who: everyone reads and confirms; admin, office and the site's authorised engineers upload
Words: fazat, faza, fazës, fazave, piketim, rilevim, projektim, porosi, prodhimi, montimi, e mora, dërgo, version, phasen, empfang bestätigen

- Site → "Fazat" (beside "Dokumentet"). Phases: Piketim, Rilevim, Projektim, Porosi, Prodhimi, Montimi.
- Open a document, then press "E mora" to confirm personally that you received it (name + time are saved).
- "Dërgo" shares the file with the phone's share menu (WhatsApp, email…), or copies its link. Nothing is sent automatically.
- Upload a new version: the old one goes to history and the new one starts without receipts.
- The boss can ask the AI who confirmed a document and who has not.

## site-access | Which engineers may upload on a site
Who: admin/owner
Words: aksesi, qasja, inxhinier, të drejta, leje ngarkimi, zugriff, berechtigung, accesso

- Site → access button → select the field/factory engineers for this site → save.
- Without a selection only the office and admins upload. Office staff cannot give rights.

## crew-roles | Setting a person's role (engineer, office, mechanic…)
Who: admin
Words: roli, roli në punë, inxhinier terreni, inxhinier fabrike, mekanik, punonjës zyre, rolle, ruolo

- Open the worker's profile (as admin) → "Roli në punë" → choose: Inxhinier terreni, Inxhinier fabrike, Punonjës zyre, Mekanik, Punëtor terreni, Punëtor fabrike, or "Pa rol".
- Field engineer confirms field steps; factory engineer factory steps; office manages orders/costs; mechanic works workshop jobs; workers view and report.

## workers-admin | Adding or changing workers
Who: admin, office
Words: shto punëtor, punonjës i ri, krijo punonjës, fshi punëtor, kodi i punëtorit, neuer mitarbeiter, nuovo dipendente

- Admin area → "Personel & Flota" → "Krijo punonjës të ri": name, position, language, login code. Then set the role on the profile.
- On a worker's profile the boss can: change data, set a new login code, upload documents, see hours, approve vacation, turn the AI on/off ("Asistenti AI").

## ai-access | Who can use the AI assistant
Who: owner decides
Words: ai, asistenti, akses në ai, hap aksesin, ki, assistent

- In this company only the people the boss enabled (and the owner) use the AI. Others see: "Nuk keni akses në AI. Aksesin jua hap shefi."
- To enable someone: open their profile → card "Asistenti AI" → "Hap aksesin" (close with "Mbyll aksesin"). Another admin's access only the owner can change.

## factory-panel | Factory overview
Who: everyone (view only)
Words: fabrika, punishtja, prodhimi, sa copë, gati për kantier, fabrik, produzione

- Workzone → "Fabrika": totals for all active sites, the six factory steps, then one card per site. It is only for viewing; confirmations are done on each site's factory list.
- On a site page, "Materialet nga fabrika" shows produced / in factory / mounted for that site.

## dashboard | Production dashboard and monitor
Who: admin (monitor: display account)
Words: panel, dashboard, kg, prodhimi ditor, kalendar, monitor, ekran, tv, produktion, cruscotto

- Admin → "Panel": monthly calendar, kg per day (cut parts, cut assemblies and assembled are separate lines, never added together), project filter, progress rings per project. Tap a day to see the evidence (mark, pieces, workers, who confirmed).
- Kg are from the element list weights × confirmed pieces, not from a scale.
- Monitor/TV: open the monitor link from the dashboard; it refreshes every 60 s and shows no personal data. It needs a display account.

## warehouse | Warehouse, tools and clothing
Who: everyone sees own items; office/admin manage
Words: magazina, vegla, veshje, pajisje, dorëzim, kthim, skano, barkod, qr, lager, werkzeug, magazzino

- Own items: profile → "Pajisje & veshje".
- Office/admin: Workzone → "Magazina": tools, clothing and site equipment, one row per physical item.
- Handing out or returning needs two confirmations (office + worker). Transfer between colleagues needs both colleagues.
- Scan: use the camera on the item's barcode/QR; if several units share the factory code, choose the right unit. Unknown code → register it.
- Labels: each unit can get its own short barcode; print from the asset labels page ("Printo").
- Report a defect, loss or item to retire from the item's card; the office accepts or rejects it.

## workshop | Workshop (Oficina): defects and repairs
Who: anyone reports; mechanic and management move the repair
Words: oficina, defekt, prishur, riparim, servis, mekanik, werkstatt, reparatur, officina, guasto

- Report a defect on the vehicle/tool card. A workshop job opens and the item is blocked.
- Steps: Raportuar → Pranuar në oficinë → Në riparim → Gati. Repair can be internal or external (with provider name).
- "Gati" needs a function-test confirmation and a repair note or photo/invoice.
- Admins open the workshop board from the top bar ("Oficina").

## fleet | Vehicles (Flota) and GPS
Who: admin (view), drivers via their vehicle card
Words: flota, makina, automjet, targa, gps, ku është makina, fahrzeug, veicolo

- Top bar "Flota": searchable grid of vehicles; tap one for GPS, map, fuel, photos and info.
- GPS shows the LAST STORED position with its time, not always live.

## fuel | Fuel receipts
Who: drivers upload; office/admin check
Words: karburant, naftë, benzinë, kupon, faturë karburanti, tanken, carburante

- Workzone → fuel ("Karburanti"): choose the vehicle, take a photo of the receipt, fill litres/amount/date, save.
- The office sees all receipts per vehicle in the admin area.

## daily-plan | Daily plan
Who: admin creates; everyone reads
Words: plani ditor, plani për nesër, kush punon ku, tagesplan, piano giornaliero

- Workzone → "Plani ditor +" → choose the date → assign workers and vehicles to sites → save. Workers on vacation/unavailable show a warning.
- Workers see the plan in Workzone and get a notification when tomorrow's plan is ready.

## kidraht | KiDraht (company rules, manuals, tests)
Who: everyone
Words: kidraht, rregullat, manual, kurs, test, siguria, regeln, sicurezza

- Top bar "KiDraht": company rules, manuals and short tests in your language. It opens in a new full-screen window.

## offline | No internet on site
Who: everyone
Words: pa internet, offline, nuk ka lidhje, sinjal, kein netz

- A banner "Nuk ka lidhje interneti" shows. Some actions wait in "Veprime në pritje" and are sent when the connection returns. Do not close the app before they are sent.

## not-available | Things the platform does NOT have (yet)
Who: everyone
Words: nuk ka, mungon, a mundet, a ka, funksion, feature, gibt es, c'è

The assistant must say clearly that these do not exist yet and offer to send a request to the platform team:
- Automatic email or WhatsApp to clients or suppliers (only manual sharing with "Dërgo").
- Payroll, salaries, taxes or contracts.
- Invoices/offers to customers (only cost and supplier invoices per site for the office).
- Warehouse stock per shelf/bin location; live GPS of tools.
- Reading the content of PDFs/photos by the AI.
- Delivery forecasts or deadlines that are not stored.
- The AI cannot change data: it only reads and explains. Changes are made in the app by the people with the right role.
