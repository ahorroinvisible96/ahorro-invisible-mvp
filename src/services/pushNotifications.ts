"use client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const SW_PATH = '/sw.js';
const PUSH_HOUR = 20; // 8pm reminder if daily not done

// ─── Service worker registration ─────────────────────────────────────────────
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    console.info('[push] Service worker registered:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[push] Service worker registration failed:', err);
    return null;
  }
}

// ─── Notification permission ──────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ─── Push subscription (Web Push API) ────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set. Push notifications disabled.');
    return null;
  }
  const reg = await registerServiceWorker();
  if (!reg) return null;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
    console.info('[push] Subscribed:', subscription.endpoint);
    return subscription;
  } catch (err) {
    console.warn('[push] Subscribe failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

// ─── Local scheduled reminder (fallback when push server not available) ───────
let _reminderTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleLocalReminder(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if (_reminderTimer) clearTimeout(_reminderTimer);

  const now = new Date();
  const target = new Date(now);
  target.setHours(PUSH_HOUR, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const msUntil = target.getTime() - now.getTime();

  _reminderTimer = setTimeout(() => {
    if (typeof window === 'undefined') return;
    const dailyStatus = (() => {
      try {
        const raw = localStorage.getItem('ahorro_invisible_dashboard_v1');
        if (!raw) return 'pending';
        const store = JSON.parse(raw);
        const today = new Date().toISOString().split('T')[0];
        const done = store.decisions?.some((d: { date: string }) => d.date === today);
        return done ? 'completed' : 'pending';
      } catch { return 'pending'; }
    })();

    if (dailyStatus === 'pending') {
      new Notification('Ahorro Invisible ⚡', {
        body: '¿Ya registraste tu decisión de hoy? Solo tarda 10 segundos.',
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: 'daily-reminder',
      });
    }

    scheduleLocalReminder();
  }, msUntil);
}

export function cancelLocalReminder(): void {
  if (_reminderTimer) { clearTimeout(_reminderTimer); _reminderTimer = null; }
}
