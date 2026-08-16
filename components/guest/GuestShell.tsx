'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, ClipboardList, Calendar, Image as ImageIcon, Music, Bot, Globe, Lock, LogIn, Brush, ArrowRight } from 'lucide-react';

const LOCKED = [
  { icon: Home, label: 'Home' },
  { icon: Newspaper, label: 'Feed' },
  { icon: MessageCircle, label: 'Chat' },
  { icon: ClipboardList, label: 'Tugas' },
  { icon: Brush, label: 'Piket' },
  { icon: Calendar, label: 'Jadwal' },
  { icon: ImageIcon, label: 'Galeri' },
  { icon: Music, label: 'Musik' },
  { icon: Bot, label: 'AI' },
];

export default function GuestShell({ settings }: { settings: any }) {
  const [warn, setWarn] = useState<string | null>(null);

  return (
    <div className="min-h-screen relative">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20 border-r border-line glass">
        <div className="p-6 border-b border-line flex items-center gap-3">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-line" />
          ) : null}
          <div>
            <div className="font-black text-grad">{settings?.class_name || 'ClassHub'}</div>
            <div className="text-[10px] text-mut">Mode Tamu</div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {LOCKED.map((item) => (
            <button
              key={item.label}
              onClick={() => setWarn(item.label)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-mut hover:bg-line hover:text-ink transition"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              <Lock className="h-3.5 w-3.5 ml-auto" />
            </button>
          ))}
          <Link href="/portfolio" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-acc bg-acc/10">
            <Globe className="h-5 w-5" />
            Portofolio
          </Link>
        </nav>
        <div className="p-4 border-t border-line">
          <Link href="/login" className="w-full py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold flex items-center justify-center gap-2">
            <LogIn className="h-4 w-4" />
            Masuk
          </Link>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 glass border-b border-line">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover border border-line" />}
            <span className="font-black text-grad">{settings?.class_name || 'ClassHub'}</span>
          </div>
          <Link href="/login" className="px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-bold">
            Masuk
          </Link>
        </div>
      </header>

      <div className="md:pl-64">
        <main className="pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-2xl md:text-4xl font-black">
                Selamat datang di <span className="text-grad">{settings?.class_name || 'ClassHub'}</span>
              </h1>
              <p className="text-sm text-mut max-w-xl mx-auto">
                Kamu masuk sebagai tamu. Jelajahi portofolio kelas secara bebas — fitur lainnya terbuka buat anggota yang login.
              </p>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold hover:bg-acc-strong"
              >
                <Globe className="h-4 w-4" />
                Lihat Portofolio Kelas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LOCKED.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setWarn(f.label)}
                  className="relative bg-card border border-line rounded-2xl p-4 text-center hover:border-acc/30 transition"
                >
                  <f.icon className="h-6 w-6 mx-auto text-mut" />
                  <div className="text-xs font-semibold mt-2 text-mut">{f.label}</div>
                  <div className="absolute top-2 right-2 p-1 rounded-md bg-line text-mut">
                    <Lock className="h-3 w-3" />
                  </div>
                </button>
              ))}
              <Link href="/portfolio" className="relative bg-acc/10 border border-acc/30 rounded-2xl p-4 text-center hover:border-acc/60 transition">
                <Globe className="h-6 w-6 mx-auto text-acc" />
                <div className="text-xs font-semibold mt-2 text-acc">Portofolio</div>
                <div className="absolute top-2 right-2 p-1 rounded-md bg-acc/20 text-acc text-[9px] font-bold">OPEN</div>
              </Link>
            </div>
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-line">
        <div className="flex">
          {LOCKED.slice(0, 4).map((item) => (
            <button key={item.label} onClick={() => setWarn(item.label)} className="flex-1 flex flex-col items-center gap-1 py-2.5 text-mut">
              <span className="relative">
                <item.icon className="h-5 w-5" />
                <Lock className="h-2.5 w-2.5 absolute -top-1 -right-1.5" />
              </span>
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
          <Link href="/portfolio" className="flex-1 flex flex-col items-center gap-1 py-2.5 text-acc">
            <Globe className="h-5 w-5" />
            <span className="text-[10px]">Portofolio</span>
          </Link>
        </div>
      </nav>

      {warn && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setWarn(null)}>
          <div className="bg-card border border-line rounded-2xl p-6 max-w-sm w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-14 w-14 rounded-2xl bg-acc/10 border border-acc/30 flex items-center justify-center">
              <Lock className="h-6 w-6 text-acc" />
            </div>
            <h3 className="font-bold text-ink">Anda harus login terlebih dahulu</h3>
            <p className="text-sm text-mut">
              Bagian "{warn}" hanya bisa diakses anggota {settings?.class_name || 'kelas'}. Login buat ikut di dalamnya.
            </p>
            <Link href="/login" className="block w-full py-2.5 rounded-xl bg-acc text-acc-ink text-sm font-bold">
              Login Sekarang
            </Link>
            <button onClick={() => setWarn(null)} className="w-full py-2 rounded-xl text-mut text-sm hover:text-ink">
              Nanti aja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
