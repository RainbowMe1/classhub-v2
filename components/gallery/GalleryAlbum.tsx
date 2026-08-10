'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { thumb } from '@/lib/img';
import { updateAlbum, deleteAlbum, deleteGalleryMedia } from '@/lib/auth/gallery-actions';
import { Upload, Trash2, Pencil, X, Check, Image as ImageIcon } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff }: { album: any; userId: string; isStaff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(album.name || '');
  const [desc, setDesc] = useState(album.description || '');
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);

  async function remove() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus dari galeri.')) return;
    const res = await deleteAlbum(album.id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function removeMedia(id: string) {
    if (!window.confirm('Hapus foto ini dari album?')) return;
    const res = await deleteGalleryMedia(id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function saveEdit() {
    if (!name.trim()) return;
    const res = await updateAlbum(album.id, name.trim(), desc.trim());
    if (res && res.error) window.alert(res.error);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="anim-fade-up bg-card border border-line rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-line">
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold">
                <Check className="h-3 w-3" />
                Simpan
              </button>
              <button onClick={() => { setEditing(false); setName(album.name || ''); setDesc(album.description || ''); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold">
                <X className="h-3 w-3" />
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink truncate">{album.name}</h2>
              <div className="flex items-center gap-2 text-xs text-mut">
                {album.description && <span className="truncate">{album.description}</span>}
                <span className="inline-flex items-center gap-1 shrink-0">
                  <ImageIcon className="h-3 w-3" />
                  {media.length} foto
                </span>
              </div>
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
                <>
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-mut hover:text-ink" aria-label="Edit album">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={remove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus album">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-mut py-4 text-center">Album kosong. Tambah foto pertama!</p>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <div key={m.id} className="relative mb-2 break-inside-avoid" style={{ animationDelay: i * 60 + 'ms' }}>
              <button
                onClick={() => setOpen(i)}
                className="block w-full rounded-xl overflow-hidden border border-line bg-card-2"
                aria-label="Lihat detail"
              >
                {m.media_type === 'video' ? (
                  <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto" />
                ) : (
                  <img
                    src={thumb(m.media_url, 600)}
                    data-full={m.media_url}
                    alt={m.caption || ''}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { const t = e.currentTarget as any; if (t.src !== t.dataset.full) t.src = t.dataset.full; }}
                    className="w-full h-auto"
                  />
                )}
              </button>
              {(isStaff || m.user_id === userId) && (
                <button
                  onClick={() => removeMedia(m.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500"
                  aria-label="Hapus foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} userId={userId} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
