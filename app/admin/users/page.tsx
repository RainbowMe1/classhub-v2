import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export default async function AdminUsersPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const { data: members } = await supabase.from('profiles').select('*').order('created_at');
  return (
    <AppLayout profile={user.profile}>
      <AdminUsersClient members={(members ?? []) as any} currentUserId={user.id} />
    </AppLayout>
  );
}
