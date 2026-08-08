import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { ClipboardList, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: tasks }, { data: subs }] = await Promise.all([
    supabase.from('tasks').select('*').order('deadline'),
    supabase.from('task_submissions').select('task_id, grade').eq('user_id', user.id),
  ]);

  const subMap = new Map((subs ?? []).map((s) => [s.task_id, s]));
  const now = new Date();

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Tugas</h1>
        {(tasks?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada tugas</p>
          </div>
        ) : (
          tasks?.map((t) => {
            const sub = subMap.get(t.id);
            const late = !sub && new Date(t.deadline) < now;
            return (
              <div key={t.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.subject}</div>
                    {t.description && <p className="text-sm text-gray-300 mt-2">{t.description}</p>}
                  </div>
                  {sub ? (
                    <span className="flex items-center gap-1 text-xs text-[#a3e635] shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      {sub.grade !== null ? 'Nilai: ' + sub.grade : 'Dikumpulkan'}
                    </span>
                  ) : late ? (
                    <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
                      <AlertCircle className="h-4 w-4" />
                      Terlambat
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#fb923c] shrink-0">
                      <Clock className="h-4 w-4" />
                      Belum
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  Deadline: {new Date(t.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
