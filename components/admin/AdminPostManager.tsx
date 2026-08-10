'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hideAnyPost, unhideAnyPost, deleteAnyPost } from '@/lib/auth/post-actions';
import Avatar from '@/components/Avatar';
import { EyeOff, Eye, Trash2, Film } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function AdminPostManager({ posts, isAdmin }: { posts: any[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function toggleHide(p: any) {
    setBusy(true);
    setErr('');
    const res = p.is_hidden ? await unhideAnyPost(p.id) : await hideAnyPost(p.id);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm('Hapus postingan dari ' + name + '? Ini permanen.')) return;
    setBusy(true);
    setErr('');
    const res = await deleteAnyPost(id);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-mut">Belum ada postingan.</div>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="bg-card border border-line rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Avatar data={p.profiles} className="h-10 w-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-semibold text-sm truncate">{p.profiles?.full_name}</div>
                  <div className="text-xs text-mut">@{p.profiles?.username}</div>
                  {p.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">disembunyikan</span>}
                </div>
                <div className="text-xs text-mut mb-2">{new Date(p.created_at).toLocaleString('id-ID')}</div>
                {p.content && <p className="text-sm whitespace-pre-wrap mb-2">{p.content}</p>}
                {p.media_urls && p.media_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
                    {p.media_urls.map((u: string, i: number) =>
                      isVideo(u) ? (
                        <div key={i} className="relative shrink-0">
                          <video src={u} muted preload="metadata" playsInline className="h-16 w-16 rounded-lg object-cover border border-line bg-black" />
                          <Film className="h-3 w-3 text-white absolute top-1 right-1" />
                        </div>
                      ) : (
                        <img key={i} src={u} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover border border-line shrink-0" />
                      )
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleHide(p)}
                  disabled={busy}
                  className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line"
                  aria-label={p.is_hidden ? 'Tampilkan' : 'Sembunyikan'}
                >
                  {p.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => remove(p.id, p.profiles?.full_name || 'user')}
                    disabled={busy}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
