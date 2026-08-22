'use client';
import { useCallback, useEffect, useState } from 'react';
import CheckInCard from './CheckInCard';
import { getCheckInHistory } from '@/lib/auth/checkin-actions';
import { Flame, CalendarCheck2, BarChart3, Trophy, History, CheckCircle2 } from 'lucide-react';

const MOOD_EMOJI: Record<string, string> = { happy: '😊', excited: '🤩', neutral: '😐', tired: '😴', sad: '😢' };
const MOOD_LABEL: Record<string, string> = { happy: 'Senang', excited: 'Semangat', neutral: 'Biasa', tired: 'Lelah', sad: 'Sedih' };

function dayStr(offset: number) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function shiftDay(d: string, delta: number) {
  const dt = new Date(d + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export default function CheckInPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await getCheckInHistory();
      setRows(Array.isArray(r) ? r : []);
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('checkin-done', h);
    return () => window.removeEventListener('checkin-done', h);
  }, [load]);

  const set = new Set(rows.map((r) => r.check_in_date));
  const dates = Array.from(set).sort();

  let longest = 0;
  for (const d of dates) {
    if (!set.has(shiftDay(d, -1))) {
      let len = 1;
      let cur = d;
      while (set.has(shiftDay(cur, 1))) { cur = shiftDay(cur, 1); len++; }
      longest = Math.max(longest, len);
    }
  }

  let current = 0;
  for (let i = set.has(dayStr(0)) ? 0 : -1; ; i--) {
    if (set.has(dayStr(i))) current++;
    else break;
  }

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

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <Flame className="h-5 w-5 mx-auto text-orange-400" />
          <div className="text-2xl font-black mt-1">{current}</div>
          <div className="text-[10px] text-mut mt-0.5">Streak Saat Ini</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <Trophy className="h-5 w-5 mx-auto text-yellow-400" />
          <div className="text-2xl font-black mt-1">{longest}</div>
          <div className="text-[10px] text-mut mt-0.5">Streak Terpanjang</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-acc" />
          <div className="text-2xl font-black mt-1">{total}</div>
          <div className="text-[10px] text-mut mt-0.5">Total Check-in</div>
        </div>
      </div>

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

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-acc" />
          Riwayat Terakhir
        </div>
        {!loaded ? (
          <div className="text-xs text-mut">Memuat...</div>
        ) : total === 0 ? (
          <div className="text-xs text-mut">Riwayat kosong.</div>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-xl bg-card-2 border border-line text-sm">
                <div className="text-xl">{MOOD_EMOJI[r.mood] || '✅'}</div>
                <div className="flex-1">
                  <div className="font-semibold">{MOOD_LABEL[r.mood] || 'Check-in'}</div>
                  <div className="text-[11px] text-mut">
                    {new Date(r.check_in_date + 'T12:00:00Z').toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Asia/Jakarta',
                    })}
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-acc" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
