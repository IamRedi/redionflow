# BauFlow dhe BaumdienstFlow - kontrollet e plota dhe përgatitja e publikimit

14 nëntor 2026 · Pa publikim · Pa API me pagesë

## Rezultati

PR200 për website-in statik mbetet kandidat i testuar, i pavarur nga aplikacionet. Paketa e saktë për Cloudflare Pages `baumdienstflow` është `BauFlow_BaumdienstFlow_Ndarja_Identitetit_Kandidat_20261114.zip`, SHA256 `dfa4c04a60fb1da92adf7822edf43fe53a5d828f931b2a3a7325d6ca6ed03cc6`. Dhjetë HTML ndryshojnë; 109 hyrjet e tjera ruhen. Provat e mëparshme të generatorit, pamjeve desktop/mobile dhe katër crawleve GeoFindbar mbeten historike dhe të pandryshuara; nuk janë rezultat pas një publikimi të ri.

Patch-et e aplikacioneve u aplikuan tani në kopje të plota të dy source-ve reale dhe u testuan në mini-PC. BauFlow kaloi portat e aplikacionit. BaumdienstFlow kaloi lint/typecheck/build, por testet e plota zbuluan dështime edhe në source-in origjinal. Për këtë arsye publikimi i aplikacionit BaumdienstFlow mbetet HOLD. Nuk u dobësua ose hoq asnjë assertion.

## Source dhe fushëveprimi

