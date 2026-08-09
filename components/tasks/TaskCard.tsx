'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/lib/auth/task-actions';
import SubmissionsSheet from './SubmissionsSheet';
import { Clock, CheckCircle2, AlertCircle, Upload, Users, Paperclip } from 'lucide-react';

export default function TaskCard({ task, mySub, subCount, isStaff, userId }: { task: any; mySub: any; subCount: number; isStaff: boolean; userId: string }) {
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
    <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">{task.title}</div>
          <div className="text-xs text-mut mt-0.5">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="flex items-center gap-1 text-xs text-acc shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            {mySub.status === 'graded' ? 'Nilai: ' + mySub.grade : mySub.status === 'late' ? 'Terlambat' : 'Masuk'}
          </span>
        ) : late ? (
          <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
            <AlertCircle className="h-4 w-4" />
            Lewat deadline
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[#fb923c] shrink-0">
            <Clock className="h-4 w-4" />
            Aktif
          </span>
        )}
      </div>

      {task.description && <p className="text-sm text-ink-soft whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-acc hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-mut">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-bg border border-line text-sm text-ink-soft">
          <span className="text-acc font-semibold">Feedback: </span>
          {mySub.feedback}
        </div>
      )}

      {!isStaff && !mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-line"
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input
            type="file"
            name="file"
            required
            className="flex-1 min-w-[160px] text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold disabled:opacity-50">
            <Upload className="h-3 w-3" />
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          <div className="w-full text-[10px] text-mut">Maksimal 50MB per file</div>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
        >
          <Users className="h-3 w-3" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
