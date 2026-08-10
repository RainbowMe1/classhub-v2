import { requireRole } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import AdminPostManager from '@/components/admin/AdminPostManager';
import { Shield } from 'lucide-react';

export default async function AdminPostsPage() {
  const user = await requireRole('teacher');
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from('posts')
    .select('*, profiles(full_name, username, avatar_url, avatar_zoom, avatar_x, avatar_y)')
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-acc" />
          Kelola Semua Postingan
        </h1>
        <p className="text-sm text-mut">Sembunyikan atau hapus postingan anggota yang melanggar aturan.</p>
        <AdminPostManager posts={posts ?? []} isAdmin={user.profile.role === 'admin'} />
      </div>
    </AppLayout>
  );
}
