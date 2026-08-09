'use client';
import { useRouter } from 'next/navigation';
import { hidePost, deletePost } from '@/lib/auth/moderation-actions';
import { EyeOff, Trash2 } from 'lucide-react';

export default function PostModMenu({ postId, canDelete }: { postId: string; canDelete: boolean }) {
  const router = useRouter();

  async function hide() {
    if (!window.confirm('Sembunyikan postingan ini dari feed?')) return;
    const res = await hidePost(postId, true);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Hapus postingan ini permanen?')) return;
    const res = await deletePost(postId);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={hide} className="p-1.5 text-mut hover:text-ink" aria-label="Sembunyikan postingan">
        <EyeOff className="h-4 w-4" />
      </button>
      {canDelete && (
        <button onClick={remove} className="p-1.5 text-mut hover:text-red-400" aria-label="Hapus postingan">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
