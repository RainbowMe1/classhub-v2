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
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-white">Identitas Kelas</h2>
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      {saved && <div className="p-2 rounded-lg bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635] text-sm">Tersimpan ✓ — buka halaman lain / refresh buat lihat sidebar berubah.</div>}
      <input
        name="class_name"
        defaultValue={initial?.class_name || ''}
        required
        placeholder="Nama kelas (mis. XII SAINSTECH 2)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="subtitle"
        defaultValue={initial?.subtitle || ''}
        placeholder="Subtitle (mis. nama sekolah)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="logo"
        type="file"
        accept="image/*"
        className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
      />
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
