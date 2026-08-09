'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2 } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import NotifBadge from '@/components/NotifBadge';
import MobileNav from '@/components/layout/MobileNav';
import type { Profile } from '@/types/database';

export default function AppLayout({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const baseItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/feed', icon: Newspaper, label: 'Feed' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/tasks', icon: ClipboardList, label: 'Tugas' },
    { href: '/schedule', icon: Calendar, label: 'Jadwal' },
    { href: '/gallery', icon: ImageIcon, label: 'Galeri' },
    { href: '/notifications', icon: Bell, label: 'Notifikasi' },
    { href: '/members', icon: Users, label: 'Members' },
  ];
  const extra: typeof baseItems = [];
  if (profile.role === 'admin') extra.push({ href: '/admin', icon: Shield, label: 'Admin' });
  if (profile.role !== 'student') extra.push({ href: '/admin/content', icon: Settings2, label: 'Konten' });
  const navItems = [...baseItems, ...extra];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h1 className="text-xl font-bold tracking-tight">
            Class<span className="text-[#a3e635]">Hub</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">Kelas kamu, satu aplikasi</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#2a2a2a] hover:text-white transition"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.href === '/notifications' && <NotifBadge userId={profile.user_id} />}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="h-9 w-9 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-bold">
              {profile.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.full_name}</div>
              <div className="text-xs text-[#a3e635] uppercase">{profile.role}</div>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-[#2a2a2a] transition"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-lg font-bold">
            Class<span className="text-[#a3e635]">Hub</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">@{profile.username}</span>
            <form action={logout}>
              <button type="submit" className="p-2 text-gray-400" aria-label="Keluar">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="md:pl-64">
        <main className="pb-24 md:pb-8">{children}</main>
      </div>

      <MobileNav items={navItems} userId={profile.user_id} />
    </div>
  );
}
