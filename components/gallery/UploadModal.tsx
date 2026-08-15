'use client';
import { useRef, useState } from 'react';
import { uploadMedia } from '@/lib/auth/gallery-actions';
import { X, Loader2 } from 'lucide-react';

export default function UploadModal({ albumId, onClose }: { albumId: string; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setErr('Pilih foto dulu.'); return; }
    setBusy(true);
    setErr('');
    let lastErr = '';
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('album_id', albumId);
      fd.append('file', f);
      const res = await uploadMedia(fd);
      if (res && res.error) { lastErr = res.error; break; }
    }
    setBusy(false);
    if (lastErr) setErr(lastErr);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Tambah Foto</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        <button onClick={upload} disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Mengunggah...' : 'Unggah'}
        </button>
      </div>
    </div>
  );
}
