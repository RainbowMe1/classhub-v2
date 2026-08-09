'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAlbum } from '@/lib/auth/gallery-actions';
import { Plus, X } from 'lucide-react';

export default function CreateAlbumForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const res = await createAlbum(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setShow(false);
        router.refresh();
      }
    } catch (e: any) {
      console.error('createAlbum error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal membuat album'));
    }
    setBusy(false);
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong"
      >
        <Plus className="h-4 w-4" />
        Album Baru
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
      className="bg-card border border-line rounded-2xl p-4 space-y-3 w-full"
    >
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      <input
        name="name"
        required
        placeholder="Nama album (mis. Kegiatan Kelas)"
        className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
      />
      <input
        name="description"
        placeholder="Deskripsi (opsional)"
        className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
          {busy ? 'Membuat...' : 'Buat Album'}
        </button>
        <button type="button" onClick={() => setShow(false)} className="px-3 py-2 rounded-lg bg-line text-ink text-sm" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
