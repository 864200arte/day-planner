// Необов'язковий сервер для «Мій день»: (1) Web Push нагадування, (2) безпечний проксі до AI.
// Запуск: cd server && npm install && npm start      (див. README.md)
import http from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';        // у продакшні вкажіть адресу вашого PWA, напр. https://user.github.io
const DATA_FILE = process.env.DATA_FILE || join(DIR, 'data.json');
const VAPID_FILE = join(DIR, 'vapid.json');
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';       // ключ ніколи не потрапляє в клієнт
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-5-5';
const CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@example.com';

// ---------- VAPID ----------
let vapid;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
else if (existsSync(VAPID_FILE)) vapid = JSON.parse(readFileSync(VAPID_FILE, 'utf8'));
else { vapid = webpush.generateVAPIDKeys(); writeFileSync(VAPID_FILE, JSON.stringify(vapid, null, 2)); console.log('Згенеровано нові VAPID-ключі →', VAPID_FILE); }
webpush.setVapidDetails(CONTACT, vapid.publicKey, vapid.privateKey);

// ---------- Сховище (JSON-файл) ----------
let db = { subs: {} }; // endpoint -> { subscription, reminders:[{id,at,title,body,tag}] }
try { if (existsSync(DATA_FILE)) db = JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch (e) { console.warn('Не вдалося прочитати data.json:', e.message); }
let dirty = false;
const save = () => { if (!dirty) return; dirty = false; try { writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) { console.warn('save', e.message); } };
setInterval(save, 5000).unref();

// ---------- Допоміжне ----------
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...cors }); res.end(JSON.stringify(body)); };
const readBody = (req, limit = 256 * 1024) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Занадто великий запит')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('Некоректний JSON')); } });
  req.on('error', reject);
});
const validSub = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';

const hits = new Map(); // простий rate-limit
const limited = (ip, max = 40) => { const now = Date.now(); const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a); return a.length > max; };

// ---------- Розсилка нагадувань ----------
const tick = async () => {
  const now = Date.now();
  for (const [endpoint, rec] of Object.entries(db.subs)) {
    const due = rec.reminders.filter((r) => r.at <= now);
    if (!due.length) continue;
    rec.reminders = rec.reminders.filter((r) => r.at > now);
    dirty = true;
    for (const r of due) {
      if (now - r.at > 30 * 60000) continue; // застаріле — не надсилаємо
      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({ title: r.title, body: r.body, tag: r.id }), { TTL: 600, urgency: 'high' });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { delete db.subs[endpoint]; console.log('Підписку видалено (недійсна)'); break; }
        console.warn('push помилка', e.statusCode || e.message);
      }
    }
  }
};
setInterval(() => tick().catch((e) => console.warn('tick', e.message)), 15000).unref();

// ---------- AI-проксі ----------
const SYSTEM = `Ти — помічник особистого планувальника дня. Відповідай українською, коротко й по справі.
Користувач надсилає запит і контекст (сьогоднішня дата, завдання на 3 дні, цілі, категорії). Поверни ЛИШЕ JSON без пояснень:
{"reply": "текст відповіді", "tasks": [{"title": "...", "date": "YYYY-MM-DD", "start": "HH:MM" | null, "end": "HH:MM" | null, "duration": хвилини | null, "categoryId": "id з контексту" | null, "priority": 0-3, "important": true|false}]}
"tasks" містить ЛИШЕ нові завдання, які користувач просить створити (інакше порожній масив). Не вигадуй факти про його дані. Нічого не застосовується без підтвердження користувача.`;

const askAI = async (message, history, context) => {
  const msgs = [...(Array.isArray(history) ? history.slice(-8) : []).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text || '').slice(0, 2000) })), { role: 'user', content: `Контекст: ${JSON.stringify(context).slice(0, 12000)}\n\nЗапит: ${String(message).slice(0, 2000)}` }];
  // Anthropic вимагає, щоб розмова починалась з user і ролі чергувались
  const clean = []; for (const m of msgs) { if (!clean.length && m.role !== 'user') continue; if (clean.length && clean.at(-1).role === m.role) clean.at(-1).content += '\n' + m.content; else clean.push(m); }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 1200, system: SYSTEM, messages: clean }),
  });
  if (!r.ok) throw new Error('AI API ' + r.status);
  const j = await r.json();
  const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  try { const p = JSON.parse(m ? m[0] : text); return { reply: String(p.reply || ''), tasks: Array.isArray(p.tasks) ? p.tasks.slice(0, 12) : [] }; } catch { return { reply: text.slice(0, 1500), tasks: [] }; }
};

// ---------- HTTP ----------
const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || '?';
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, push: true, ai: !!AI_KEY, subs: Object.keys(db.subs).length });
    if (req.method === 'GET' && url.pathname === '/api/vapid') return send(res, 200, { publicKey: vapid.publicKey });
    if (limited(ip)) return send(res, 429, { error: 'Забагато запитів' });

    if (req.method === 'POST' && url.pathname === '/api/sync') {
      const { subscription, reminders } = await readBody(req);
      if (!validSub(subscription) || !Array.isArray(reminders)) return send(res, 400, { error: 'Некоректні дані' });
      const clean = reminders.slice(0, 500).filter((r) => r && typeof r.at === 'number' && typeof r.title === 'string').map((r) => ({ id: String(r.id || '').slice(0, 120), at: r.at, title: r.title.slice(0, 120), body: String(r.body || '').slice(0, 240) }));
      db.subs[subscription.endpoint] = { subscription, reminders: clean, updated: Date.now() }; dirty = true;
      return send(res, 200, { ok: true, scheduled: clean.length });
    }
    if (req.method === 'POST' && url.pathname === '/api/unsubscribe') {
      const { endpoint } = await readBody(req); if (endpoint) { delete db.subs[endpoint]; dirty = true; }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/test') {
      const { subscription } = await readBody(req);
      if (!validSub(subscription)) return send(res, 400, { error: 'Некоректна підписка' });
      await webpush.sendNotification(subscription, JSON.stringify({ title: 'Мій день', body: 'Тестове push-сповіщення працює ✅', tag: 'test' }));
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/ai') {
      if (!AI_KEY) return send(res, 501, { error: 'AI не налаштовано: задайте ANTHROPIC_API_KEY на сервері' });
      if (limited(ip + ':ai', 15)) return send(res, 429, { error: 'Забагато AI-запитів' });
      const { message, history, context } = await readBody(req);
      if (typeof message !== 'string' || !message.trim()) return send(res, 400, { error: 'Порожній запит' });
      return send(res, 200, await askAI(message, history, context || {}));
    }
    send(res, 404, { error: 'Не знайдено' });
  } catch (e) {
    console.warn('Помилка запиту:', e.message);
    send(res, e.statusCode && e.statusCode < 500 ? 400 : 500, { error: e.message || 'Помилка сервера' });
  }
});

server.listen(PORT, () => console.log(`Сервер «Мій день» слухає порт ${PORT} · push: так · AI: ${AI_KEY ? 'так (' + AI_MODEL + ')' : 'ні'} · CORS: ${ORIGIN}`));
process.on('SIGTERM', () => { save(); process.exit(0); });
process.on('SIGINT', () => { save(); process.exit(0); });
