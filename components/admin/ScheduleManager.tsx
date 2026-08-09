'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSchedule, deleteSchedule } from '@/lib/auth/content-actions';
import { Trash2, Plus } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function ScheduleManager({ schedules }: { schedules: any[] }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await createSchedule(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus jadwal ini?')) return;
    const res = await deleteSchedule(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
        className="bg-card border border-line rounded-2xl p-4 grid md:grid-cols-5 gap-3"
      >
        <select name="day_of_week" className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50">
          {DAYS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
        <input name="start_time" type="time" required className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <input name="end_time" type="time" required className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <input name="subject" required placeholder="Mapel" className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <input name="room" placeholder="Ruang (opsional)" className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <button type="submit" disabled={busy} className="md:col-span-5 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {busy ? 'Menyimpan...' : 'Tambah Jadwal'}
        </button>
        {err && <div className="md:col-span-5 text-xs text-red-400">{err}</div>}
      </form>

      <div className="space-y-3">
        {DAYS.map((day, i) => {
          const items = schedules.filter((s) => s.day_of_week === i + 1);
          if (items.length === 0) return null;
          return (
            <div key={day}>
              <div className="text-xs text-mut uppercase tracking-wide mb-1">{day}</div>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-line">
                    <div className="text-sm font-bold text-acc min-w-[100px]">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1 text-sm text-ink">
                      {s.subject}
                      {s.room ? ' • Ruang ' + s.room : ''}
                    </div>
                    <button onClick={() => remove(s.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Hapus jadwal">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
