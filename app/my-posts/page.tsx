'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { deleteOwnPost } from '@/lib/auth/moderation-actions';
import { Files, Trash2 } from 'lucide-react';

export default function MyPostsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(userId: string) {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) setProfile(p);
      load(user.id);
    })();
  }, []);

  async function remove(id: string) {
    if (!window.confirm('Hapus postingan ini? Slot upload kamu bakal kosong lagi.')) return;
    const res = await deleteOwnPost(id);
    if (res && res.error) window.alert(res.error);
    else if (profile) load(profile.user_id);
  }

  if (!profile) return <div className="min-h-screen" />;

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Files className="h-6 w-6 text-acc" />
          Postinganku
        </h1>
        <div className="p-3 rounded-xl bg-card border border-line text-sm text-mut">
          {loading ? (
            'Menghitung postingan...'
          ) : (
            <>
              Kamu punya <span className="font-bold text-ink">{posts.length}</span> dari maksimal <span className="font-bold text-acc">8</span> postingan.
              {posts.length >= 8 && ' Limit tercapai — hapus yang lama buat upload lagi.'}
            </>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-line rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-24 rounded bg-line mb-3" />
                <div className="h-4 w-3/4 rounded bg-line mb-2" />
                <div className="h-20 w-full rounded-xl bg-line-2" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-mut">Belum ada postingan.</div>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="bg-card border border-line rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-mut">
                  {new Date(p.created_at).toLocaleString('id-ID')}
                  {p.is_hidden ? ' • 🚫 disembunyikan admin' : ''}
                </div>
                <button onClick={() => remove(p.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.content && <p className="text-sm whitespace-pre-wrap">{p.content}</p>}
              {p.media_urls && p.media_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {p.media_urls.map((u: string, i: number) => (
                    <img key={i} src={u} alt="" className="h-20 w-20 rounded-lg object-cover border border-line shrink-0" />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
