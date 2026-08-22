'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { getCheckInStatus, checkIn } from '@/lib/auth/checkin-actions';
import { Flame, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const QUOTES = [
  'Sedikit demi sedikit, lama-lama menjadi bukit.',
  'Kesuksesan adalah jumlah dari usaha kecil yang diulang setiap hari.',
  'Jangan menunggu semangat; mulailah, maka semangat akan datang.',
  'Orang hebat bukan lahir dari kenyamanan, tapi dari tantangan.',
  'Mimpi tidak bekerja kecuali kamu yang bekerja.',
  'Gagal itu bumbu, bukan akhir cerita.',
  'Kelas kuat karena anggotanya saling menguat.',
  'Disiplin adalah jembatan antara tujuan dan pencapaian.',
  'Ilmu yang kamu tanam hari ini, kamu panen bertahun-tahun kemudian.',
  'Fokus pada progres, bukan kesempurnaan.',
  'Teman sebangku hari ini, teman berjuang selamanya.',
  'Setiap soal yang kamu pahami adalah satu langkah lebih dekat.',
  'Jadilah alasan seseorang tersenyum hari ini.',
  'Usaha tidak akan mengkhianati hasil.',
  'Hari baik memberi kebahagiaan, hari buruk memberi pelajaran.',
  'Kamu tidak harus hebat untuk memulai, tapi mulai untuk jadi hebat.',
  'Belajar bersama lebih menyenangkan daripada menang sendiri.',
  'Catat, pahami, ulangi — itulah rahasia juara.',
  'Kecil langkahnya, besar tujuannya.',
  'Satu jam belajar hari ini mengalahkan sepuluh jam menunda.',
  'Bersyukur membuat perjalanan terasa ringan.',
  'Tidak ada kata terlambat untuk memulai yang benar.',
  'Belajar hari ini, memimpin besok.',
  'Kamu lebih kuat dari alasanmu untuk menyerah.',
];

const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Senang' },
  { key: 'excited', emoji: '🤩', label: 'Semangat' },
  { key: 'neutral', emoji: '😐', label: 'Biasa' },
  { key: 'tired', emoji: '😴', label: 'Lelah' },
  { key: 'sad', emoji: '😢', label: 'Sedih' },
];

function quoteOfDay() {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return QUOTES[h % QUOTES.length];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export default function CheckInCard() {
  const pathname = usePathname();
  const [status, setStatus] = useState<{ today: any; streak: number } | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [mood, setMood] = useState('happy');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const s: any = await getCheckInStatus();
      if (s && s.error) {
        setErrMsg(s.error);
        setPhase('error');
        return;
      }
      setStatus(s);
      setPhase('ready');
    } catch (e: any) {
      setErrMsg(String((e && e.message) || e));
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (pathname === '/dashboard') load();
  }, [pathname, load]);

  if (!mounted || pathname !== '/dashboard') return null;

  async function doCheckIn() {
    setBusy(true);
    setErrMsg('');
    const res: any = await checkIn(mood);
    setBusy(false);
    if (res && res.error) {
      setErrMsg(res.error);
      return;
    }
    await load();
  }

  const todayMood = status && status.today ? MOODS.find((m) => m.key === status.today.mood) : null;

  return createPortal(
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-24 md:pb-8">
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{greeting()}! 👋</div>
          <div className="flex items-center gap-1 text-xs font-bold text-orange-400">
            <Flame className="h-4 w-4" />
            Streak: {status ? status.streak : 0} hari
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-card-2 border border-line">
          <Sparkles className="h-4 w-4 text-acc shrink-0 mt-0.5" />
          <p className="text-sm text-mut italic">"{quoteOfDay()}"</p>
        </div>

        {phase === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-mut">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat check-in...
          </div>
        )}

        {phase === 'error' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Check-in belum bisa dipakai
            </div>
            <div>{errMsg}</div>
            <div className="text-red-300/80">Kalau pesannya "relation check_ins does not exist", artinya SQL tabel check_ins belum dijalanin di Supabase.</div>
          </div>
        )}

        {phase === 'ready' && status && (status.today ? (
          <div className="flex items-center gap-2 text-sm text-acc">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Kamu udah check-in hari ini dengan mood {todayMood ? todayMood.emoji : '😊'} — sampai jumpa besok!
          </div>
        ) : (
          <>
            {errMsg && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{errMsg}</div>}
            <div className="text-xs text-mut">Mood kamu hari ini?</div>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMood(m.key)}
                  className={
                    'flex-1 py-2 rounded-xl border text-center transition ' +
                    (mood === m.key ? 'bg-acc/10 border-acc/50' : 'bg-card-2 border-line hover:border-acc/30')
                  }
                  aria-label={m.label}
                >
                  <div className="text-xl">{m.emoji}</div>
                  <div className="text-[10px] text-mut mt-0.5">{m.label}</div>
                </button>
              ))}
            </div>
            <button
              onClick={doCheckIn}
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Check-in Sekarang
            </button>
          </>
        ))}
      </div>
    </div>,
    document.body
  );
}