import { sql } from './_db.js';

// GET /api/catalog -> { products: [...], niches: [...] } (newest first)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const [products, niches] = await Promise.all([
      sql`select data from products order by created_at desc limit 200`,
      sql`select data from niches order by created_at desc limit 100`,
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ products: products.map(r => r.data), niches: niches.map(r => r.data) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'database error' });
  }
}
