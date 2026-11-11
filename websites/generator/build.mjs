// Builds the two separate product websites into websites/products:
//   BaumdienstFlow  → /about/{lang}.html  + /index.html (German)
//   BauFlow         → /bauflow/about/{lang}.html + /bauflow/index.html (German)
// Static only: no scripts, no inline styles, local font and images (strict CSP).
//   node websites/generator/build.mjs
import { mkdir, writeFile, copyFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { baum, bau, common, links, locales } from './content.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const root = resolve(here('../products'));
const styleVersion = createHash('sha256').update((await readFile(here('./site.css'), 'utf8')).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
const referenceVersion = createHash('sha256').update((await readFile(here('./reference.css'), 'utf8')).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ext = 'rel="noopener"';

const sprite = '<svg class="sr" aria-hidden="true"><symbol id="i-ar" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol><symbol id="i-ok" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol></svg>';
const arrow = '<svg class="ar" aria-hidden="true"><use href="#i-ar"/></svg>';
const check = '<svg aria-hidden="true"><use href="#i-ok"/></svg>';
const twin = '<svg class="twin" viewBox="0 0 320 170" fill="none" aria-hidden="true"><g stroke="#d97757" stroke-width="1.4" stroke-linecap="round"><path d="M160 160V96"/><path d="M160 118c-12-8-22-10-34-8M160 108c10-9 22-12 36-10M160 128c-8-4-16-4-24-2"/></g><g fill="#7fb77e" opacity=".9"><circle cx="160" cy="62" r="34"/><circle cx="128" cy="78" r="24"/><circle cx="194" cy="76" r="26"/></g><g stroke="#faf9f5" stroke-opacity=".35" stroke-dasharray="3 5"><circle cx="160" cy="70" r="58"/><path d="M60 160h200"/></g><g stroke="#d97757" stroke-width="1.2"><path d="M232 36l26-14M246 50l30-6M238 66l28 4" stroke-dasharray="2 4"/></g><g fill="#c2c0b6" font-family="ui-monospace,monospace" font-size="9"><text x="262" y="24">h 18 m</text><text x="280" y="46">Ø 65 cm</text><text x="270" y="74">DWD</text></g></svg>';
const signature = '<div class="redion-author-footer"><a class="redion-signature" href="https://www.redioncekrezi.de/" translate="no" data-theme="dark" aria-label="by RediON"><span class="redion-by" aria-hidden="true">by</span><span class="redion-word" aria-hidden="true"><span class="redion-r">R</span><span class="redion-e">e</span><span class="redion-d">d</span><span class="redion-i">i</span><span class="redion-on">ON</span></span></a></div>';

function render(p, lang, isIndex) {
  const t = (o) => esc(o[lang]);
  const A = isIndex ? 'about/assets/' : 'assets/';
  const L = isIndex ? 'about/' : './';
  const img = (name, alt, cls = '', eager = false) => {
    const phone = name.includes('-phone-');
    const [w, h] = phone ? [560, 940] : [1600, 1000];
    return `<img${cls ? ` class="${cls}"` : ''} src="${A}${name}.webp" width="${w}" height="${h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
  };
  const head = (eyebrow, title, text, id) => `<div class="head"><p class="eyebrow"><span class="dot"></span>${t(eyebrow)}</p><h2 id="${id}">${t(title)}</h2>${text ? `<p class="lead">${t(text)}</p>` : ''}</div>`;
  const self = `${p.origin}/about/${lang}.html`;
  const url = isIndex ? `${p.origin}/` : self;
  const legalBase = p.key === 'bau' ? '/bauflow/' : '/';
  const c = common;
  const demoAction = p.key === 'baum'
    ? `<a class="btn ghost" href="${links.baumDemo}" ${ext}>${t(c.demo)}${arrow}</a>`
    : `<a class="btn ghost" href="${links.contact(lang)}">${t(c.request)}${arrow}</a>`;
  const brand = p.key === 'baum'
    ? `<img src="${A}logo.webp" width="36" height="36" alt=""><span>Baumdienst<b>Flow</b></span>`
    : `<img src="${A}mark.svg" width="36" height="36" alt=""><span>Bau<b>Flow</b></span>`;

  const chain = p.chain ? `<section class="chain" id="ablauf" aria-labelledby="chain-title">${head(p.chain.eyebrow, p.chain.title, p.chain.text, 'chain-title')}<div class="lanes">${p.chain.groups.map(([label, steps]) => `<div class="lane"><p class="lane-label">${t(label)}</p><ol>${steps.map(([k, name]) => `<li class="reveal"><img src="${A}art/${k}.svg" width="160" height="120" alt="" loading="lazy"><span>${t(name)}</span></li>`).join('')}</ol></div>`).join('')}</div></section>` : '';

  const tools = p.tools.map((k) => k === 'kidraht'
    ? `<article class="tool kd reveal"><div class="tool-head"><h3>KiDraht</h3><span class="badge">${t(c.tools.kidraht.badge)}</span></div><p>${t(c.tools.kidraht.text)}</p><a class="btn ghost" href="${links.kidraht}" ${ext}>${t(c.tools.kidraht.cta)}${arrow}</a><div class="tool-media"><div class="frame">${img('k-desk-cat', c.tools.kidraht.alt[lang])}</div><div class="handset mini">${img('p-phone-book', c.tools.kidraht.phoneAlt[lang])}</div></div></article>`
    : `<article class="tool at reveal"><div class="tool-head"><h3>ArborTwin</h3><span class="badge">${t(c.tools.arbor.badge)}</span></div><p>${t(c.tools.arbor.text)}</p><ol class="flow">${c.tools.arbor.steps.map((x) => `<li>${t(x)}</li>`).join('')}</ol>${twin}<p class="fine">${t(c.tools.arbor.note)}</p></article>`).join('');

  const s = p.showcase;
  const reference = p.reference ? `<section class="card reference" id="alsteel" aria-labelledby="reference-title"><img class="reference-photo" src="${A}alsteel-hero-1600.webp" srcset="${A}alsteel-hero-960.webp 960w, ${A}alsteel-hero-1600.webp 1600w" sizes="(max-width: 700px) 100vw, 1200px" width="1600" height="1200" alt="${t(p.reference.photoAlt)}" loading="lazy"><div class="reference-shade" aria-hidden="true"></div><div class="reference-content"><div class="reference-identity"><p class="eyebrow"><span class="dot" aria-hidden="true"></span>${t(p.reference.label)}</p><img class="reference-logo" src="${A}alsteel-logo.png" width="1800" height="515" alt="AL Steel Metal Construction" loading="lazy"><h2 id="reference-title" translate="no">${esc(p.reference.name)}</h2><p class="reference-location">${t(p.reference.location)}</p></div><div class="reference-copy"><p>${t(p.reference.description)}</p><p>${t(p.reference.usage)}</p></div><a class="btn ghost" href="${esc(p.reference.href)}">${t(p.reference.cta)}${arrow}</a></div></section>` : '';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="${p.themeColor}"><meta name="robots" content="index,follow"><title>${t(p.title)}</title><meta name="description" content="${t(p.description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:title" content="${t(p.title)}"><meta property="og:description" content="${t(p.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${p.origin}/about/assets/${p.ogImage}.webp"><meta name="twitter:card" content="summary_large_image">${locales.map((x) => `<link rel="alternate" hreflang="${x}" href="${p.origin}/about/${x}.html">`).join('')}<link rel="alternate" hreflang="x-default" href="${p.origin}/"><link rel="icon" href="${A}${p.key === 'baum' ? 'logo.webp' : 'mark.svg'}"><link rel="preload" href="${A}manrope-variable.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="${A}site.css?v=${styleVersion}">${p.reference ? `<link rel="stylesheet" href="${A}reference.css?v=${referenceVersion}">` : ''}</head>
<body class="t-${p.key}">${sprite}<a class="skip" href="#main">${t(c.skip)}</a><div class="bg" aria-hidden="true"><div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div></div>
<header class="top" id="top"><a href="${p.home}" class="brand">${brand}</a><nav class="nav" aria-label="${p.name}"><a href="#ablaeufe">${t(c.nav.processes)}</a><a href="#dashboard">${t(c.nav.dashboard)}</a><a href="#tools">${t(c.nav.tools)}</a><a href="#zugang">${t(c.nav.access)}</a></nav><nav class="langs" aria-label="Language">${locales.map((x) => `<a href="${L}${x}.html" lang="${x}" hreflang="${x}"${x === lang && !isIndex ? ' aria-current="page"' : ''}>${x.toUpperCase()}</a>`).join('')}</nav><a class="btn white sm" href="#zugang">${t(c.nav.login)}</a></header>
<main id="main">
<section class="hero" aria-labelledby="hero-title"><div class="customer"><span>${t(c.customer.label)}</span><a href="${links.admin}">${t(c.customer.admin)}${arrow}</a><a href="${links.worker}">${t(c.customer.worker)}${arrow}</a></div>
<p class="eyebrow"><span class="dot"></span>${t(p.hero.eyebrow)}</p><h1 id="hero-title">${t(p.hero.h1a)}<br><span class="grad">${t(p.hero.h1b)}</span></h1><p class="lead">${t(p.hero.lead)}</p>
<div class="actions"><a class="btn white" href="#ablaeufe">${t(c.nav.processes)}${arrow}</a>${demoAction}</div>
<figure class="stage"><div class="frame hero-frame"><div class="bar" aria-hidden="true"><i></i><i></i><i></i><span>${p.hero.bar}</span></div>${img(p.key === 'baum' ? 'b-desk-wz' : 's-desk-wz', p.hero.alt[lang], '', true)}</div><figcaption class="sr">${t(p.hero.alt)}</figcaption></figure>
<ul class="facts">${c.facts.map((f) => `<li>${t(f)}</li>`).join('')}</ul></section>
${reference ? reference + '\n' : ''}${chain}
<section class="platform" id="ablaeufe" aria-labelledby="proc-title">${head(p.processes.eyebrow, p.processes.title, p.processes.text, 'proc-title')}
<div class="procs">${p.processes.cards.map((x) => `<article class="proc reveal"><div class="handset">${img(x.shot, x.title[lang])}</div><div><h3>${t(x.title)}</h3><p>${t(x.body)}</p></div></article>`).join('')}</div></section>
<section class="product" aria-labelledby="show-title"><div class="product-head"><div><p class="eyebrow"><span class="dot"></span>${t(s.eyebrow)}</p><h2 id="show-title">${t(s.title)}</h2></div><div><p class="lead">${t(s.text)}</p><ul class="points">${s.points.map((x) => `<li>${check}${t(x)}</li>`).join('')}</ul></div></div>
<div class="rail" role="list">${s.shots.map(([name, cap]) => `<figure role="listitem" class="shot">${img(name, cap[lang])}<figcaption>${t(cap)}</figcaption></figure>`).join('')}</div>
<p class="note">${t(s.note)}</p></section>
<section class="dash" id="dashboard" aria-labelledby="dash-title"><div class="dash-copy"><p class="eyebrow"><span class="dot"></span>Dashboard view</p><h2 id="dash-title">${t(p.dashboard.title)}</h2><p class="lead">${t(p.dashboard.text)}</p><ul class="points">${p.dashboard.points.map((x) => `<li>${check}${t(x)}</li>`).join('')}</ul></div>
<div class="dash-media"><figure class="frame main reveal"><div class="bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(p.dashboard.main[1][lang])}</span></div>${img(p.dashboard.main[0], p.dashboard.main[1][lang])}</figure><div class="handset float">${img(p.dashboard.phone, p.dashboard.main[1][lang])}</div></div></section>
<section class="roles" aria-labelledby="roles-title">${head(c.roles.eyebrow, c.roles.title, null, 'roles-title')}<div class="cards three">${p.roles.map(([h, x]) => `<article class="card reveal"><h3>${t(h)}</h3><p>${t(x)}</p></article>`).join('')}</div></section>
<section class="start" aria-labelledby="start-title">${head(c.start.eyebrow, c.start.title, null, 'start-title')}<ol class="steps">${c.start.steps.map(([h, x], i) => `<li class="reveal"><span class="step">${i + 1}</span><div><h3>${t(h)}</h3><p>${t(x)}</p></div></li>`).join('')}</ol><a class="btn white" href="${links.contact(lang)}">${t(c.start.contact)}${arrow}</a></section>
<section class="access" id="zugang" aria-labelledby="access-title">${head(c.access.eyebrow, c.access.title, c.access.text, 'access-title')}<div class="door"><a href="${links.admin}">${t(c.customer.admin)}${arrow}</a><a href="${links.worker}">${t(c.customer.worker)}${arrow}</a>${p.key === 'baum' ? `<a href="${links.baumDemo}" ${ext}>${t(c.demo)}${arrow}</a>` : `<a href="${links.contact(lang)}">${t(c.request)}${arrow}</a>`}</div></section>
<section class="tools" id="tools" aria-labelledby="tools-title">${head(c.tools.eyebrow, c.tools.title, p.toolsText, 'tools-title')}<div class="toolgrid${p.tools.length === 1 ? ' one' : ''}">${tools}</div><p class="more"><span class="dot"></span>${t(c.tools.more)}</p></section>
</main>
<footer><div class="foot-row"><a class="brand small" href="#top">${brand}</a><a class="sister sister-${p.key === 'baum' ? 'bau' : 'baum'}" href="${p.sister.href(lang)}"><span>${t(p.sister.label).split(':')[0]}</span><span class="brand small"><img src="${p.key === 'baum' ? '/bauflow/about/assets/mark.svg' : '/about/assets/logo.webp'}" width="30" height="30" alt=""><span>${p.key === 'baum' ? 'Bau<b>Flow</b>' : 'Baumdienst<b>Flow</b>'}</span></span>${arrow}</a><a href="${links.portfolio(lang)}">${t(c.footer.portfolio)}${arrow}</a><a href="#top">${t(c.footer.top)} ↑</a></div><p class="updated">${t(c.footer.updated)}</p><nav class="legal" aria-label="${t(c.footer.imprint)}"><a href="${legalBase}impressum.html">${t(c.footer.imprint)}</a><a href="${legalBase}datenschutz.html">${t(c.footer.privacy)}</a></nav>${signature}</footer>
</body></html>
`;
}

for (const p of [baum, bau]) {
  const dir = resolve(root, p.aboutDir);
  const assets = resolve(dir, 'assets');
  await rm(assets, { recursive: true, force: true });
  await mkdir(resolve(assets, 'art'), { recursive: true });
  const shots = here(`./shots/${p.key}`);
  for (const f of await readdir(shots, { withFileTypes: true })) if (f.isFile()) await copyFile(resolve(shots, f.name), resolve(assets, f.name));
  if (p.key === 'bau') for (const f of await readdir(resolve(shots, 'art'))) await copyFile(resolve(shots, 'art', f), resolve(assets, 'art', f));
  else await rm(resolve(assets, 'art'), { recursive: true });
  await copyFile(here('./site.css'), resolve(assets, 'site.css'));
  if (p.reference) await copyFile(here('./reference.css'), resolve(assets, 'reference.css'));
  await copyFile(resolve(root, 'assets/manrope-variable.ttf'), resolve(assets, 'manrope-variable.ttf'));
  await copyFile(resolve(root, 'fonts/Manrope-OFL.txt'), resolve(assets, 'Manrope-OFL.txt'));
  if (p.key === 'baum') await copyFile(resolve(root, 'assets/logo-256.webp'), resolve(assets, 'logo.webp'));
  else await copyFile(resolve(root, 'bauflow/assets/bauflow-mark.svg'), resolve(assets, 'mark.svg'));
  for (const lang of locales) await writeFile(resolve(dir, `${lang}.html`), render(p, lang, false));
  await writeFile(resolve(root, p.home.slice(1), 'index.html'), render(p, 'de', true));
  const size = Math.max(...(await Promise.all(locales.map(async (l) => (await readFile(resolve(dir, `${l}.html`))).length))));
  console.log(`${p.name}: ${locales.length} locales + index, largest page ${size} bytes.`);
}
