import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import { getClassSettings } from '@/lib/auth/settings-actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, ClipboardList, Users, Megaphone } from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const s = await getClassSettings();
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
      {s?.bg_url && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ backgroundImage: 'url(' + s.bg_url + ')', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}
        />
      )}
      {s?.bg_url && <div className="fixed inset-0 pointer-events-none bg-bg/60" style={{ zIndex: 0 }} />}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-line bg-card/80 backdrop-blur p-5 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-mut">{s?.subtitle || 'Selamat datang'}</div>
          <h1 className="text-2xl md:text-3xl font-bold text-grad">{s?.class_name || 'ClassHub'}</h1>
          {s?.school_name && <div className="text-sm text-mut">{s.school_name}</div>}
          {(s?.teacher_name || s?.school_year) && (
            <div className="text-xs text-mut">
              {s.teacher_name ? 'Wali Kelas: ' + s.teacher_name : ''}
              {s.teacher_name && s.school_year ? ' • ' : ''}
              {s.school_year ? 'Tahun Ajaran ' + s.school_year : ''}
            </div>
          )}
        </section>

        <div>
          <div className="text-xs text-mut">{today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <h2 className="text-xl font-bold">Halo, {user.profile.full_name.split(' ')[0]} 👋</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((st) => (
            <div key={st.label} className="bg-card/80 backdrop-blur border border-line rounded-2xl p-4">
              <div className={'inline-flex p-2.5 rounded-xl mb-3 ' + st.bg}>
                <st.Icon className={'h-5 w-5 ' + st.color} />
              </div>
              <div className="text-xs text-mut">{st.label}</div>
              <div className="text-2xl font-bold">{st.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card/80 backdrop-blur border border-line rounded-2xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-acc" />
              Jadwal Hari Ini
            </h3>
            {(schedules?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-mut text-sm">Tidak ada jadwal hari ini 🎉</div>
            ) : (
              <div className="space-y-2">
                {schedules?.map((sc: any) => (
                  <div key={sc.id} className="flex items-center gap-3 p-3 rounded-xl bg-card-2 border border-line">
                    <div className="text-sm font-bold text-acc min-w-[90px]">
                      {sc.start_time.slice(0, 5)}–{sc.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1 text-sm">{sc.subject}</div>
                    {sc.room && <div className="text-xs text-mut">Ruang {sc.room}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card/80 backdrop-blur border border-line rounded-2xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-[#fb923c]" />
              Tugas Aktif
            </h3>
            {(tasks?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-mut text-sm">Tidak ada tugas aktif 🎉</div>
            ) : (
              <div className="space-y-2">
                {tasks?.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-xl bg-card-2 border border-line">
                    <div className="text-sm font-semibold">{t.title}</div>
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
          <div className="bg-card/80 backdrop-blur border border-line rounded-2xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-blue-400" />
              Pengumuman
            </h3>
            <div className="space-y-2">
              {announcements?.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl bg-card-2 border border-line border-l-2 border-l-acc">
                  <div className="text-sm font-semibold">{a.is_pinned ? '📌 ' : ''}{a.title}</div>
                  <p className="text-sm text-mut mt-1 whitespace-pre-wrap">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
