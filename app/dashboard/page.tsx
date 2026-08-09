import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, ClipboardList, Users, Megaphone } from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

  const [{ data: schedules }, { data: tasks }, { data: announcements }, { count: memberCount }] = await Promise.all([
    supabase.from('schedules').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
    supabase.from('tasks').select('*').eq('status', 'active').order('deadline').limit(5),
    supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', false),
  ]);

  const stats = [
    { label: 'Jadwal Hari Ini', value: String(schedules?.length ?? 0), color: 'text-acc', bg: 'bg-acc/10', Icon: Calendar },
    { label: 'Tugas Aktif', value: String(tasks?.length ?? 0), color: 'text-[#fb923c]', bg: 'bg-[#fb923c]/10', Icon: ClipboardList },
    { label: 'Pengumuman', value: String(announcements?.length ?? 0), color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: Megaphone },
    { label: 'Anggota', value: String(memberCount ?? 0), color: 'text-warn', bg: 'bg-warn/10', Icon: Users },
  ];

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="text-sm text-mut">
            {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Halo, {user.profile.full_name.split(' ')[0]} 👋
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-line rounded-2xl p-4">
              <div className={'h-10 w-10 rounded-xl flex items-center justify-center mb-3 ' + s.bg}>
                <s.Icon className={'h-5 w-5 ' + s.color} />
              </div>
              <div className="text-xs text-mut">{s.label}</div>
              <div className="text-2xl font-bold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-line rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-acc" />
              Jadwal Hari Ini
            </h2>
            {(schedules?.length ?? 0) === 0 ? (
              <p className="text-mut text-sm text-center py-8">Tidak ada jadwal hari ini 🎉</p>
            ) : (
              <div className="space-y-2">
                {schedules?.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-line">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-bold text-acc">{s.start_time.slice(0, 5)}</div>
                      <div className="text-xs text-mut">{s.end_time.slice(0, 5)}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{s.subject}</div>
                      {s.room && <div className="text-xs text-mut">Ruang {s.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-line rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#fb923c]" />
              Tugas Aktif
            </h2>
            {(tasks?.length ?? 0) === 0 ? (
              <p className="text-mut text-sm text-center py-8">Tidak ada tugas aktif 🎉</p>
            ) : (
              <div className="space-y-2">
                {tasks?.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-bg border border-line">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-mut">{t.subject}</div>
                    <div className="text-xs text-[#fb923c] mt-1">
                      Deadline: {new Date(t.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {(announcements?.length ?? 0) > 0 && (
          <div className="bg-card border border-line rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-400" />
              Pengumuman
            </h2>
            <div className="space-y-3">
              {announcements?.map((a) => (
                <div key={a.id} className={'p-4 rounded-xl bg-bg border border-line ' + (a.is_pinned ? 'border-l-2 border-l-[#a3e635]' : '')}>
                  <div className="font-semibold text-sm">{a.is_pinned ? '📌 ' : ''}{a.title}</div>
                  <p className="text-sm text-ink-soft mt-1 whitespace-pre-wrap">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
