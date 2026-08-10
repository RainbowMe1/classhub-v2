'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { deleteOwnPost } from '@/lib/auth/moderation-actions';
import { updateOwnPost, hideOwnPost, unhideOwnPost } from '@/lib/auth/post-actions';
import { Files, Trash2, Film, Pencil, EyeOff, Eye, X, Check } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function MyPostsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setErr('');
    const res = await deleteOwnPost(id);
    setBusy(false);
    if (res && res.error) {
      setErr(res.error);
    } else {
      router.refresh();
      if (profile) load(profile.user_id);
    }
  }

  async function toggleHide(p: any) {
    setBusy(true);
    setErr('');
    const res = p.is_hidden ? await unhideOwnPost(p.id) : await hideOwnPost(p.id);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      router.refresh();
      if (profile) load(profile.user_id);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setErr('');
    const fd = new FormData();
    fd.append('id', edit.id);
    fd.append('content', editContent);
    const res = await updateOwnPost(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setEdit(null);
      router.refresh();
      if (profile) load(profile.user_id);
    }
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
        {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
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
                  {p.is_hidden ? ' • 🚫 disembunyikan' : ''}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEdit(p); setEditContent(p.content || ''); }}
                    disabled={busy}
                    className="p-1.5 text-mut hover:text-ink rounded"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleHide(p)}
                    disabled={busy}
                    className="p-1.5 text-mut hover:text-ink rounded"
                    aria-label={p.is_hidden ? 'Tampilkan' : 'Sembunyikan'}
                  >
                    {p.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busy}
                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {p.content && <p className="text-sm whitespace-pre-wrap">{p.content}</p>}
              {p.media_urls && p.media_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {p.media_urls.map((u: string, i: number) =>
                    isVideo(u) ? (
                      <div key={i} className="relative shrink-0">
                        <video src={u} muted preload="metadata" playsInline className="h-20 w-20 rounded-lg object-cover border border-line bg-black" />
                        <Film className="h-4 w-4 text-white absolute top-1 right-1" />
                      </div>
                    ) : (
                      <img key={i} src={u} alt="" loading="lazy" className="h-20 w-20 rounded-lg object-cover border border-line shrink-0" />
                    )
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {edit && (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setEdit(null)}>
            <div
              role="dialog"
              aria-modal="true"
              className="bg-card border border-line rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-acc" />
                  Edit Postingan
                </h3>
                <button onClick={() => setEdit(null)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                placeholder="Tulis sesuatu..."
                className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50 resize-none"
              />
              {edit.media_urls && edit.media_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {edit.media_urls.map((u: string, i: number) =>
                    isVideo(u) ? (
                      <video key={i} src={u} muted preload="metadata" playsInline className="h-16 w-16 rounded-lg object-cover border border-line bg-black" />
                    ) : (
                      <img key={i} src={u} alt="" className="h-16 w-16 rounded-lg object-cover border border-line" />
                    )
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEdit(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50">
                  Batal
                </button>
                <button onClick={saveEdit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy ? 'Menyimpan...' : <><Check className="h-4 w-4" /> Simpan</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
