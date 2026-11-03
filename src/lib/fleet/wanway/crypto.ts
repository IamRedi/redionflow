import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Independent, versioned server-only keyring. Never reuse session/login secrets.
function keyring() {
  const active = process.env.WANWAY_ACTIVE_KEY_ID ?? '';
  let keys: Record<string, string>;
  try {
    keys = JSON.parse(process.env.WANWAY_ENCRYPTION_KEYS ?? '{}');
  } catch {
    throw new Error('WANWAY_KEYRING');
  }
  if (
    !/^[a-zA-Z0-9_-]{1,32}$/.test(active) ||
    !keys ||
    !/^[a-f0-9]{64}$/i.test(keys[active] ?? '')
  )
    throw new Error('WANWAY_KEYRING');
  return { active, keys };
}

export function encryptionReady() {
  try {
    keyring();
    return true;
  } catch {
    return false;
  }
}

export function seal(value: string, tenant: string, purpose: 'key' | 'token') {
  const { active, keys } = keyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(keys[active], 'hex'),
    iv,
  );
  cipher.setAAD(Buffer.from(`wanway:v1:${tenant}:${purpose}`));
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    active,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function unseal(
  value: string,
  tenant: string,
  purpose: 'key' | 'token',
) {
  const { keys } = keyring();
  const [version, id, iv, tag, encrypted, extra] = value.split('.');
  if (
    version !== 'v1' ||
    extra !== undefined ||
    !/^[a-f0-9]{64}$/i.test(keys[id] ?? '') ||
    !iv ||
    !tag ||
    !encrypted
  )
    throw new Error('WANWAY_DECRYPT');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keys[id], 'hex'),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAAD(Buffer.from(`wanway:v1:${tenant}:${purpose}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
