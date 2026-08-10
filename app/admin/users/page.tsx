import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export default async function AdminUsersPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const { data: members } = await supabase.from('profiles').select('*').order('created_at');
  const me = (members ?? []).find((m: any) => m.user_id === user.id);
  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <AdminUsersClient
          members={members ?? []}
          currentUserId={user.id}
          currentIsOwner={!!me?.is_owner}
        />
      </div>
    </AppLayout>
  );
}
