'use client';
import { useEffect, useState } from 'react';
import CheckInCard from './CheckInCard';
import { getCheckInHistory } from '@/lib/auth/checkin-actions';
import { Flame, CalendarCheck2, BarChart3 } from 'lucide-react';

const MOOD_EMOJI: Record<string, string> = { happy: '😊', excited: '🤩', neutral: '😐', tired: '😴', sad: '😢' };

export default function CheckInPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await getCheckInHistory();
        setRows(Array.isArray(r) ? r : []);
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({
      key: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
      label: d.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }),
    });
  }
  const byDate = new Map(rows.map((r) => [r.check_in_date, r]));
  const moodCounts = rows.reduce((acc, r) => {
    acc[r.mood] = (acc[r.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const total = rows.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CalendarCheck2 className="h-6 w-6 text-acc" />
        Check-in Harian
      </h1>

      <CheckInCard />

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          7 Hari Terakhir
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const r = byDate.get(d.key);
            return (
              <div
                key={d.key}
                className={'rounded-xl border p-2 text-center ' + (r ? 'bg-acc/10 border-acc/40' : 'bg-card-2 border-line')}
              >
                <div className="text-[10px] text-mut">{d.label}</div>
                <div className="text-lg mt-1">{r ? MOOD_EMOJI[r.mood] || '✅' : '–'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-acc" />
          Statistik Mood ({total} check-in)
        </div>
        {!loaded ? (
          <div className="text-xs text-mut">Memuat...</div>
        ) : total === 0 ? (
          <div className="text-xs text-mut">Belum ada riwayat. Mulai check-in hari ini!</div>
        ) : (
          <div className="space-y-2">
            {Object.keys(MOOD_EMOJI).map((k) => {
              const cnt = moodCounts[k] || 0;
              const pct = total ? Math.round((cnt / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <div className="w-8 text-center">{MOOD_EMOJI[k]}</div>
                  <div className="flex-1 h-2 rounded-full bg-card-2 overflow-hidden">
                    <div className="h-full bg-acc" style={{ width: pct + '%' }} />
                  </div>
                  <div className="w-20 text-right text-mut">{cnt}x ({pct}%)</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
