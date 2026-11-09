import { afterEach, expect, it, vi } from 'vitest';
import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { encodeBrowserSubscription, decodeBrowserSubscription, validBrowserSubscription, webPushConfig } from './web-push';
afterEach(()=>vi.unstubAllEnvs());
const key=createECDH('prime256v1');key.generateKeys();
const sub={endpoint:'https://web.push.apple.com/synthetic-device',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,5).toString('base64url')}};
it('accepts standard Apple/Chrome/Firefox services and rejects arbitrary server egress or malformed keys',()=>{
 expect(validBrowserSubscription(sub)).toBe(true);
 for(const endpoint of ['https://fcm.googleapis.com/synthetic','https://updates.push.services.mozilla.com/synthetic','https://x.notify.windows.com/synthetic']) expect(validBrowserSubscription({...sub,endpoint})).toBe(true);
 for(const endpoint of ['http://web.push.apple.com/device','https://127.0.0.1/private','https://web.push.apple.com.evil.test/device','https://user:pass@web.push.apple.com/device','https://web.push.apple.com:8443/device']) expect(validBrowserSubscription({...sub,endpoint})).toBe(false);
 expect(validBrowserSubscription({...sub,keys:{...sub.keys,auth:'short'}})).toBe(false);
 expect(decodeBrowserSubscription(encodeBrowserSubscription(sub))).toEqual(sub);
 expect(encodeBrowserSubscription({...sub,keys:{auth:sub.keys.auth,p256dh:sub.keys.p256dh}})).toBe(encodeBrowserSubscription(sub));
});
it('exposes a configuration only for a matching persistent VAPID key pair',()=>{
 vi.stubEnv('WEB_PUSH_PUBLIC_KEY',key.getPublicKey().toString('base64url'));vi.stubEnv('WEB_PUSH_PRIVATE_KEY',key.getPrivateKey().toString('base64url'));vi.stubEnv('WEB_PUSH_SUBJECT','https://synthetic.example.test');expect(webPushConfig()?.publicKey).toBe(key.getPublicKey().toString('base64url'));
 const other=createECDH('prime256v1');other.generateKeys();vi.stubEnv('WEB_PUSH_PRIVATE_KEY',other.getPrivateKey().toString('base64url'));expect(webPushConfig()).toBeNull();
});
it('the service worker shows one branded push and never opens an external notification link',async()=>{
 const handlers=new Map<string,(event:unknown)=>void>();const show=vi.fn(async()=>{}),open=vi.fn(async()=>{});
 runInNewContext(readFileSync('public/firebase-messaging-sw.js','utf8'),{URL,self:{location:{origin:'https://synthetic.example.test'},addEventListener:(name:string,handler:(e:unknown)=>void)=>handlers.set(name,handler),registration:{showNotification:show},clients:{matchAll:async()=>[],openWindow:open}}});
 const waits:Promise<unknown>[]=[];
 handlers.get('push')!({data:{json:()=>({title:'Synthetic',body:'Completed',icon:'/app-icon/192',url:'/workzone/plan',tag:'one-event'})},waitUntil:(p:Promise<unknown>)=>waits.push(p)});await Promise.all(waits);
 expect(show).toHaveBeenCalledTimes(1);expect(show.mock.calls[0]).toEqual(['Synthetic',expect.objectContaining({icon:'/app-icon/192',tag:'one-event'})]);
 handlers.get('notificationclick')!({notification:{close:()=>{},data:{url:'https://evil.example.test'}},waitUntil:(p:Promise<unknown>)=>waits.push(p)});await Promise.all(waits);expect(open).toHaveBeenCalledWith('https://synthetic.example.test/workzone');
});
