import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ScheduleManager from '@/components/admin/ScheduleManager';
import AnnouncementManager from '@/components/admin/AnnouncementManager';
import { Calendar, Megaphone } from 'lucide-react';

export default async function AdminContentPage() {
  const user = await requireRole('teacher');
  const supabase = await createClient();
  const [{ data: schedules }, { data: announcements }] = await Promise.all([
    supabase.from('schedules').select('*').order('day_of_week').order('start_time'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
            <Calendar className="h-6 w-6 text-acc" />
            Jadwal Pelajaran
          </h1>
          <ScheduleManager schedules={schedules ?? []} />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
            <Megaphone className="h-6 w-6 text-[#fb923c]" />
            Pengumuman
          </h1>
          <AnnouncementManager announcements={announcements ?? []} />
        </div>
      </div>
    </AppLayout>
  );
}
