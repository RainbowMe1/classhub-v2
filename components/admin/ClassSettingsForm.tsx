'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClassSettings } from '@/lib/auth/settings-actions';
import { compressImage } from '@/lib/compress';

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
      const out = new FormData();
      const keys = ['class_name', 'subtitle', 'teacher_name', 'school_year'];
      for (const k of keys) {
        const v = fd.get(k);
        if (v) out.append(k, v as string);
      }
      if (fd.get('remove_bg') === 'on') out.append('remove_bg', 'on');
      if (fd.get('remove_bg_mobile') === 'on') out.append('remove_bg_mobile', 'on');
      const bg = fd.get('bg') as File | null;
      if (bg && bg.size > 0) out.append('bg', await compressImage(bg, 1600, 0.8));
      const bgm = fd.get('bg_mobile') as File | null;
      if (bgm && bgm.size > 0) out.append('bg_mobile', await compressImage(bgm, 1080, 0.8));
      const logo = fd.get('logo') as File | null;
      if (logo && logo.size > 0) out.append('logo', await compressImage(logo, 512, 0.85));
      const res = await saveClassSettings(out);
      if (res && res.error) setErr(res.error);
      else { setSaved(true); router.refresh(); }
    } catch (e: any) {
      console.error('saveClassSettings error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';
  const fileCls = 'w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="bg-card border border-line rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-ink">Identitas Kelas</h2>
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      {saved && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">Tersimpan ✓</div>}
      <input name="class_name" defaultValue={initial?.class_name || ''} required placeholder="Nama kelas" className={inputCls} />
      <input name="subtitle" defaultValue={initial?.subtitle || ''} placeholder="Subtitle (mis. MAN 4 Bogor)" className={inputCls} />
      <div className="grid md:grid-cols-2 gap-3">
        <input name="teacher_name" defaultValue={initial?.teacher_name || ''} placeholder="Wali kelas" className={inputCls} />
        <input name="school_year" defaultValue={initial?.school_year || ''} placeholder="Tahun ajaran" className={inputCls} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-mut mb-1">Logo kelas (ikon aplikasi)</div>
          <input name="logo" type="file" accept="image/*" className={fileCls} />
        </div>
        <div>
          <div className="text-xs text-mut mb-1">Background PC (lebar)</div>
          <input name="bg" type="file" accept="image/*" className={fileCls} />
        </div>
      </div>
      <div>
        <div className="text-xs text-mut mb-1">Background HP (potret, pakai gambar beda)</div>
        <input name="bg_mobile" type="file" accept="image/*" className={fileCls} />
      </div>
      <div className="flex flex-wrap gap-4">
        {initial?.bg_url && (
          <label className="flex items-center gap-2 text-sm text-mut">
            <input name="remove_bg" type="checkbox" className="accent-acc" />
            Hapus background PC
          </label>
        )}
        {initial?.bg_url_mobile && (
          <label className="flex items-center gap-2 text-sm text-mut">
            <input name="remove_bg_mobile" type="checkbox" className="accent-acc" />
            Hapus background HP
          </label>
        )}
      </div>
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
