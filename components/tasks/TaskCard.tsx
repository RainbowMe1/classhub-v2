'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/lib/auth/task-actions';
import SubmissionsSheet from './SubmissionsSheet';
import { Users, Paperclip } from 'lucide-react';

export default function TaskCard({ task, mySub, subCount, isStaff, userId }: any) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const late = !mySub && new Date(task.deadline) < new Date();

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const res = await submitTask(fd);
      if (res && res.error) setErr(res.error);
      else router.refresh();
    } catch (e: any) {
      setErr('Error: ' + (e && e.message ? e.message : 'gagal mengirim'));
    }
    setBusy(false);
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{task.title}</div>
          <div className="text-xs text-mut">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-acc/10 text-acc font-semibold">
            {mySub.status === 'graded' ? 'Nilai: ' + mySub.grade : mySub.status === 'late' ? 'Terlambat' : 'Dikumpulkan'}
          </span>
        ) : late ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 font-semibold">Lewat deadline</span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">Aktif</span>
        )}
      </div>

      {task.description && <p className="text-sm text-mut whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-acc hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-mut">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-card-2 border border-line text-sm">
          <span className="font-semibold text-acc">Feedback:</span> {mySub.feedback}
        </div>
      )}

      {!mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-line"
        >
          <input name="task_id" type="hidden" value={task.id} />
          <input
            name="file"
            type="file"
            required
            className="flex-1 text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
          />
          <button disabled={busy} className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold hover:bg-acc-strong disabled:opacity-50">
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
        >
          <Users className="h-3.5 w-3.5" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
