'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTask, deleteTask } from '@/lib/auth/task-actions';
import { Pencil, Trash2, X, ClipboardList } from 'lucide-react';

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = function (n: number) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export default function TaskManager({ tasks }: { tasks: any[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove(id: string, title: string) {
    if (!window.confirm('Hapus tugas "' + title + '"? Submission murid ikut terhapus dari tampilan.')) return;
    setBusy(true);
    const res = await deleteTask(id);
    setBusy(false);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await updateTask(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setEdit(null);
      router.refresh();
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="space-y-3">
      {tasks.length === 0 && (
        <div className="text-center py-16 text-mut">Belum ada tugas.</div>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="bg-card border border-line rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{t.title}</div>
              <div className="text-xs text-mut mt-0.5">{t.subject}</div>
              <div className="text-xs text-[#fb923c] mt-1">
                Deadline: {new Date(t.deadline).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {new Date(t.deadline) < new Date() ? ' • lewat' : ''}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setErr(''); setEdit(t); }} className="p-2 rounded-lg text-mut hover:text-ink hover:bg-line" aria-label="Edit tugas">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(t.id, t.title)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus tugas">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {edit && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setEdit(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-card border border-line rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-acc" />
                Edit Tugas
              </h3>
              <button onClick={() => setEdit(null)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
            <form
              onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.append('id', edit.id); save(fd); }}
              className="space-y-3"
            >
              <input name="title" defaultValue={edit.title} required placeholder="Judul tugas" className={inputCls} />
              <input name="subject" defaultValue={edit.subject} placeholder="Mapel" className={inputCls} />
              <textarea name="description" defaultValue={edit.description || ''} rows={3} placeholder="Deskripsi" className={inputCls + ' resize-none'} />
              <div>
                <div className="text-xs text-mut mb-1">Deadline (boleh diubah kapan pun)</div>
                <input name="deadline" type="datetime-local" defaultValue={toLocal(edit.deadline)} required className={inputCls} />
              </div>
              <div>
                <div className="text-xs text-mut mb-1">Ganti lampiran (opsional — kosongkan biar tetap)</div>
                <input name="attachment" type="file" className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEdit(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50">
                  Batal
                </button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
