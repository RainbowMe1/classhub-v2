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
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{task.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="flex items-center gap-1 text-xs text-[#a3e635] shrink-0">
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

      {task.description && <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-gray-500">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-gray-300">
          <span className="text-[#a3e635] font-semibold">Feedback: </span>
          {mySub.feedback}
        </div>
      )}

      {!isStaff && !mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2a2a2a]"
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input
            type="file"
            name="file"
            required
            className="flex-1 min-w-[160px] text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-xs font-semibold disabled:opacity-50">
            <Upload className="h-3 w-3" />
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          <div className="w-full text-[10px] text-gray-500">Maksimal 50MB per file</div>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
        >
          <Users className="h-3 w-3" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
