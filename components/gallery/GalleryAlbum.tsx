'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { updateAlbum, deleteAlbum, deleteMedia } from '@/lib/auth/gallery-actions';
import { Upload, Trash2, Pencil, X, Check } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff, myCount }: { album: any; userId: string; isStaff: boolean; myCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [edit, setEdit] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);
  const canAlbum = isStaff || album.created_by === userId;
  const canUpload = isStaff || myCount < 5;
  const hasMine = media.some((m: any) => m.user_id === userId);

  async function removeAlbum() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus.')) return;
    setErr('');
    const res = await deleteAlbum(album.id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function removeMedia(id: string) {
    if (!window.confirm('Hapus foto ini?')) return;
    setErr('');
    const res = await deleteMedia(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function rename(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await updateAlbum(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setShowRename(false);
      router.refresh();
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="bg-card border border-line rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{album.name}</div>
          <div className="text-xs text-mut">
            {album.description ? album.description + ' • ' : ''}
            {media.length} foto
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Tambah Foto
            </button>
          )}
          {(canAlbum || hasMine || isStaff) && (
            <button
              onClick={() => setEdit(!edit)}
              className={'p-2 rounded-lg ' + (edit ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink')}
              aria-label="Mode edit"
            >
              {edit ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!isStaff && <div className="text-[11px] text-mut">Upload kamu: {myCount}/5</div>}

      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      {edit && (
        <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs flex items-center justify-between gap-2 flex-wrap">
          Mode edit aktif — ikon hapus muncul di foto yang boleh kamu hapus.
          {canAlbum && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRename(!showRename)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-line text-ink border border-line text-xs font-semibold hover:bg-line-2"
              >
                <Pencil className="h-3.5 w-3.5" />
                Ganti Nama
              </button>
              <button
                onClick={removeAlbum}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Album
              </button>
            </div>
          )}
        </div>
      )}

      {edit && canAlbum && showRename && (
        <form
          onSubmit={(e) => { e.preventDefault(); rename(new FormData(e.currentTarget)); }}
          className="p-3 rounded-lg bg-card-2 border border-line space-y-2"
        >
          <input name="album_id" type="hidden" value={album.id} />
          <input name="name" defaultValue={album.name} required placeholder="Nama album" className={inputCls} />
          <input name="description" defaultValue={album.description || ''} placeholder="Deskripsi (opsional)" className={inputCls} />
          <div className="flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold hover:bg-acc-strong disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setShowRename(false)} className="px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2">
              Batal
            </button>
          </div>
        </form>
      )}

      {media.length === 0 ? (
        <div className="text-center py-8 text-mut text-sm">Album kosong. Tambah foto pertama!</div>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <div key={m.id} className="relative mb-2 w-full rounded-xl overflow-hidden border border-line bg-card-2 break-inside-avoid">
              <button onClick={() => setOpen(i)} className="block w-full" aria-label="Lihat detail">
                {m.media_type === 'video' ? (
                  <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto block" />
                ) : (
                  <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto block" />
                )}
              </button>
              {edit && (isStaff || m.user_id === userId) && (
                <button
                  onClick={() => removeMedia(m.id)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/70 text-red-400 hover:bg-red-500/20"
                  aria-label="Hapus foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
