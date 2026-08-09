'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2, ShieldAlert, UserCog } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import NotifBadge from '@/components/NotifBadge';
import MobileNav from '@/components/layout/MobileNav';
import ClassBrand from '@/components/ClassBrand';
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
    { href: '/settings', icon: UserCog, label: 'Profil' },
  ];
  const extra: typeof baseItems = [];
  if (profile.role === 'admin') extra.push({ href: '/admin', icon: Shield, label: 'Admin' });
  if (profile.role !== 'student') {
    extra.push({ href: '/admin/content', icon: Settings2, label: 'Konten' });
    extra.push({ href: '/admin/moderation', icon: ShieldAlert, label: 'Moderasi' });
  }
  const navItems = [...baseItems, ...extra];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-line bg-card-2">
        <div className="p-6 border-b border-line">
          <ClassBrand size="lg" />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-mut hover:bg-line hover:text-ink transition"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.href === '/notifications' && <NotifBadge userId={profile.user_id} />}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="h-9 w-9 rounded-full bg-line-2 flex items-center justify-center text-sm font-bold">
              {profile.full_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.full_name}</div>
              <div className="text-xs text-acc uppercase">{profile.role}</div>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-mut hover:text-red-400 hover:bg-line transition"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between px-4 h-14">
          <ClassBrand size="sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-mut">@{profile.username}</span>
            <form action={logout}>
              <button type="submit" className="p-2 text-mut" aria-label="Keluar">
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
