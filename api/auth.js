import crypto from 'node:crypto';
import { sql } from './_db.js';
import { signSession, readSession, cookie, hashPw, checkPw } from './_session.js';

const pub = u => ({ id: u.id, name: u.name, email: u.email });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// GET  /api/auth                 -> { user } | { user: null }
// POST /api/auth {action:'signup', name, email, password}
// POST /api/auth {action:'login', email, password}
// POST /api/auth {action:'logout'}
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const s = readSession(req);
      if (!s) return res.status(200).json({ user: null });
      const [u] = await sql`select id, name, email from users where id = ${s.id}`;
      return res.status(200).json({ user: u ? pub(u) : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { action, name, email, password } = req.body || {};
    if (action === 'logout') { res.setHeader('Set-Cookie', cookie('', 0)); return res.status(200).json({ ok: true }); }
    const mail = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(mail) || typeof password !== 'string' || password.length < 8 || password.length > 200)
      return res.status(400).json({ error: 'Enter a valid email and a password of at least 8 characters.' });
    if (action === 'signup') {
      const nm = String(name || '').trim().slice(0, 60);
      if (nm.length < 2) return res.status(400).json({ error: 'Enter your name.' });
      const id = 'u_' + crypto.randomBytes(9).toString('base64url');
      const hash = await hashPw(password);
      const r = await sql`insert into users (id, email, name, pw_hash) values (${id}, ${mail}, ${nm}, ${hash})
                          on conflict (email) do nothing returning id, name, email`;
      if (!r.length) return res.status(409).json({ error: 'This email already has an account. Sign in instead.' });
      res.setHeader('Set-Cookie', cookie(signSession(r[0])));
      return res.status(200).json({ user: pub(r[0]) });
    }
    if (action === 'login') {
      const [u] = await sql`select id, name, email, pw_hash from users where email = ${mail}`;
      // same message for unknown email and wrong password
      if (!u || !(await checkPw(password, u.pw_hash))) return res.status(401).json({ error: 'Wrong email or password.' });
      res.setHeader('Set-Cookie', cookie(signSession(u)));
      return res.status(200).json({ user: pub(u) });
    }
    return res.status(400).json({ error: 'bad request' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
}
