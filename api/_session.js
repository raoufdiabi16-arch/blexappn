import crypto from 'node:crypto';
const SECRET = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
  return s;
};
const b64 = b => Buffer.from(b).toString('base64url');
const mac = p => crypto.createHmac('sha256', SECRET()).update(p).digest('base64url');
const DAYS = 30;

export function signSession(user) {
  const p = b64(JSON.stringify({ id: user.id, exp: Date.now() + DAYS * 864e5 }));
  return p + '.' + mac(p);
}
export function readSession(req) {
  const m = /(?:^|;\s*)blex=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, sig] = m[1].split('.');
  if (!p || !sig) return null;
  const good = mac(p);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d : null; } catch { return null; }
}
export const cookie = (v, maxAge = DAYS * 86400) =>
  `blex=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

export async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await new Promise((r, j) => crypto.scrypt(pw, salt, 64, (e, k) => e ? j(e) : r(k)));
  return salt.toString('base64') + ':' + h.toString('base64');
}
export async function checkPw(pw, stored) {
  const [s, h] = stored.split(':');
  const k = await new Promise((r, j) => crypto.scrypt(pw, Buffer.from(s, 'base64'), 64, (e, k) => e ? j(e) : r(k)));
  const want = Buffer.from(h, 'base64');
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}