| Objekt | Baza reale | Kandidati i ruajtur | Shqyrtimi |
|---|---|---|---|
| BauFlow app | 9d2ead529ed36705753456321ebe2db2cb0321d2 | 13406a221b7461a64880bb2e6e842f257a55d1a3 | [PR201, DRAFT](https://github.com/IamRedi/redionflow/pull/201) |
| BaumdienstFlow app | 71213a3e394ddf8e21b4e9279e7b258b527b1f5d | 55996a468c8c894fdd8cf457a62e43a9bf5d1b0a | [PR202, DRAFT/HOLD](https://github.com/IamRedi/redionflow/pull/202) |
| Website statik | PR198 ec885ec, paketë e miratuar 8a0af398... | PR200, paketa dfa4c04a... | [PR200, OPEN](https://github.com/IamRedi/redionflow/pull/200) |

Ndryshimi i aplikacionit prek vetëm header-in e indeksimit për dy hostet e emërtuara të demos, metadata-n e layout/root, dy helper-a, 11 teste të kufirit të hosteve dhe lidhjen e politikës lokale të verifikimit. Pa ndryshim CSS/UI, autentikimi, role, schema/migrime, rekorde, çelësa ose provider. Hostet marketing, .info dhe private/custom përjashtohen. `noindex` nuk është mbrojtje aksesi.

## Verifikimi lokal

| Porta | BauFlow | BaumdienstFlow |
|---|---|---|
| Instalimi nga lockfile / Prisma generate | PASS | PASS |
| Lint / TypeScript | PASS / PASS | PASS / PASS |
| Testet njësi | 437 PASS | 714 PASS, 1 FAIL |
| Integrimi, PostgreSQL i përkohshëm | 263 PASS | 310 PASS, 15 FAIL, 5 SKIP |
| Build Next 16.4.3 | PASS | PASS |
| Browser E2E, suite e plotë | 25 PASS | 31 PASS, 1 FAIL, 2 SKIP |
| HTTP nga Next i ndërtuar, kufijtë e hostit | 20/20 PASS | 20/20 PASS |

Testet HTTP përdorën një server real lokal Next me env SaaS dhe pa provider. Për root u provuan titujt e saktë për të dy hostet e demos; header-i `noindex, follow` u provua në pesë rrugë/katër hoste. Header-at ekzistues `nosniff`, `DENY` dhe CSP Report-Only u ruajtën. Rrugët e demos japin 404 në SaaS sipas kontratës ekzistuese. Ky kontroll nuk është UAT vizual i një demoje me seed në Production.

Gjatë provës së parë BauFlow, tetë worker-a browser-i tejkaluan kufijtë e proceseve (EAGAIN/crash). Provat ruhen. E gjithë suite u përsërit me një worker dhe kaloi 25/25. Asnjë test ose assertion nuk u hoq. Runner-i mbeti i kufizuar në 4 CPU/4 GiB; PostgreSQL kishte kufij të veçantë 1 CPU/768 MiB/128 PIDs, loopback dhe tmpfs. Çdo container i krijuar u mbyll nga orkestruesi që e krijoi.

## Dështimet e BaumdienstFlow dhe kontrolli i bazës

- Testi i OCR-së pret kohën nga një faturë sintetike; mini-PC nuk ka `tesseract` në PATH-in e provës. I njëjti test dështoi edhe pa patch-in GEO.
- Katërmbëdhjetë teste të workshop kërkojnë specifikisht `127.0.0.1:55435/baumdemo_test` me një kompani të caktuar demo. Runner-i i zakonshëm i integrimit krijon një DB të re `baumkalk_integration` në port të rastësishëm; guard-i e refuzon saktësisht këtë mospërputhje. Nuk u çaktivizua guard-i.
- Një test i backup/restore dështoi; mungojnë mjetet lokale `pg_dump`/`pg_restore`. Asnjë test backup-i nuk u drejtua te baza reale.
- Një test E2E i Workzone dështoi në një selector për element që mungon, përpara krahasimeve të layout-it. I njëjti test dështoi në source-in origjinal pa patch-in GEO.
- Pesë teste integrimi të zyrave dhe dy E2E të varura nga kushtet e tyre mbetën SKIP; nuk quhen PASS.

U krijua kopje e source-it origjinal 71213a3 me instalim/Prisma të pavarur. Suite e plotë origjinale e njësive dhe integrimit riprodhoi të njëjtat dështime: OCR 1 FAIL dhe integrimi 15 FAIL/5 SKIP. Rasti origjinal E2E Workzone riprodhoi mungesën e selector-it. Një përpjekje fillestare me dependency symlink nuk ishte provë e vlefshme për integrim/build; u ruajt si diagnostikim dhe u zëvendësua vetëm si përfundim nga prova me instalim të pavarur. Kjo e ndan regresionin GEO nga problemet e bazës, por nuk i kthen portat e kuqe në miratim release.

Instalimi i BauFlow raportoi 14 advisories low/moderate. Nuk u bë `audit fix`, upgrade ose ndryshim lockfile. Skanimi i plotë historik me gitleaks dhe smoke i stack-ut Docker Compose nuk u kryen në këtë cikël; statusi i tyre mbetet NOT_RUN. Gatishmëria e publikimit të app-it nuk deklarohet vetëm nga portat e tabelës.

## Plani i publikimit dhe rikthimit

Kontrolli i drejtpërdrejtë live në Chrome hapi Workzone, dashboard-in BauFlow dhe detajet e një kantieri për secilën demo. Pamjet desktop dhe Workzone 390×844 u ruajtën; të dyja Workzone nuk kishin overflow horizontal të dokumentit në kampionin mobile. Titulli live i BauFlow mbetet gabimisht “Baumdienst Flow”, pra patch-i ende nuk është publikuar. Pamjet e detajeve dallohen nga matja reale e viewport-it: screenshot-i i parë Bau i emërtuar “390” është në fakt 1280 dhe ruhet si diagnostikim; prova e vlefshme mobile është workzone-mobile-checks.json dhe screenshot-i përkatës. Nuk u aktivizua AI ose ndonjë veprim ndryshimi. Footer-i i vjetër BauFlow mbetet vëzhgim UI jashtë këtij patch-i të metadata-s; nuk pretendohet pranim i plotë vizual, telefon fizik ose tekst-zoom. Numrat e demos së përbashkët mund të ndryshojnë nga përdorues të tjerë; kjo nuk përdoret si provë invariance të bazës.

1. Website-i statik: miratim i veçantë për ZIP-in dfa4c04a... në projektin ekzistues Cloudflare Pages `baumdienstflow`; pa merge main/pilot. Para upload-it krahasohet deployment-i aktual me bazën e ruajtur dhe ruhet identifikuesi i tij. Paketa e mëparshme 8a0af398... dhe deployment cb482761-5e99-4253-84e9-57a1bc88b69a janë pika e rikthimit nga prova e fundit; nëse gjendja ka ndryshuar, duhet freskuar, jo mbishkruar.
2. Pas publikimit statik: readback i dhjetë HTML-ve, canonical/schema/FAQ dhe linkeve; kontroll desktop/narrow dhe audit GeoFindbar me të njëjtat pyetje. Nuk premtohet rifreskim i menjëhershëm në Google.
3. Aplikacionet: PR201 dhe PR202 janë DRAFT. Nuk lejohet merge automatik në main ose retarget i release-it të fiksuar. Përpara çdo release duhen mbyllur portat e munguar/dështuara, seed-demo UAT dhe backup/provider preflight i freskët sipas kontratës së app-it. Main lidhet me shërbime të tjera; publikimi duhet kufizuar te demoja e emërtuar.
4. `.info`: mbetet propozim i bllokuar nga verifikimi i pronësisë/aksesit DNS, TLS dhe rrugëve të vjetra. Asnjë wildcard redirect ose ndryshim DNS nuk është kryer.

Provider-i u rilexua: të njëjtat deployment IDs për të dy demot, pa pending work dhe pa dështime të reja. Sleeping është gjendje e pritshme, jo provë rrëzimi. Nuk u krye deploy/merge/DNS/DB/API/billing write. Source-t dhe bundle-t kandidat ruhen me SHA256. Të 1534 skedarët e provave ekzistuese mbetën byte-identical. Baza reale nuk u lidh ose ndryshua nga testet; kjo nuk pretendohet si backup i ri ose verifikim i plotë i rreshtave live.

## Prezantimi dhe vazhdimi

Prezantimi publik/portfolio/About mbeten NO_CONTENT_CHANGE për këtë fazë: nuk u publikua sjellje e re dhe nuk ngrihet readiness. PR-të shoqëruese marrin vetëm një receipt teknik. A separate public-source client audit is kept private and is not published as a contracted-client endorsement.

Hapi aktiv: publikimi statik i PR200 mund të miratohet veçmas pasi të rilexohet target-i. App BaumdienstFlow mbetet HOLD derisa të zgjidhet baza e testimit dhe rasti Workzone. API me pagesë mbetet e çaktivizuar.
