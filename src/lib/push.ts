// Web Push: працює лише для PWA, доданого на головний екран (iOS 16.4+), і лише з власним push-сервером (папка /server).
import { buildDue } from './reminders';
import { getState } from './store';

export interface PushSupport {
  ios: boolean; standalone: boolean; hasSW: boolean; hasNotification: boolean; hasPush: boolean;
  permission: NotificationPermission | 'unsupported'; ready: boolean; reason: string | null;
}

export const isStandalone = () =>
  (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export const pushSupport = (): PushSupport => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const hasSW = 'serviceWorker' in navigator;
  const hasNotification = 'Notification' in window;
  const hasPush = 'PushManager' in window;
  const standalone = isStandalone();
  const permission = hasNotification ? Notification.permission : 'unsupported';
  let reason: string | null = null;
  if (!hasSW) reason = 'Цей браузер не підтримує Service Worker.';
  else if (!window.isSecureContext) reason = 'Потрібне з’єднання HTTPS.';
  else if (ios && !standalone) reason = 'На iPhone push працює лише після «На початковий екран» і запуску з іконки (iOS 16.4+).';
  else if (!hasPush || !hasNotification) reason = 'Push-сповіщення недоступні в цьому браузері/версії iOS.';
  return { ios, standalone, hasSW, hasNotification, hasPush, permission, ready: reason === null, reason };
};

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const base = (server: string) => server.replace(/\/+$/, '');

const getReg = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? (await navigator.serviceWorker.ready);
};

export const getSubscription = async (): Promise<PushSubscription | null> => {
  try { const reg = await getReg(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
};

export const enablePush = async (server: string): Promise<{ ok: boolean; msg: string }> => {
  const sup = pushSupport();
  if (!sup.ready) return { ok: false, msg: sup.reason || 'Недоступно' };
  if (!server) return { ok: false, msg: 'Спершу вкажіть адресу push-сервера.' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, msg: 'Дозвіл на сповіщення не надано. Його можна змінити в Налаштуваннях iPhone → Сповіщення.' };
    const r = await fetch(`${base(server)}/api/vapid`);
    if (!r.ok) throw new Error('Сервер не відповів (' + r.status + ')');
    const { publicKey } = await r.json();
    const reg = await getReg();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    await syncPushNow(server, sub);
    return { ok: true, msg: 'Push-сповіщення увімкнено. Надішліть тестове, щоб перевірити.' };
  } catch (e: any) {
    return { ok: false, msg: 'Не вдалося увімкнути: ' + (e?.message || e) };
  }
};

export const disablePush = async (server: string) => {
  const sub = await getSubscription();
  if (!sub) return;
  try { if (server) await fetch(`${base(server)}/api/unsubscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch { /* ігноруємо */ }
  await sub.unsubscribe();
};

const syncPushNow = async (server: string, sub?: PushSubscription | null) => {
  const s = sub ?? (await getSubscription());
  if (!s) return;
  const st = getState();
  const now = Date.now();
  const reminders = buildDue(st, now, now + 7 * 86400000).map((d) => ({ id: d.key, at: d.at, title: d.title, body: d.body, kind: d.kind, taskId: d.taskId }));
  await fetch(`${base(server)}/api/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: s.toJSON(), reminders }) });
};

let t: number | null = null;
/** Передає серверу найближчі нагадування (з затримкою, щоб не частити) */
export const syncPush = () => {
  const server = getState().settings.pushServer;
  if (!server || !('serviceWorker' in navigator) || Notification?.permission !== 'granted') return;
  if (t) clearTimeout(t);
  t = window.setTimeout(() => { syncPushNow(server).catch(() => {}); }, 2500);
};

export const sendTestPush = async (server: string) => {
  const sub = await getSubscription();
  if (!sub) return { ok: false, msg: 'Підписки немає — спершу увімкніть push.' };
  try {
    const r = await fetch(`${base(server)}/api/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    return r.ok ? { ok: true, msg: 'Тестове повідомлення надіслано — воно має з’явитися за кілька секунд.' } : { ok: false, msg: 'Сервер повернув помилку ' + r.status };
  } catch (e: any) { return { ok: false, msg: 'Сервер недоступний: ' + (e?.message || e) }; }
};

export const pingServer = async (server: string) => {
  try { const r = await fetch(`${base(server)}/api/health`); return r.ok; } catch { return false; }
};
