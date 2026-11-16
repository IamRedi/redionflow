import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../..',import.meta.url)),site=path.join(root,'websites/products');
const base='7a6f777a6cd358eb17c86df1e716bf42527eea35';
const pages=['index.html',...['sq','en','de','it'].map(l=>`about/${l}.html`),'bauflow/index.html',...['sq','en','de','it'].map(l=>`bauflow/about/${l}.html`)];
const expected=[
 ['bauflow','https://bauflow-production-1344.up.railway.app/muster','bauflow-muster.webp'],
 ['crane','https://rheinruhr-kran-muster-production.up.railway.app/muster','crane-muster.svg'],
 ['baumdienst','https://redionflow-production.up.railway.app/demo','baumdienst-muster.webp'],
];
const strip=html=>html.replace(/<nav id="demos" class="demo-entry-group[^"]*"[\s\S]*?<\/nav>/,'').replace(/<link rel="stylesheet" href="\/demo-assets\/demo-entries.css\?v=[a-f0-9]+">/,'').replaceAll('href="#demos"','href="https://redionflow-production.up.railway.app/demo"');
let targets=0;
for(const file of pages){
 const html=await readFile(path.join(site,file),'utf8'),before=execFileSync('git',['show',`${base}:websites/products/${file}`],{cwd:root,encoding:'utf8'});
 assert.equal(strip(html).replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'),`Content outside the three-entry block changed: ${file}`);
 assert.equal((html.match(/id="demos"/g)||[]).length,1);
 assert.equal((html.match(/data-demo-entry=/g)||[]).length,3);
 for(const [id,href,logo]of expected){assert.ok(html.includes(`data-demo-entry="${id}" href="${href}"`),`${file}: wrong entry ${id}`);assert.ok(html.includes(`src="/demo-assets/${logo}"`));}
 assert.equal((html.match(/aria-label="by RediON"/g)||[]).length,1);
 for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(/^(https?:|data:)/.test(ref))continue;
  if(ref.startsWith('#')){assert.ok(html.includes(`id="${ref.slice(1)}"`),'Missing anchor '+ref);continue;}
  const address=new URL(ref,'http://preview/'+file),target=path.join(site,decodeURIComponent(address.pathname));
  try{await stat(target);}catch(error){if(path.extname(target))throw error;await stat(target+'.html');}targets++;
 }
}
// Every original asset stays byte-identical. Only the ten pages and these four
// shared static files enter a future approved overlay, never the whole archive.
const tracked=execFileSync('git',['ls-tree','-r','--name-only',base,'websites/products'],{cwd:root,encoding:'utf8'}).trim().split('\n');
let retained=0;
for(const file of tracked){
 if(file.endsWith('.md')||pages.includes(file.slice('websites/products/'.length)))continue;
 const before=execFileSync('git',['show',`${base}:${file}`],{cwd:root,maxBuffer:16*1024*1024}),after=await readFile(path.join(root,file));
 const text=/\.(css|js|mjs|json|svg|html|xml|txt)$/.test(file)||path.basename(file).startsWith('_');assert.deepEqual(text?after.toString().replaceAll('\r\n','\n'):after,text?before.toString().replaceAll('\r\n','\n'):before,`Existing asset changed: ${file}`);retained++;
}
assert.deepEqual((await readdir(path.join(site,'demo-assets'))).sort(),['bauflow-muster.webp','baumdienst-muster.webp','crane-muster.svg','demo-entries.css']);
console.log(JSON.stringify({demoEntryPages:10,entriesPerPage:3,localTargets:targets,retainedAssets:retained,existingHtmlOutsideEntriesUnchanged:true}));
