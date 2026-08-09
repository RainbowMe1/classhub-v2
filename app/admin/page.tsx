import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import { getClassSettings } from '@/lib/auth/settings-actions';
import AppLayout from '@/components/layout/AppLayout';
import ClassSettingsForm from '@/components/admin/ClassSettingsForm';
import { Users, Newspaper, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const [{ count: memberCount }, { count: postCount }, settings] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    getClassSettings(),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-acc" />
          Panel Admin
        </h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-line rounded-2xl p-4">
            <Users className="h-5 w-5 text-acc mb-2" />
            <div className="text-xs text-mut">Total Anggota</div>
            <div className="text-2xl font-bold">{memberCount ?? 0}</div>
          </div>
          <div className="bg-card border border-line rounded-2xl p-4">
            <Newspaper className="h-5 w-5 text-[#fb923c] mb-2" />
            <div className="text-xs text-mut">Total Post</div>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
          </div>
        </div>
        <Link href="/admin/users" className="block p-4 rounded-2xl bg-acc text-acc-ink font-semibold hover:bg-acc-strong transition">
          Kelola Anggota → buat akun, ubah role, ban
        </Link>
        <ClassSettingsForm initial={settings} />
      </div>
    </AppLayout>
  );
}
