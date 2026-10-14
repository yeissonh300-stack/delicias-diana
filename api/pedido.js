// Recibe el pedido desde la página, lo guarda y lo envía a WhatsApp sin abrir ventanas.
// Variables de entorno (Vercel > Settings > Environment Variables):
//   CALLMEBOT_PHONE  = +573138787184
//   CALLMEBOT_APIKEY = la clave que te responde el bot de CallMeBot
//   (la base de datos agrega sus propias variables al conectarla)
const db = require('./_db');

const PRODUCTS = {
  hamb: { name: 'Hamburguesa', price: 15000 },
  sand: { name: 'Sándwich gratinado', price: 15000 },
  tamal: { name: 'Tamal', price: 15000 },
  chic: { name: 'Chicharrón al barril', price: 35000, opts: ['Patacones', 'Papas a la francesa'] },
  punta: { name: 'Punta de anca asada', price: 30000, opts: ['Patacones', 'Papas a la francesa'] }
};

const money = n => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const clean = (s, max) => String(s || '').replace(/[\r\n*_~`]+/g, ' ').trim().slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  const body = req.body || {};
  const nombre = clean(body.nombre, 80);
  const dir = clean(body.dir, 160);
  const nota = clean(body.nota, 300);
  const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  if (!nombre || !dir || !items.length) return res.status(400).json({ ok: false, error: 'Datos incompletos' });

  // Los precios se calculan aquí, no se toman de la página.
  let total = 0;
  const rows = [];
  const lines = [];
  for (const it of items) {
    const p = PRODUCTS[it.id];
    const qty = Math.floor(Number(it.qty));
    if (!p || !(qty >= 1 && qty <= 50)) return res.status(400).json({ ok: false, error: 'Producto inválido' });
    const opt = p.opts ? (p.opts.includes(it.opt) ? it.opt : p.opts[0]) : '';
    const value = p.price * qty;
    total += value;
    rows.push({ id: it.id, name: p.name, opt, qty, price: p.price });
    lines.push(`• ${qty} x ${p.name}${opt ? ' (' + opt + ')' : ''} — ${money(p.price)} c/u = ${money(value)}`);
  }

  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fecha: new Date().toISOString(),
    nombre, dir, nota, items: rows, total, estado: 'pendiente'
  };

  let saved = false;
  let sent = false;

  if (db.enabled()) {
    try { await db.cmd(['HSET', 'pedidos', order.id, JSON.stringify(order)]); saved = true; } catch (e) { /* sigue */ }
  }

  const { CALLMEBOT_PHONE, CALLMEBOT_APIKEY } = process.env;
  if (CALLMEBOT_PHONE && CALLMEBOT_APIKEY) {
    const text =
      `*NUEVO PEDIDO · Las Delicias de Diana*\n\n` +
      `*Cliente:* ${nombre}\n*Dirección/mesa:* ${dir}\n\n` +
      lines.join('\n') +
      `\n\n*TOTAL: ${money(total)}*` +
      (nota ? `\n*Notas:* ${nota}` : '');
    try {
      const url = 'https://api.callmebot.com/whatsapp.php?' + new URLSearchParams({
        phone: CALLMEBOT_PHONE, text, apikey: CALLMEBOT_APIKEY
      });
      const r = await fetch(url);
      sent = r.ok;
    } catch (e) { /* sigue */ }
  }

  if (!saved && !sent) return res.status(502).json({ ok: false, error: 'No se pudo registrar el pedido' });
  return res.status(200).json({ ok: true, saved, sent });
};
