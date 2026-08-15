'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2, ShieldAlert, UserCog, Music, Award, Globe, Files, Brush } from 'lucide-react';
import NotifBadge from '@/components/NotifBadge';
import MobileNav from '@/components/layout/MobileNav';
import ClassBrand from '@/components/ClassBrand';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';
import ThemeToggle from '@/components/ThemeToggle';
import BackgroundPicker from '@/components/BackgroundPicker';
import LogoutButton from '@/components/LogoutButton';
import type { Profile } from '@/types/database';

export default function AppLayout({ children, profile, settings }: { children: React.ReactNode; profile: Profile; settings?: any }) {
  const baseItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/feed', icon: Newspaper, label: 'Feed' },
    { href: '/my-posts', icon: Files, label: 'Postinganku' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/tasks', icon: ClipboardList, label: 'Tugas' },
    { href: '/piket', icon: Brush, label: 'Piket' },
    { href: '/schedule', icon: Calendar, label: 'Jadwal' },
    { href: '/gallery', icon: ImageIcon, label: 'Galeri' },
    { href: '/music', icon: Music, label: 'Musik' },
    { href: '/portfolio', icon: Globe, label: 'Portofolio' },
    { href: '/notifications', icon: Bell, label: 'Notifikasi' },
    { href: '/members', icon: Users, label: 'Members' },
    { href: '/settings', icon: UserCog, label: 'Profil' },
  ];
  const extra: typeof baseItems = [];
  if (profile.role === 'admin') extra.push({ href: '/admin', icon: Shield, label: 'Admin' });
  if (profile.role !== 'student') {
    extra.push({ href: '/admin/tasks', icon: ClipboardList, label: 'Kelola Tugas' });
    extra.push({ href: '/admin/posts', icon: Shield, label: 'Kelola Postingan' });
    extra.push({ href: '/admin/content', icon: Settings2, label: 'Konten' });
    extra.push({ href: '/admin/portfolio', icon: Award, label: 'Edit Portofolio' });
    extra.push({ href: '/admin/moderation', icon: ShieldAlert, label: 'Moderasi' });
  }
  const navItems = [...baseItems, ...extra];

  return (
    <div className="min-h-screen text-ink relative">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20 border-r border-line glass">
        <div className="p-6 border-b border-line">
          <ClassBrand size="lg" initial={settings} />
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
          <div className="flex items-center gap-2 px-2 pb-3">
            <ThemeToggle />
            <BackgroundPicker />
            <span className="text-[10px] text-mut ml-auto">Tampilan</span>
          </div>
          <Link href="/settings" className="flex items-center gap-3 px-2 pb-3 rounded-lg hover:bg-line/50 transition" aria-label="Buka profil">
            <Avatar data={profile} className="h-9 w-9" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.full_name}</div>
              {profile.role === 'admin' ? (
                <AdminTag role="admin" className="text-xs" />
              ) : (
                <div className="text-xs text-acc uppercase">{profile.role}</div>
              )}
            </div>
          </Link>
          <LogoutButton withLabel />
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 glass border-b border-line">
        <div className="flex items-center justify-between px-4 h-14">
          <ClassBrand size="sm" initial={settings} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/settings" aria-label="Buka profil">
              <Avatar data={profile} className="h-7 w-7" />
            </Link>
            <LogoutButton />
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
