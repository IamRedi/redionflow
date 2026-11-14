import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {baum,links,locales} from './content.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),site=path.join(root,'websites/products');
const baseline=execFileSync('git',['show','ce2d341d55742c3364df38f4d02521e55b142d3c:websites/generator/content.mjs'],{cwd:root,encoding:'utf8'});
const before=await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'));
assert.deepEqual(baum.buyerInfo,before.baum.buyerInfo,'Approved cost/setup content changed');assert.deepEqual(baum.start,before.baum.start,'Approved setup steps changed');for(const key of Object.keys(links))for(const lang of locales)assert.equal(typeof links[key]==='function'?links[key](lang):links[key],typeof before.links[key]==='function'?before.links[key](lang):before.links[key],'Production access changed');
let refs=0;
for(const [rel,lang]of [['index.html','de'],...locales.map(l=>['about/'+l+'.html',l])]){
 const file=path.join(site,rel),html=await readFile(file,'utf8');assert.ok(html.includes(`<html lang="${lang}">`));assert.equal((html.match(/<h1[ >]/g)||[]).length,1);assert.ok(html.includes('name="description"'));assert.ok(html.includes('rel="canonical"'));assert.equal((html.match(/aria-label="by RediON"/g)||[]).length,1);
 for(const text of [baum.buyerInfo.lead[lang],...baum.buyerInfo.questions.flatMap(([q,a])=>[q[lang],a[lang]])])assert.ok(html.includes(text.replaceAll('&','&amp;').replaceAll("'",'&#39;').replaceAll('"','&quot;')),'Missing approved buyer copy');
 for(const target of [links.admin,links.worker,links.baumDemo,links.kidraht,'/impressum.html','/datenschutz.html'])assert.ok(html.includes(target),'Missing access/legal target');
 for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(/^(https?:|data:)/.test(ref))continue;if(ref.startsWith('#')){assert.ok(html.includes(`id="${ref.slice(1)}"`),'Broken anchor '+ref);continue;}
  await stat(ref.startsWith('/')?path.join(site,ref):path.resolve(path.dirname(file),ref.split('?')[0]));refs++;
 }
 for(const [,sets]of html.matchAll(/srcset="([^"]+)"/g))for(const part of sets.split(',')){await stat(path.resolve(path.dirname(file),part.trim().split(' ')[0]));refs++;}
}
const changed=execFileSync('git',['diff','--name-only','ce2d341d55742c3364df38f4d02521e55b142d3c','--','websites/products/bauflow'],{cwd:root,encoding:'utf8'}).trim();assert.equal(changed,'','BauFlow output changed');
console.log(JSON.stringify({pages:5,localTargets:refs,locales:4,buyerCopyPreserved:true,productionLinksPreserved:true,bauflowUnchanged:true}));
