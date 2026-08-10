import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import PiketBoard from '@/components/piket/PiketBoard';
import { Brush } from 'lucide-react';

export default async function PiketPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: entries }, { data: members }] = await Promise.all([
    supabase
      .from('piket_entries')
      .select('*, profiles(full_name, username, avatar_url, avatar_zoom, avatar_x, avatar_y)')
      .order('day_of_week')
      .order('created_at'),
    supabase.from('profiles').select('user_id, full_name').eq('is_banned', false).order('full_name'),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brush className="h-6 w-6 text-acc" />
          Jadwal Piket
        </h1>
        <PiketBoard entries={entries ?? []} members={members ?? []} isStaff={user.profile.role !== 'student'} />
      </div>
    </AppLayout>
  );
}
