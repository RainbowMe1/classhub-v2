import { requireRole } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import TaskManager from '@/components/admin/TaskManager';
import { ClipboardList } from 'lucide-react';

export default async function AdminTasksPage() {
  const user = await requireRole('teacher');
  const admin = createAdminClient();
  const { data: tasks } = await admin.from('tasks').select('*').order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-acc" />
          Kelola Tugas
        </h1>
        <p className="text-sm text-mut">Edit judul, deskripsi, deadline, atau lampiran, dan hapus tugas kapan pun — deadline tidak mengunci akses admin.</p>
        <TaskManager tasks={tasks ?? []} />
      </div>
    </AppLayout>
  );
}
