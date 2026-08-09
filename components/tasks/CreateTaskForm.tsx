'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/lib/auth/task-actions';
import { Plus, X } from 'lucide-react';

export default function CreateTaskForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await createTask(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else { setShow(false); router.refresh(); }
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong"
      >
        <Plus className="h-4 w-4" />
        Buat Tugas
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
      className="bg-card border border-line rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Tugas Baru</h2>
        <button type="button" onClick={() => setShow(false)} className="text-mut hover:text-ink" aria-label="Tutup">
          <X className="h-5 w-5" />
        </button>
      </div>
      {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-mut mb-1">Judul</label>
          <input name="title" required className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" placeholder="Tugas Bab 6" />
        </div>
        <div>
          <label className="block text-xs text-mut mb-1">Mapel</label>
          <input name="subject" className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" placeholder="Matematika" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-mut mb-1">Deskripsi</label>
        <textarea name="description" rows={3} className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50 resize-none" placeholder="Instruksi tugas..." />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-mut mb-1">Deadline</label>
          <input name="deadline" type="datetime-local" required className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        </div>
        <div>
          <label className="block text-xs text-mut mb-1">Lampiran (opsional)</label>
          <input name="attachment" type="file" className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        </div>
      </div>
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
        {busy ? 'Membuat...' : 'Terbitkan Tugas'}
      </button>
    </form>
  );
}
