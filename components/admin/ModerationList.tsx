'use client';
import { useRouter } from 'next/navigation';
import { hidePost } from '@/lib/auth/moderation-actions';
import { Eye, ShieldAlert } from 'lucide-react';

export default function ModerationList({ posts }: { posts: any[] }) {
  const router = useRouter();

  async function unhide(id: string) {
    const res = await hidePost(id, false);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="h-6 w-6 text-[#fb923c]" />
        Moderasi
      </h1>
      <p className="text-sm text-mut">Postingan yang disembunyikan dari feed kelas.</p>
      {posts.length === 0 ? (
        <div className="text-center py-16 text-mut">Tidak ada postingan tersembunyi.</div>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="p-3 rounded-xl bg-card border border-line">
            <div className="text-xs text-mut mb-1">
              {p.profiles?.full_name} @{p.profiles?.username}
            </div>
            {p.content && <p className="text-sm text-ink-soft whitespace-pre-wrap">{p.content}</p>}
            {p.media_urls && p.media_urls.length > 0 && (
              <p className="text-xs text-mut mt-1">{p.media_urls.length} media</p>
            )}
            <button
              onClick={() => unhide(p.id)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
            >
              <Eye className="h-3 w-3" />
              Tampilkan lagi
            </button>
          </div>
        ))
      )}
    </div>
  );
}
