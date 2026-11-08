import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import PiketBoard from '@/components/piket/PiketBoard';
import { Brush } from 'lucide-react';
import { getPiketStatuses } from '@/lib/piket-data';
import { getJakartaWeekday } from '@/lib/piket-utils';
import PiketSetupNotice from '@/components/piket/PiketSetupNotice';

export default async function PiketPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';
  const [{ data: entries, error: entriesError }, { data: members, error: membersError }, submissions, ownSubmissions] = await Promise.all([
    supabase
      .from('piket_entries')
      .select('*, profiles(full_name, username, avatar_url, avatar_zoom, avatar_x, avatar_y)')
      .order('day_of_week')
      .order('created_at'),
    supabase.from('profiles').select('user_id, full_name').eq('is_banned', false).order('full_name'),
    getPiketStatuses(),
    isStaff ? Promise.resolve({ rows: [], setupRequired: false }) : getPiketStatuses(user.id),
  ]);

  if (entriesError) throw new Error('Gagal memuat jadwal piket: ' + entriesError.message);
  if (membersError) throw new Error('Gagal memuat anggota kelas: ' + membersError.message);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brush className="h-6 w-6 text-acc" />
          Jadwal Piket
        </h1>
        {submissions.setupRequired && <PiketSetupNotice />}
        <PiketBoard
          entries={entries ?? []}
          members={members ?? []}
          submissions={submissions.rows}
          ownSubmissions={ownSubmissions.rows}
          setupRequired={submissions.setupRequired}
          isStaff={isStaff}
          userId={user.id}
          studentName={user.profile.full_name}
          todayWeekday={getJakartaWeekday()}
        />
      </div>
    </AppLayout>
  );
}
