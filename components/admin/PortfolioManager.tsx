'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAbout, addTeacher, deleteTeacher, addAchievement, deleteAchievement, addJourney, deleteJourney } from '@/lib/auth/portfolio-actions';
import { Trash2, Save } from 'lucide-react';

export default function PortfolioManager({ about, teachers, achievements, journey }: { about: string; teachers: any[]; achievements: any[]; journey: any[] }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function run(fn: () => Promise<any>, okMsg: string) {
    setErr('');
    setMsg('');
    const res = await fn();
    if (res && res.error) setErr(res.error);
    else { setMsg(okMsg); router.refresh(); }
  }

  const inputCls = 'px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';
  const btnCls = 'px-3 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong';

  return (
    <div className="space-y-6">
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
      {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}

      <form
        onSubmit={(e) => { e.preventDefault(); run(() => saveAbout(new FormData(e.currentTarget)), 'Tentang kelas tersimpan ✓'); }}
        className="bg-card border border-line rounded-2xl p-4 space-y-3"
      >
        <h2 className="font-semibold text-ink">Tentang Kelas</h2>
        <textarea name="about" rows={4} defaultValue={about} placeholder="Ceritakan tentang kelas kalian..." className={inputCls + ' w-full resize-none'} />
        <button type="submit" className={btnCls + ' flex items-center gap-2'}><Save className="h-4 w-4" />Simpan</button>
      </form>

      <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-ink">Guru & Wali Kelas</h2>
        <form onSubmit={(e) => { e.preventDefault(); run(() => addTeacher(new FormData(e.currentTarget)), 'Guru ditambahkan ✓'); }} className="grid md:grid-cols-3 gap-2">
          <input name="name" required placeholder="Nama guru" className={inputCls} />
          <input name="role" placeholder="Jabatan (mis. Wali Kelas)" className={inputCls} />
          <button type="submit" className={btnCls}>Tambah</button>
        </form>
        <div className="space-y-2">
          {teachers.map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-card-2 border border-line">
              <div className="flex-1 text-sm text-ink">{t.name}{t.role ? ' • ' + t.role : ''}</div>
              <button onClick={() => run(() => deleteTeacher(t.id), 'Guru dihapus ✓')} className="p-1.5 text-red-400" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-ink">Prestasi</h2>
        <form onSubmit={(e) => { e.preventDefault(); run(() => addAchievement(new FormData(e.currentTarget)), 'Prestasi ditambahkan ✓'); }} className="grid md:grid-cols-4 gap-2">
          <input name="title" required placeholder="Judul prestasi" className={inputCls + ' md:col-span-2'} />
          <input name="year" placeholder="Tahun" className={inputCls} />
          <input name="level" placeholder="Level (mis. Provinsi)" className={inputCls} />
          <button type="submit" className={btnCls + ' md:col-span-4'}>Tambah</button>
        </form>
        <div className="space-y-2">
          {achievements.map((a) => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-card-2 border border-line">
              <div className="flex-1 text-sm text-ink">{a.title}{a.year ? ' (' + a.year + ')' : ''}{a.level ? ' • ' + a.level : ''}</div>
              <button onClick={() => run(() => deleteAchievement(a.id), 'Prestasi dihapus ✓')} className="p-1.5 text-red-400" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-ink">Perjalanan Kelas</h2>
        <form onSubmit={(e) => { e.preventDefault(); run(() => addJourney(new FormData(e.currentTarget)), 'Perjalanan ditambahkan ✓'); }} className="grid md:grid-cols-3 gap-2">
          <input name="period" required placeholder="Periode (mis. 2025)" className={inputCls} />
          <input name="title" required placeholder="Judul momen" className={inputCls} />
          <input name="story" placeholder="Cerita singkat" className={inputCls} />
          <button type="submit" className={btnCls + ' md:col-span-3'}>Tambah</button>
        </form>
        <div className="space-y-2">
          {journey.map((j) => (
            <div key={j.id} className="flex items-center gap-2 p-2 rounded-lg bg-card-2 border border-line">
              <div className="flex-1 text-sm text-ink"><span className="text-acc font-semibold">{j.period}</span> — {j.title}{j.story ? ' • ' + j.story : ''}</div>
              <button onClick={() => run(() => deleteJourney(j.id), 'Perjalanan dihapus ✓')} className="p-1.5 text-red-400" aria-label="Hapus"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
