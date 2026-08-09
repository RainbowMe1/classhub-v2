'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClassSettings } from '@/lib/auth/settings-actions';

export default function ClassSettingsForm({ initial }: { initial: any }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    setSaved(false);
    try {
      const res = await saveClassSettings(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (e: any) {
      console.error('saveClassSettings error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="bg-card border border-line rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-ink">Identitas Kelas</h2>
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      {saved && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">Tersimpan ✓ — buka halaman lain / refresh buat lihat sidebar berubah.</div>}
      <input
        name="class_name"
        defaultValue={initial?.class_name || ''}
        required
        placeholder="Nama kelas (mis. XII SAINSTECH 2)"
        className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
      />
      <input
        name="subtitle"
        defaultValue={initial?.subtitle || ''}
        placeholder="Subtitle (mis. nama sekolah)"
        className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
      />
      <input
        name="logo"
        type="file"
        accept="image/*"
        className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
      />
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
