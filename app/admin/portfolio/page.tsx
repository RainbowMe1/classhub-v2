import { requireRole } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import PortfolioManager from '@/components/admin/PortfolioManager';
import { Award } from 'lucide-react';

export default async function AdminPortfolioPage() {
  const user = await requireRole('teacher');
  const admin = createAdminClient();
  const [{ data: settings }, { data: teachers }, { data: achievements }, { data: journey }] = await Promise.all([
    admin.from('class_settings').select('*').limit(1),
    admin.from('class_teachers').select('*').order('created_at'),
    admin.from('class_achievements').select('*').order('created_at'),
    admin.from('class_journey').select('*').order('created_at'),
  ]);
  const s = settings && settings.length > 0 ? settings[0] : null;

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-acc" />
          Portofolio Kelas
        </h1>
        <PortfolioManager
          about={s?.about || ''}
          teachers={teachers ?? []}
          achievements={achievements ?? []}
          journey={journey ?? []}
        />
      </div>
    </AppLayout>
  );
}
