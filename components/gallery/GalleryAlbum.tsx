'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { deleteAlbum } from '@/lib/auth/gallery-actions';
import { Upload, Trash2 } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff }: { album: any; userId: string; isStaff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);

  async function remove() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus dari galeri.')) return;
    const res = await deleteAlbum(album.id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink truncate">{album.name}</h2>
          {album.description && <p className="text-sm text-mut">{album.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
          >
            <Upload className="h-3 w-3" />
            Tambah Foto
          </button>
          {isStaff && (
            <button onClick={remove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus album">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-mut py-4">Album kosong. Tambah foto pertama!</p>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <button
              key={m.id}
              onClick={() => setOpen(i)}
              className="mb-2 w-full rounded-xl overflow-hidden border border-line bg-card-2 break-inside-avoid"
              aria-label="Lihat detail"
            >
              {m.media_type === 'video' ? (
                <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto" />
              ) : (
                <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto" />
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} userId={userId} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
