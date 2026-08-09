import { requireRole } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import ModerationList from '@/components/admin/ModerationList';

export default async function ModerationPage() {
  const user = await requireRole('teacher');
  const admin = createAdminClient();
  const { data: hiddenPosts } = await admin
    .from('posts')
    .select('*, profiles(full_name, username)')
    .eq('is_hidden', true)
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <ModerationList posts={hiddenPosts ?? []} />
    </AppLayout>
  );
}
