'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, [userId]);

  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifikasi</h1>
        <button onClick={markAll} className="flex items-center gap-1 text-xs text-acc hover:underline">
          <CheckCheck className="h-4 w-4" />
          Tandai semua dibaca
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-mut">
          <Bell className="h-12 w-12 mx-auto mb-4" />
          <p>Belum ada notifikasi</p>
        </div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={'p-3 rounded-xl border ' + (n.is_read ? 'bg-card border-line' : 'bg-acc/5 border-acc/30')}
          >
            <div className="text-sm font-semibold text-ink">{n.title}</div>
            {n.message && <p className="text-sm text-ink-soft mt-0.5">{n.message}</p>}
            <div className="text-xs text-mut mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
          </div>
        ))
      )}
    </div>
  );
}
