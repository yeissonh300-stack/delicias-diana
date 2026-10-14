// Panel del negocio: lista, marca como entregado y elimina pedidos. Protegido con contraseña.
// Variable de entorno: ADMIN_PASSWORD (elige una contraseña larga).
const crypto = require('crypto');
const db = require('./_db');

function authed(req) {
  const real = String(process.env.ADMIN_PASSWORD || '');
  const given = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ ok: false, error: 'Falta ADMIN_PASSWORD' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
  if (!db.enabled()) return res.status(500).json({ ok: false, error: 'Falta conectar la base de datos' });

  try {
    if (req.method === 'GET') {
      const flat = await db.cmd(['HGETALL', 'pedidos']);
      const vals = Array.isArray(flat) ? flat.filter((_, i) => i % 2) : Object.values(flat || {});
      const orders = [];
      for (const v of vals) { try { orders.push(JSON.parse(v)); } catch (e) { /* omite */ } }
      orders.sort((x, y) => (y.fecha || '').localeCompare(x.fecha || ''));
      return res.status(200).json({ ok: true, orders: orders.slice(0, 500) });
    }

    const body = req.body || {};
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ ok: false, error: 'Falta el pedido' });

    if (req.method === 'PATCH') {
      if (!['pendiente', 'entregado'].includes(body.estado)) return res.status(400).json({ ok: false, error: 'Estado inválido' });
      const raw = await db.cmd(['HGET', 'pedidos', id]);
      if (!raw) return res.status(404).json({ ok: false, error: 'No existe' });
      const o = JSON.parse(raw);
      o.estado = body.estado;
      await db.cmd(['HSET', 'pedidos', id, JSON.stringify(o)]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await db.cmd(['HDEL', 'pedidos', id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Error con la base de datos' });
  }
};
