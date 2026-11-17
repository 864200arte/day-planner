// Запускає push-сервер + безкоштовний тунель Cloudflare (HTTPS без акаунта) і публікує актуальну адресу тунелю
// у гілку GitHub-репозиторію, звідки її автоматично підхоплює застосунок.
//
// Змінні середовища:
//   PUBLISH_REPO   власник/репо, напр. 864200arte/day-planner (обов'язково для автопублікації адреси)
//   PUBLISH_BRANCH гілка для файлу з адресою (за замовчуванням server-url)
//   CLOUDFLARED    шлях до cloudflared.exe;  GH_BIN — шлях до gh (GitHub CLI, має бути авторизований)
//   PORT, ALLOWED_ORIGIN, DATA_FILE, VAPID_FILE — передаються серверу
import { spawn, execFile } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || '8787';
const CLOUDFLARED = process.env.CLOUDFLARED || 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const GH = process.env.GH_BIN || 'gh';
const REPO = process.env.PUBLISH_REPO || '';
const BRANCH = process.env.PUBLISH_BRANCH || 'server-url';
const LOG = join(DIR, 'log.txt');
const LAST = join(DIR, 'last-url.txt');

const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}\n`;
  process.stdout.write(line);
  try { if (existsSync(LOG) && statSync(LOG).size > 1_000_000) writeFileSync(LOG, ''); appendFileSync(LOG, line); } catch { /* ігноруємо */ }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 20 }, (e, out, err) => (e ? reject(new Error(err || e.message)) : resolve(out.trim()))));

// ---------- сервер ----------
const startServer = () => {
  const p = spawn(process.execPath, [join(DIR, 'index.mjs')], { env: { ...process.env, PORT }, windowsHide: true });
  p.stdout.on('data', (d) => log('[server]', String(d).trim()));
  p.stderr.on('data', (d) => log('[server!]', String(d).trim()));
  p.on('exit', (c) => { log('Сервер завершився з кодом', c, '— перезапуск за 5 с'); setTimeout(startServer, 5000); });
};

// ---------- публікація адреси ----------
let published = existsSync(LAST) ? readFileSync(LAST, 'utf8').trim() : '';
const publish = async (url) => {
  if (!REPO) { log('PUBLISH_REPO не задано — адресу не опубліковано:', url); return; }
  for (let attempt = 1; ; attempt++) {
    try {
      let sha = '';
      try { sha = await run(GH, ['api', `repos/${REPO}/contents/url.json?ref=${BRANCH}`, '--jq', '.sha']); } catch { /* файлу ще немає */ }
      const content = Buffer.from(JSON.stringify({ pushServer: url, updatedAt: new Date().toISOString() }, null, 2)).toString('base64');
      const args = ['api', '-X', 'PUT', `repos/${REPO}/contents/url.json`, '-f', `message=Адреса push-сервера: ${url}`, '-f', `content=${content}`, '-f', `branch=${BRANCH}`];
      if (sha) args.push('-f', `sha=${sha}`);
      await run(GH, args);
      published = url; writeFileSync(LAST, url);
      log('Адресу опубліковано:', url);
      return;
    } catch (e) {
      log(`Не вдалося опублікувати адресу (спроба ${attempt}):`, e.message.split('\n')[0]);
      await sleep(Math.min(300000, 30000 * attempt));
    }
  }
};

// ---------- тунель ----------
// TUNNEL=localhostrun (за замовчуванням; SSH, вбудований у Windows) або cloudflare (cloudflared quick tunnel)
const PROVIDER = process.env.TUNNEL || 'localhostrun';
const SSH = process.env.SSH_BIN || 'C:\\Windows\\System32\\OpenSSH\\ssh.exe';
let tunnel = null; let tunnelUrl = '';
const startTunnel = () => {
  tunnelUrl = '';
  tunnel = PROVIDER === 'cloudflare'
    ? spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], { windowsHide: true })
    : spawn(SSH, ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'ExitOnForwardFailure=yes',
      '-R', `80:localhost:${PORT}`, 'nokey@localhost.run', '--', '--output', 'json'], { windowsHide: true });
  const onData = (d) => {
    const s = String(d);
    // api.trycloudflare.com — це адреса самого сервісу в повідомленнях про помилки, а не наш тунель
    const m = s.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/) || s.match(/https:\/\/[a-z0-9-]+\.(?:[a-z0-9-]+\.)?lhr\.life/);
    if (m && m[0] !== tunnelUrl) {
      tunnelUrl = m[0];
      log('Тунель:', tunnelUrl);
      if (tunnelUrl !== published) publish(tunnelUrl);
    }
    if (/ERR|error|denied|refused/i.test(s)) log('[tunnel]', s.trim().split('\n')[0].slice(0, 200));
  };
  tunnel.stdout.on('data', onData); tunnel.stderr.on('data', onData);
  tunnel.on('exit', (c) => { log('Тунель завершився з кодом', c, '— перезапуск за 10 с'); tunnel = null; setTimeout(startTunnel, 10000); });
};

// ---------- сторож: якщо тунель «завис», перезапускаємо його ----------
let fails = 0;
setInterval(async () => {
  if (!tunnelUrl) return;
  try {
    const r = await fetch(`${tunnelUrl}/api/health`, { signal: AbortSignal.timeout(15000) });
    fails = r.ok ? 0 : fails + 1;
  } catch { fails++; }
  if (fails >= 3) { log('Тунель не відповідає — перезапуск'); fails = 0; tunnel?.kill(); }
}, 5 * 60000);

log('Старт: порт', PORT, '· репо', REPO || '(не задано)');
startServer();
await sleep(1500);
startTunnel();
