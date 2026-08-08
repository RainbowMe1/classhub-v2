import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: schedules } = await supabase.from('schedules').select('*').order('day_of_week').order('start_time');

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Jadwal Pelajaran</h1>
        {(schedules?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada jadwal</p>
          </div>
        ) : (
          DAYS.map((day, i) => {
            const items = (schedules ?? []).filter((s) => s.day_of_week === i + 1);
            if (items.length === 0) return null;
            return (
              <div key={day}>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</h2>
                <div className="space-y-2">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#161616] border border-[#2a2a2a]">
                      <div className="text-center min-w-[60px]">
                        <div className="text-sm font-bold text-[#a3e635]">{s.start_time.slice(0, 5)}</div>
                        <div className="text-xs text-gray-500">{s.end_time.slice(0, 5)}</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{s.subject}</div>
                        {s.room && <div className="text-xs text-gray-400">Ruang {s.room}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
