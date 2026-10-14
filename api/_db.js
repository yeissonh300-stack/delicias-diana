// Conexión a la base de datos Redis (Upstash). Vercel agrega estas variables al conectar la base.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

exports.enabled = () => Boolean(URL_ && TOKEN);

exports.cmd = async function cmd(args) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('db');
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
