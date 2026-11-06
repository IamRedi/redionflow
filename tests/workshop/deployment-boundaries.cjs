const {spawn}=require('node:child_process');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
async function verify(flags,label){
  const env={...process.env,DATABASE_URL:'postgresql://baumdemo@127.0.0.1:55435/baumdemo_test',DIRECT_URL:'postgresql://baumdemo@127.0.0.1:55435/baumdemo_test',APP_ENV:'demo',DEMO_MODE:'true',SAAS_MODE:'false',DEMO_PROFILE:'',OPENAI_API_KEY:'',WANWAY_GPS_ENABLED:'false',APP_BASE_URL:'http://127.0.0.1:8766',...flags};
  const child=spawn(process.execPath,[path.join(repo,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','8766'],{cwd:repo,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Boundary server not ready')),30000);child.stdout.on('data',b=>{if(String(b).includes('Ready')){clearTimeout(timer);resolve()}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Boundary server exited'))})});
    const response=await fetch('http://127.0.0.1:8766/demo/workshop');
    if(response.status!==404)throw new Error(`${label}: expected workshop 404, got ${response.status}`);
    for(const endpoint of ['/demo/wood','/api/demo/baumdienst/wood','/api/demo/baumdienst/wood/art/wood-yard','/api/demo/baumdienst/wood/files/00000000-0000-4000-8000-000000000000','/demo/plan','/api/demo/baumdienst/plans?date=2026-11-06','/api/demo/baumdienst/art/tree-oak','/api/demo/baumdienst/workshop','/api/demo/baumdienst/files/not-owned','/api/demo/baumdienst/images/00000000-0000-4000-8000-000000000000','/demo/privacy','/demo/inventory/print?asset=crane']){
      const reply=await fetch('http://127.0.0.1:8766'+endpoint);
      if(reply.status!==404)throw new Error(`${label}: ${endpoint} leaked (${reply.status})`);
    }
    for(const endpoint of ['/api/demo/baumdienst/wood','/api/demo/baumdienst/wood/files','/api/demo/baumdienst/wood/images','/api/demo/baumdienst/plans','/api/demo/baumdienst/workshop','/api/demo/baumdienst/files','/api/demo/baumdienst/actor','/api/demo/baumdienst/images']){
      const reply=await fetch('http://127.0.0.1:8766'+endpoint,{method:'POST',headers:{Origin:'http://127.0.0.1:8766','Content-Type':'application/json'},body:'{}'});
      if(reply.status!==404)throw new Error(`${label}: write endpoint ${endpoint} leaked (${reply.status})`);
    }
    const html=await(await fetch('http://127.0.0.1:8766/')).text();
    if(html.includes('id="werkstatt-demo"'))throw new Error(`${label}: native workshop CTA leaked`);
    if(flags.APP_ENV!=='saas'){
      const workzone=await(await fetch('http://127.0.0.1:8766/demo/workzone')).text();
      if(workzone.includes('data-testid="baum-demo-topbar"')||workzone.includes('workshop-overview-title'))throw new Error(`${label}: workshop template leaked into another profile`);
    }
    console.log(`PASS: ${label}: workshop 404, presentation/Workzone template excluded.`);
  }finally{child.kill();await new Promise(resolve=>child.once('close',resolve));}
}
(async()=>{await verify({},'Baumdienst without opt-in');await verify({DEMO_PROFILE:'another-company'},'another company profile');await verify({APP_ENV:'saas',SAAS_MODE:'true',DEMO_PROFILE:'baumdienst-workshop'},'SaaS even with workshop flag')})().catch(error=>{console.error(error);process.exit(1)});
