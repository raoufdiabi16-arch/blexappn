import { sql } from './_db.js';
import { readSession } from './_session.js';

// POST /api/publish  { kind: 'product' | 'niche', item: {...} }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const sess = readSession(req);
  if (!sess) return res.status(401).json({ error: 'sign in required' });
  const [user] = await sql`select id, name from users where id = ${sess.id}`;
  if (!user) return res.status(401).json({ error: 'sign in required' });
  const { kind, item } = req.body || {};
  if (!['product', 'niche'].includes(kind) || !item || typeof item !== 'object')
    return res.status(400).json({ error: 'bad request' });
  // the seller is always the signed-in user, never what the browser claims
  item.seller = user.id; item.sellerName = user.name;
  const id = String(item.id || '').slice(0, 64), seller = user.id;
  const name = String(item.name || '').trim();
  if (!id || !seller || !name || name.length > 120) return res.status(400).json({ error: 'invalid item' });
  if (kind === 'product' && !(Number(item.price) >= 0)) return res.status(400).json({ error: 'invalid price' });
  // photos that only exist in this browser (blob:) are useless to other users
  if (Array.isArray(item.photos)) item.photos = item.photos.filter(u => typeof u === 'string' && !u.startsWith('blob:'));
  if (JSON.stringify(item).length > 3_500_000) return res.status(413).json({ error: 'too large' });
  try {
    if (kind === 'product')
      await sql`insert into products (id, seller, data) values (${id}, ${seller}, ${JSON.stringify(item)}::jsonb)
                on conflict (id) do update set data = excluded.data where products.seller = excluded.seller`;
    else
      await sql`insert into niches (id, seller, data) values (${id}, ${seller}, ${JSON.stringify(item)}::jsonb)
                on conflict (id) do update set data = excluded.data where niches.seller = excluded.seller`;
    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'database error' });
  }
}
