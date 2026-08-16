import Link from 'next/link';
import { getClassSettings } from '@/lib/auth/settings-actions';
import { Lock, LogIn, Newspaper, MessageCircle, ClipboardList, Image as ImageIcon, Music, Bot, Calendar, Brush } from 'lucide-react';

const FEATURES = [
  { icon: Newspaper, label: 'Feed Kelas' },
  { icon: MessageCircle, label: 'Chat' },
  { icon: ClipboardList, label: 'Tugas' },
  { icon: Calendar, label: 'Jadwal' },
  { icon: Brush, label: 'Piket' },
  { icon: ImageIcon, label: 'Galeri' },
  { icon: Music, label: 'Musik' },
  { icon: Bot, label: 'AI Kelas' },
];

export default async function GuestPage() {
  const s = await getClassSettings();
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-acc/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 h-16">
        <div className="flex items-center gap-3">
          {s?.logo_url && <img src={s.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover border border-line" />}
          <div className="font-black text-grad">{s?.class_name || 'ClassHub'}</div>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong"
        >
          <LogIn className="h-4 w-4" />
          Masuk
        </Link>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-black">
            Intip <span className="text-grad">{s?.class_name || 'ClassHub'}</span>
          </h1>
          <p className="text-sm text-mut">Kamu masuk sebagai tamu. Semua konten kelas terkunci — login buat ikut di dalamnya.</p>
        </div>

        <div className="relative">
          <div className="grid md:grid-cols-2 gap-3 blur-[6px] opacity-50 select-none pointer-events-none" aria-hidden="true">
            <div className="bg-card border border-line rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-line-2" />
                <div className="space-y-1">
                  <div className="h-3 w-24 rounded bg-line-2" />
                  <div className="h-2 w-16 rounded bg-line-2" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-line-2" />
              <div className="h-3 w-3/4 rounded bg-line-2" />
              <div className="h-24 w-full rounded-xl bg-line-2" />
            </div>
            <div className="bg-card border border-line rounded-2xl p-4 space-y-2">
              <div className="h-3 w-32 rounded bg-line-2" />
              <div className="h-20 w-full rounded-xl bg-line-2" />
              <div className="h-3 w-24 rounded bg-line-2" />
              <div className="h-3 w-40 rounded bg-line-2" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-card/90 backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 text-center space-y-3 max-w-sm shadow-2xl">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-acc/10 border border-acc/30 flex items-center justify-center">
                <Lock className="h-6 w-6 text-acc" />
              </div>
              <h2 className="text-lg font-bold text-ink">Anda harus login terlebih dahulu</h2>
              <p className="text-sm text-mut">
                Konten kelas ini privat buat anggota {s?.class_name || 'kelas'}. Minta akun ke admin kelas, lalu masuk buat lihat feed, tugas, galeri, dan lainnya.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong"
              >
                <LogIn className="h-4 w-4" />
                Login Sekarang
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEATURES.map((f) => (
            <div key={f.label} className="relative bg-card border border-line rounded-2xl p-4 text-center">
              <f.icon className="h-6 w-6 mx-auto text-mut" />
              <div className="text-xs font-semibold mt-2 text-mut">{f.label}</div>
              <div className="absolute top-2 right-2 p-1 rounded-md bg-line text-mut">
                <Lock className="h-3 w-3" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
