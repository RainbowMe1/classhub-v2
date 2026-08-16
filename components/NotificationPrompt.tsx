'use client';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { saveSubscription, removeSubscription } from '@/lib/auth/push-actions';

const VAPID_PUBLIC = 'BCw4E0HK3-RvkTvJqNNxR66YD-9BNoVvGEVMkxUdux4V-d_lm1rfwyFfDX3FI15t2XM--bviqsFl3XEb4e0FME0';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setSubscribed(true);
          return;
        }
        const dismissed = localStorage.getItem('notif_prompt_dismissed');
        if (!dismissed) setShow(true);
      } catch (e) {}
    })();
  }, []);

  async function subscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const json = sub.toJSON();
      await saveSubscription(json.endpoint!, json.keys!.p256dh, json.keys!.auth);
      setSubscribed(true);
      setShow(false);
    } catch (e: any) {
      alert('Gagal mengaktifkan notifikasi: ' + (e.message || 'permission ditolak'));
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {}
    setLoading(false);
  }

  function dismiss() {
    setShow(false);
    localStorage.setItem('notif_prompt_dismissed', '1');
  }

  if (show && !subscribed) {
    return (
      <div className="fixed bottom-20 left-3 right-3 md:bottom-4 md:left-auto md:right-4 md:w-96 z-40 bg-card border border-line rounded-2xl p-4 shadow-xl anim-fade-up">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-acc/10 text-acc shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Izinkan Notifikasi?</div>
            <p className="text-xs text-mut mt-0.5">
              Dapatkan pemberitahuan langsung di HP saat ada tugas baru, pengumuman, atau chat masuk.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={subscribe}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Izinkan'}
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-2 rounded-lg bg-line text-mut text-xs font-semibold hover:bg-line-2"
              >
                Nanti
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function NotificationToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (e) {}
    })();
  }, []);

  async function toggle() {
    setLoading(true);
    if (subscribed) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removeSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } catch (e) {}
    } else {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
        const json = sub.toJSON();
        await saveSubscription(json.endpoint!, json.keys!.p256dh, json.keys!.auth);
        setSubscribed(true);
      } catch (e: any) {
        alert('Gagal: ' + (e.message || 'permission ditolak'));
      }
    }
    setLoading(false);
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ' + (subscribed ? 'bg-acc/10 text-acc' : 'bg-line text-mut hover:bg-line-2')}
    >
      <span className="flex items-center gap-2">
        <Bell className="h-4 w-4" />
        Notifikasi Push
      </span>
      <span className={'text-xs px-2 py-0.5 rounded-full ' + (subscribed ? 'bg-acc text-acc-ink' : 'bg-line-2')}>
        {loading ? '...' : subscribed ? 'Aktif' : 'Nonaktif'}
      </span>
    </button>
  );
}
