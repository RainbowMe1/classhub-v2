'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gradeSubmission } from '@/lib/auth/task-actions';
import { X, FileText } from 'lucide-react';

function GradeForm({ sub, onDone }: { sub: any; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    setSaved(false);
    try {
      const res = await gradeSubmission(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setSaved(true);
        onDone();
      }
    } catch (e: any) {
      console.error('gradeSubmission error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="flex flex-wrap items-center gap-2 mt-2"
    >
      <input type="hidden" name="submission_id" value={sub.id} />
      <input
        type="number"
        name="grade"
        min={0}
        max={100}
        required
        defaultValue={sub.grade ?? ''}
        placeholder="0-100"
        className="w-20 px-2 py-1.5 rounded-lg bg-card-2 border border-line text-xs text-ink focus:outline-none focus:border-acc/50"
      />
      <input
        type="text"
        name="feedback"
        defaultValue={sub.feedback ?? ''}
        placeholder="Feedback..."
        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg bg-card-2 border border-line text-xs text-ink focus:outline-none focus:border-acc/50"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold disabled:opacity-50"
      >
        {busy ? '...' : 'Simpan Nilai'}
      </button>
      {saved && <span className="text-acc text-xs">Tersimpan ✓</span>}
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </form>
  );
}

export default function SubmissionsSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const supabase = createClient();
  const [subs, setSubs] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from('task_submissions')
      .select('*, profiles(full_name, username)')
      .eq('task_id', taskId)
      .order('submitted_at');
    setSubs(data ?? []);
  }

  useEffect(() => {
    load();
  }, [taskId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-card-2 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-semibold text-ink">Submission ({subs.length})</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {subs.length === 0 ? (
            <p className="text-center text-mut text-sm py-8">Belum ada yang mengumpulkan.</p>
          ) : (
            subs.map((s) => (
              <div key={s.id} className="bg-card border border-line rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{s.profiles?.full_name}</div>
                    <div className="text-xs text-mut">@{s.profiles?.username}</div>
                  </div>
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-acc hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {s.file_name}
                  </a>
                </div>
                <div className="text-xs text-mut mt-1">
                  Status: {s.status === 'graded' ? 'Dinilai (' + s.grade + ')' : s.status === 'late' ? 'Terlambat' : 'Masuk'}
                </div>
                <GradeForm sub={s} onDone={load} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
