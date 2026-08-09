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
      if (res && res.error) setErr(res.error);
      else { setSaved(true); router.refresh(); }
    } catch (e: any) {
      console.error('saveClassSettings error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="bg-card border border-line rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-ink">Identitas Kelas</h2>
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      {saved && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">Tersimpan ✓</div>}
      <input name="class_name" defaultValue={initial?.class_name || ''} required placeholder="Nama kelas" className={inputCls} />
      <input name="subtitle" defaultValue={initial?.subtitle || ''} placeholder="Subtitle" className={inputCls} />
      <div className="grid md:grid-cols-2 gap-3">
        <input name="teacher_name" defaultValue={initial?.teacher_name || ''} placeholder="Wali kelas (mis. Budi, S.Pd.)" className={inputCls} />
        <input name="school_year" defaultValue={initial?.school_year || ''} placeholder="Tahun ajaran (mis. 2025/2026)" className={inputCls} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-mut mb-1">Logo kelas</div>
          <input name="logo" type="file" accept="image/*" className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        </div>
        <div>
          <div className="text-xs text-mut mb-1">Background Home (PNG)</div>
          <input name="bg" type="file" accept="image/*" className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        </div>
      </div>
      {initial?.bg_url && (
        <label className="flex items-center gap-2 text-sm text-mut">
          <input name="remove_bg" type="checkbox" className="accent-acc" />
          Hapus background saat ini
        </label>
      )}
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
