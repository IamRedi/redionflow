import { createECDH } from 'node:crypto';
import { sendNotification as deliver } from 'web-push';

const PREFIX = 'webpush:';
export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Browser push services only; a client-supplied endpoint is never arbitrary server egress. */
export function validBrowserSubscription(value: unknown): value is BrowserSubscription {
  if (!value || typeof value !== 'object') return false;
  const s = value as BrowserSubscription;
  try {
    const u = new URL(s.endpoint);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash
      || !(host === 'fcm.googleapis.com' || host === 'web.push.apple.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com'))) return false;
    return s.endpoint.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(s.keys.p256dh) && /^[A-Za-z0-9_-]+$/.test(s.keys.auth)
      && Buffer.from(s.keys.p256dh, 'base64url').length === 65 && Buffer.from(s.keys.p256dh, 'base64url')[0] === 4
      && Buffer.from(s.keys.auth, 'base64url').length === 16;
  } catch { return false; }
}
export function browserSubscriptionPrefix(endpoint: string) { return PREFIX + JSON.stringify({ endpoint: new URL(endpoint).href }).slice(0, -1) + ','; }
export function encodeBrowserSubscription(value: BrowserSubscription) { return PREFIX + JSON.stringify({ endpoint: new URL(value.endpoint).href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } }); }
export function decodeBrowserSubscription(value: string): BrowserSubscription | null {
  if (!value.startsWith(PREFIX)) return null;
  try { const s: unknown = JSON.parse(value.slice(PREFIX.length)); return validBrowserSubscription(s) ? s : null; } catch { return null; }
}
export const isBrowserSubscription = (value: string) => value.startsWith(PREFIX);

export function webPushConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim(), privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || process.env.APP_BASE_URL?.trim();
  if (!publicKey || !privateKey || !subject || !/^(https:\/\/|mailto:)/.test(subject)) return null;
  try {
    const key = createECDH('prime256v1'); key.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    if (key.getPublicKey().toString('base64url') !== publicKey) return null;
    return { publicKey, privateKey, subject };
  } catch { return null; }
}
export async function deliverBrowserPush(subscription: BrowserSubscription, payload: { title: string; body: string; url: string; tag?: string }) {
  const config = webPushConfig();
  if (!config) return { ok: false, expired: false, configured: false };
  try {
    await deliver(subscription, JSON.stringify({ ...payload, icon: '/app-icon/192', badge: '/app-icon/192' }), {
      vapidDetails: config, TTL: 86400, urgency: 'normal', timeout: 5000,
    });
    return { ok: true, expired: false, configured: true };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return { ok: false, expired: status === 404 || status === 410, configured: true };
  }
}
