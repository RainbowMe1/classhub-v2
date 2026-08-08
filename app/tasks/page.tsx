import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import TaskCard from '@/components/tasks/TaskCard';
import CreateTaskForm from '@/components/tasks/CreateTaskForm';
import { ClipboardList } from 'lucide-react';

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';

  const [{ data: tasks }, { data: mySubs }, { data: allSubs }] = await Promise.all([
    supabase.from('tasks').select('*').order('deadline', { ascending: false }),
    supabase.from('task_submissions').select('*').eq('user_id', user.id),
    supabase.from('task_submissions').select('task_id'),
  ]);

  const mySubMap = new Map((mySubs ?? []).map((s) => [s.task_id, s]));
  const subCounts: Record<string, number> = {};
  for (const s of allSubs ?? []) subCounts[s.task_id] = (subCounts[s.task_id] ?? 0) + 1;

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tugas</h1>
          {isStaff && <CreateTaskForm />}
        </div>

        {(tasks?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada tugas.</p>
          </div>
        ) : (
          (tasks ?? []).map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              mySub={mySubMap.get(t.id) ?? null}
              subCount={subCounts[t.id] ?? 0}
              isStaff={isStaff}
              userId={user.id}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
