'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, []);

  async function markAll() {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">Notifikasi</h1>
          <button onClick={markAll} className="flex items-center gap-1 text-xs text-[#a3e635]">
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada notifikasi</p>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className={'p-3 rounded-xl border ' + (n.is_read ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-[#a3e635]/5 border-[#a3e635]/30')}>
              <div className="text-sm font-semibold">{n.title}</div>
              {n.message && <p className="text-sm text-gray-300 mt-0.5">{n.message}</p>}
              <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
