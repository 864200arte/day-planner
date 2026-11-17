// Реєстрація Service Worker (лише у продакшн-збірці та в безпечному контексті).
export const registerSW = () => {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      // перевіряємо оновлення щоразу, коли застосунок повертається на передній план
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('SW не зареєстровано', e));
  });
};
