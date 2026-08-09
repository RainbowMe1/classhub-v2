'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { X, Loader2, Upload } from 'lucide-react';

export default function UploadModal({ albumId, userId, onClose }: { albumId: string; userId: string; onClose: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setErr('Pilih foto dulu.'); return; }
    setBusy(true);
    setErr('');
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setErr('Hanya gambar atau video.'); return; }
        if (f.size > 20 * 1024 * 1024) { setErr('Maksimal 20MB per file.'); return; }
        const id = crypto.randomUUID();
        const ext = f.name.split('.').pop() || 'jpg';
        const path = userId + '/' + id + '.' + ext;
        const { error: upErr } = await supabase.storage.from('gallery').upload(path, f, { upsert: true });
        if (upErr) { setErr('Upload gagal: ' + upErr.message); return; }
        const url = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl;
        const { error: dbErr } = await supabase.from('gallery_media').insert({
          album_id: albumId,
          user_id: userId,
          media_url: url,
          media_type: f.type.startsWith('video/') ? 'video' : 'image',
          caption: f.name,
        });
        if (dbErr) { setErr(dbErr.message); return; }
      }
      router.refresh();
      onClose();
    } catch {
      setErr('Gagal mengunggah.');
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card-2 rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Tambah Foto</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          ref={fileRef}
          className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Mengunggah...' : 'Unggah'}
        </button>
      </div>
    </div>
  );
}
