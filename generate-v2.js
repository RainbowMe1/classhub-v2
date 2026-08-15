const fs = require('fs');
const path = require('path');

function wf(p, c) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] ' + p);
}

console.log('=== generate-v2: ClassHub ===');

// === PART SW FIX: HTML SELALU FRESH, CACHE LAMA DIBUANG ===

wf('public/sw.js', `var CACHE = 'classhub-v2';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var accept = e.request.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(e.request, copy);
        }).catch(function () {});
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
`);

console.log('[OK] Part SW Fix done: HTML selalu fresh');

// === PART NOTIF v2: HAPUS SATUAN + HAPUS YANG DIBACA ===

wf('components/notifications/NotificationsClient.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

export default function NotificationsClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function remove(id: string) {
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
    if (error) setErr('Gagal hapus: ' + error.message);
    else setItems((prev) => prev.filter((n) => n.id !== id));
  }

  async function removeRead() {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId).eq('is_read', true);
    if (error) setErr('Gagal hapus: ' + error.message);
    else setItems((prev) => prev.filter((n) => !n.is_read));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-acc" />
          Notifikasi
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={markAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-acc hover:underline">
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </button>
          <button onClick={removeRead} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:underline">
            <Trash2 className="h-4 w-4" />
            Hapus yang dibaca
          </button>
        </div>
      </div>

      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

      {items.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center text-mut">Belum ada notifikasi 🎉</div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={'bg-card border border-line rounded-2xl p-4 flex items-start gap-3 ' + (n.is_read ? '' : 'border-l-2 border-l-acc')}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{n.title}</div>
              {n.message && <p className="text-sm text-mut mt-0.5">{n.message}</p>}
              <div className="text-xs text-mut mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
            </div>
            <button
              onClick={() => remove(n.id)}
              className="p-2 text-mut hover:text-red-400 rounded-lg hover:bg-red-500/10 shrink-0"
              aria-label="Hapus notifikasi"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
`);

console.log('[OK] PART NOTIF v2 done: hapus satuan + hapus yang dibaca');