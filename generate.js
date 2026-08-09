const fs = require('fs');
const path = require('path');

function wf(p, c) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] ' + p);
}

console.log('=== Generating ClassHub files ===');

wf('lib/utils/cn.ts', `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`);

wf('lib/supabase/client.ts', `'use client';
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`);

wf('lib/supabase/server.ts', `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}
`);

wf('lib/supabase/middleware.ts', `import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
`);

wf('middleware.ts', `import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
`);

console.log('=== Part A done ===');

// === PART B: AUTH + TYPES + LAYOUT ===

wf('lib/auth/actions.ts', `'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function login(formData: { username: string; password: string }) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_banned')
    .eq('username', formData.username.toLowerCase())
    .maybeSingle();
  if (!profile) return { error: 'Username tidak ditemukan' };
  if (profile.is_banned) return { error: 'Akun diblokir' };
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: formData.password,
  });
  if (error) return { error: 'Password salah' };
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || profile.is_banned) return null;
  return { ...user, profile };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(role: 'admin' | 'teacher') {
  const user = await requireUser();
  if (role === 'admin' && user.profile.role !== 'admin') redirect('/dashboard');
  if (role === 'teacher' && user.profile.role === 'student') redirect('/dashboard');
  return user;
}
`);

wf('types/database.ts', `export type Role = 'admin' | 'teacher' | 'student';

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  is_banned: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  media_type: 'image' | 'video' | 'none';
  is_hidden: boolean;
  created_at: string;
  profiles?: Profile;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profiles?: Profile;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'text';
  caption: string | null;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
};

export type Task = {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  subject: string | null;
  deadline: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
};

export type TaskSubmission = {
  id: string;
  task_id: string;
  user_id: string;
  file_url: string;
  file_name: string | null;
  note: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
};

export type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string | null;
  room: string | null;
  notes: string | null;
};

export type Duty = {
  id: string;
  day_of_week: number;
  user_ids: string[];
};

export type Announcement = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  attachment_url: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type ClassSettings = {
  id: string;
  class_name: string;
  subtitle: string | null;
  description: string | null;
  school_name: string | null;
  logo_url: string | null;
  accent_color: string;
  default_theme: string;
};

export type ErrorLog = {
  id: number;
  user_id: string | null;
  page: string | null;
  error_message: string;
  error_code: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
};
`);

wf('app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#0a0a0a] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
`);

wf('app/page.tsx', `import { getUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getUser();
  if (user) redirect('/dashboard');
  redirect('/login');
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, MessageCircle, User, Newspaper, Bell, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import type { Profile } from '@/types/database';

export default function AppLayout({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/feed', icon: Newspaper, label: 'Feed' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/members', icon: User, label: 'Members' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="md:pl-64">
        <header className="md:hidden sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="text-lg font-bold">ClassHub</h1>
            <Link href="/notifications" className="p-2">
              <Bell className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <main className="pb-20 md:pb-8">{children}</main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#2a2a2a] z-40">
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-400 hover:text-white"
              >
                <item.icon className="h-6 w-6" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
`);

console.log('[OK] Part B done: auth + types + layout');

// === PART C: PAGES + SQL ===

wf('app/login/page.tsx', `'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, is_banned')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      if (!profile) { setError('Username tidak ditemukan'); setLoading(false); return; }
      if (profile.is_banned) { setError('Akun ini telah diblokir'); setLoading(false); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });
      if (error) { setError('Password salah'); setLoading(false); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-md animate-[fadeIn_0.3s_ease-out]">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a3e635]/10 mb-4">
            <LogIn className="h-7 w-7 text-[#a3e635]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">ClassHub</h1>
          <p className="text-sm text-gray-400 mt-2">Masuk ke kelas kamu</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] text-white placeholder-gray-500 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/30 transition"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] text-white placeholder-gray-500 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/30 transition pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label="Toggle password"
              >
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#a3e635] text-[#0a0a0a] font-semibold hover:bg-[#84cc16] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Memproses...
              </>
            ) : (
              'Masuk'
            )}
          </button>
          <p className="text-center text-xs text-gray-500 pt-2">
            Lupa password? Hubungi admin kelas kamu.
          </p>
        </form>
      </div>
    </main>
  );
}
`);

wf('app/dashboard/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, ClipboardList, Users, Megaphone } from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

  const [{ data: schedules }, { data: tasks }, { data: announcements }] = await Promise.all([
    supabase.from('schedules').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
    supabase.from('tasks').select('*').eq('status', 'active').order('deadline').limit(5),
    supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3),
  ]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-1">
          <div className="text-sm text-gray-400">
            {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Halo, {user.profile.full_name.split(' ')[0]} 👋
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#a3e635]/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[#a3e635]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Jadwal Hari Ini</div>
                <div className="text-xl font-bold">{schedules?.length ?? 0}</div>
              </div>
            </div>
          </div>
          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#fb923c]/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-[#fb923c]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Tugas Aktif</div>
                <div className="text-xl font-bold">{tasks?.length ?? 0}</div>
              </div>
            </div>
          </div>
          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Pengumuman</div>
                <div className="text-xl font-bold">{announcements?.length ?? 0}</div>
              </div>
            </div>
          </div>
          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#fef3c7]/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-[#fef3c7]" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Anggota</div>
                <div className="text-xl font-bold">--</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#a3e635]" />
              Jadwal Hari Ini
            </h2>
            {(schedules?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-center py-8">Tidak ada jadwal hari ini 🎉</p>
            ) : (
              <div className="space-y-2">
                {schedules?.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0a]/50">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-bold">{s.start_time.slice(0, 5)}</div>
                      <div className="text-xs text-gray-500">{s.end_time.slice(0, 5)}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{s.subject}</div>
                      {s.room && <div className="text-xs text-gray-400">Ruang {s.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#fb923c]" />
              Tugas Aktif
            </h2>
            {(tasks?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-center py-8">Tidak ada tugas aktif 🎉</p>
            ) : (
              <div className="space-y-2">
                {tasks?.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-[#0a0a0a]/50">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.subject}</div>
                    <div className="text-xs text-[#fb923c] mt-1">
                      Deadline: {formatDate(t.deadline)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { PlusCircle, Heart, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts?.map((post) => (
              <div key={post.id} className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {(post as any).profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{(post as any).profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{(post as any).profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap">{post.content}</p>}
                <div className="flex items-center gap-4 pt-2 border-t border-[#2a2a2a]">
                  <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition">
                    <Heart className="h-5 w-5" />
                    <span>Like</span>
                  </button>
                  <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                    <MessageCircle className="h-5 w-5" />
                    <span>Komentar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/chat/page.tsx', `import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { MessageCircle } from 'lucide-react';

export default async function ChatPage() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Chat Kelas</h1>
        <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-8 text-center">
          <MessageCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Chat realtime akan segera hadir</p>
          <p className="text-sm text-gray-500 mt-2">Fitur ini menggunakan Supabase Realtime</p>
        </div>
      </div>
    </AppLayout>
  );
}
`);

wf('app/members/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Users } from 'lucide-react';

export default async function MembersPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_banned', false)
    .order('full_name');

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Anggota Kelas</h1>
        {(members?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada anggota</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {members?.map((m) => (
              <div key={m.id} className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-4 text-center">
                <div className="h-16 w-16 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  {m.full_name.charAt(0)}
                </div>
                <div className="font-semibold text-sm truncate">{m.full_name}</div>
                <div className="text-xs text-gray-400">@{m.username}</div>
                <div className="text-xs text-[#a3e635] mt-1 uppercase">{m.role}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part C done: all pages created');

// === PART D: SQL MIGRATIONS ===

wf('supabase/migrations/001_initial_schema.sql', `-- ClassHub Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role TEXT CHECK (role IN ('admin','teacher','student')) DEFAULT 'student',
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  media_type TEXT CHECK (media_type IN ('image','video','none')),
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('post','comment')),
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image','video','text')),
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  attachment_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  note TEXT,
  grade INTEGER CHECK (grade >= 0 AND grade <= 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(user_id),
  room TEXT,
  notes TEXT
);

CREATE TABLE duties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
  user_ids UUID[] DEFAULT '{}'
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  subject TEXT,
  bio TEXT,
  avatar_url TEXT
);

CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gallery_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id),
  media_url TEXT NOT NULL,
  media_type TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT NOT NULL,
  subtitle TEXT,
  school_name TEXT,
  academic_year TEXT,
  description TEXT,
  vision TEXT,
  mission TEXT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  actor_id UUID REFERENCES profiles(user_id),
  target_type TEXT,
  target_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE class_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT DEFAULT 'ClassHub',
  subtitle TEXT,
  description TEXT,
  school_name TEXT,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#a3e635',
  default_theme TEXT DEFAULT 'dark',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(user_id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  page TEXT,
  error_message TEXT,
  error_code TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_select" ON posts FOR SELECT USING (is_hidden = false);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "stories_select" ON stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "submissions_select" ON task_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON task_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO class_settings (class_name, subtitle, school_name)
VALUES ('ClassHub', 'Kelas Kamu', 'SMA Example')
ON CONFLICT DO NOTHING;
`);

wf('supabase/migrations/002_storage.sql', `-- Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('posts', 'posts', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('stories', 'stories', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('chat', 'chat', false, 20971520, ARRAY['image/jpeg','image/png','application/pdf']),
  ('tasks', 'tasks', false, 52428800, ARRAY['image/jpeg','image/png','application/pdf']),
  ('gallery', 'gallery', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "posts_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'posts' AND auth.role() = 'authenticated');
CREATE POLICY "posts_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "stories_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'stories' AND auth.role() = 'authenticated');
CREATE POLICY "stories_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat_auth" ON storage.objects FOR ALL USING (bucket_id = 'chat' AND auth.role() = 'authenticated') WITH CHECK (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tasks_auth" ON storage.objects FOR SELECT USING (bucket_id = 'tasks' AND auth.role() = 'authenticated');
CREATE POLICY "tasks_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tasks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "gallery_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery' AND auth.role() = 'authenticated');
`);

console.log('[OK] Part D done: SQL migrations created');
console.log('');
console.log('=== ALL FILES GENERATED ===');
console.log('Next steps:');
console.log('  1. Buka Supabase Dashboard > SQL Editor');
console.log('  2. Jalankan: supabase/migrations/001_initial_schema.sql');
console.log('  3. Jalankan: supabase/migrations/002_storage.sql');
console.log('  4. Edit .env.local dengan Supabase URL + Anon Key');
console.log('  5. npm run dev');

// === PART E: UI POLISH ===

wf('app/globals.css', `@import "tailwindcss";

@theme {
  --font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

html, body {
  background-color: #0a0a0a;
  color: #ffffff;
  font-family: var(--font-sans);
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 4px; }
`);

wf('app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import type { Profile } from '@/types/database';

export default function AppLayout({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/feed', icon: Newspaper, label: 'Feed' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/members', icon: Users, label: 'Members' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h1 className="text-xl font-bold tracking-tight">
            Class<span className="text-[#a3e635]">Hub</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">Kelas kamu, satu aplikasi</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#2a2a2a] hover:text-white transition"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
`);

wf('app/dashboard/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar, ClipboardList, Users, Megaphone } from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

  const [{ data: schedules }, { data: tasks }, { data: announcements }, { count: memberCount }] = await Promise.all([
    supabase.from('schedules').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
    supabase.from('tasks').select('*').eq('status', 'active').order('deadline').limit(5),
    supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', false),
  ]);

  const stats = [
    { label: 'Jadwal Hari Ini', value: String(schedules?.length ?? 0), color: 'text-[#a3e635]', bg: 'bg-[#a3e635]/10', Icon: Calendar },
    { label: 'Tugas Aktif', value: String(tasks?.length ?? 0), color: 'text-[#fb923c]', bg: 'bg-[#fb923c]/10', Icon: ClipboardList },
    { label: 'Pengumuman', value: String(announcements?.length ?? 0), color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: Megaphone },
    { label: 'Anggota', value: String(memberCount ?? 0), color: 'text-[#fef3c7]', bg: 'bg-[#fef3c7]/10', Icon: Users },
  ];

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="text-sm text-gray-400">
            {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Halo, {user.profile.full_name.split(' ')[0]} 👋
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
              <div className={'h-10 w-10 rounded-xl flex items-center justify-center mb-3 ' + s.bg}>
                <s.Icon className={'h-5 w-5 ' + s.color} />
              </div>
              <div className="text-xs text-gray-400">{s.label}</div>
              <div className="text-2xl font-bold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#a3e635]" />
              Jadwal Hari Ini
            </h2>
            {(schedules?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Tidak ada jadwal hari ini 🎉</p>
            ) : (
              <div className="space-y-2">
                {schedules?.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a]">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-bold text-[#a3e635]">{s.start_time.slice(0, 5)}</div>
                      <div className="text-xs text-gray-500">{s.end_time.slice(0, 5)}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{s.subject}</div>
                      {s.room && <div className="text-xs text-gray-400">Ruang {s.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#fb923c]" />
              Tugas Aktif
            </h2>
            {(tasks?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Tidak ada tugas aktif 🎉</p>
            ) : (
              <div className="space-y-2">
                {tasks?.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a]">
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.subject}</div>
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
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-400" />
              Pengumuman
            </h2>
            <div className="space-y-3">
              {announcements?.map((a) => (
                <div key={a.id} className={'p-4 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] ' + (a.is_pinned ? 'border-l-2 border-l-[#a3e635]' : '')}>
                  <div className="font-semibold text-sm">{a.is_pinned ? '📌 ' : ''}{a.title}</div>
                  <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part E done: UI polish applied');

// === PART F: MISSING PAGES ===

wf('components/feed/LikeButton.tsx', `'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

export default function LikeButton({ postId, userId, initialCount, initialLiked }: { postId: string; userId: string; initialCount: number; initialLiked: boolean }) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase.from('likes').delete().eq('user_id', userId).eq('target_type', 'post').eq('target_id', postId);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      await supabase.from('likes').insert({ user_id: userId, target_type: 'post', target_id: postId });
    }
  }

  return (
    <button onClick={toggle} className={'flex items-center gap-2 text-sm transition ' + (liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400')}>
      <Heart className={'h-5 w-5 ' + (liked ? 'fill-red-400' : '')} />
      <span>{count}</span>
    </button>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import { PlusCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: likes } = postIds.length
    ? await supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds)
    : { data: [] };

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes ?? []) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts?.map((post) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {(post as any).profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{(post as any).profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{(post as any).profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: post.media_urls.length > 1 ? '1fr 1fr' : '1fr' }}>
                    {post.media_urls.map((url, i) => (
                      <img key={i} src={url} alt="" loading="lazy" className="rounded-xl w-full object-cover max-h-80 border border-[#2a2a2a]" />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                  />
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    <MessageCircle className="h-5 w-5" />
                    <span>Komentar</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/feed/new/page.tsx', `'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, X, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPostPage() {
  const router = useRouter();
  const supabase = createClient();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    const next = [...files];
    const nextPrev = [...previews];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) { setError('Hanya file gambar yang diizinkan.'); continue; }
      if (f.size > 5 * 1024 * 1024) { setError('Maksimal 5MB per gambar.'); continue; }
      if (next.length >= 5) { setError('Maksimal 5 foto per postingan.'); break; }
      next.push(f);
      nextPrev.push(URL.createObjectURL(f));
    }
    setFiles(next);
    setPreviews(nextPrev);
  }

  function removeFile(idx: number) {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function publish() {
    if (!content.trim() && files.length === 0) { setError('Tulis sesuatu atau tambah foto.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const postId = crypto.randomUUID();
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const ext = files[i].name.split('.').pop() || 'jpg';
        const path = user.id + '/' + postId + '/image-' + i + '.' + ext;
        const { error: upErr } = await supabase.storage.from('posts').upload(path, files[i]);
        if (upErr) throw new Error('upload');
        const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim() || null,
        media_urls: urls,
        media_type: urls.length > 0 ? 'image' : 'none',
      });
      if (dbErr) throw new Error('db');
      router.push('/feed');
      router.refresh();
    } catch {
      setError('Gagal memposting. Coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <Link href="/feed" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Kembali</span>
          </Link>
          <button
            onClick={publish}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Posting
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Apa yang terjadi di kelas hari ini?"
          rows={5}
          className="w-full p-4 rounded-2xl bg-[#161616] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:border-[#a3e635]/50 resize-none"
        />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative">
                <img src={p} alt="" className="rounded-xl w-full h-28 object-cover border border-[#2a2a2a]" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white"
                  aria-label="Hapus foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-gray-300 hover:border-[#a3e635]/50 w-full"
        >
          <ImageIcon className="h-5 w-5 text-[#a3e635]" />
          Tambah foto (maks 5, maks 5MB/foto)
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
      </main>
    </div>
  );
}
`);

wf('app/tasks/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { ClipboardList, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: tasks }, { data: subs }] = await Promise.all([
    supabase.from('tasks').select('*').order('deadline'),
    supabase.from('task_submissions').select('task_id, grade').eq('user_id', user.id),
  ]);

  const subMap = new Map((subs ?? []).map((s) => [s.task_id, s]));
  const now = new Date();

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Tugas</h1>
        {(tasks?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada tugas</p>
          </div>
        ) : (
          tasks?.map((t) => {
            const sub = subMap.get(t.id);
            const late = !sub && new Date(t.deadline) < now;
            return (
              <div key={t.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.subject}</div>
                    {t.description && <p className="text-sm text-gray-300 mt-2">{t.description}</p>}
                  </div>
                  {sub ? (
                    <span className="flex items-center gap-1 text-xs text-[#a3e635] shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      {sub.grade !== null ? 'Nilai: ' + sub.grade : 'Dikumpulkan'}
                    </span>
                  ) : late ? (
                    <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
                      <AlertCircle className="h-4 w-4" />
                      Terlambat
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#fb923c] shrink-0">
                      <Clock className="h-4 w-4" />
                      Belum
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  Deadline: {new Date(t.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/schedule/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: schedules } = await supabase.from('schedules').select('*').order('day_of_week').order('start_time');

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Jadwal Pelajaran</h1>
        {(schedules?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada jadwal</p>
          </div>
        ) : (
          DAYS.map((day, i) => {
            const items = (schedules ?? []).filter((s) => s.day_of_week === i + 1);
            if (items.length === 0) return null;
            return (
              <div key={day}>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</h2>
                <div className="space-y-2">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#161616] border border-[#2a2a2a]">
                      <div className="text-center min-w-[60px]">
                        <div className="text-sm font-bold text-[#a3e635]">{s.start_time.slice(0, 5)}</div>
                        <div className="text-xs text-gray-500">{s.end_time.slice(0, 5)}</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{s.subject}</div>
                        {s.room && <div className="text-xs text-gray-400">Ruang {s.room}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/gallery/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: albums } = await supabase
    .from('gallery_albums')
    .select('*, gallery_media(media_url, caption, media_type)')
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold">Galeri Kelas</h1>
        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada album galeri</p>
          </div>
        ) : (
          albums?.map((album) => (
            <div key={album.id}>
              <h2 className="text-lg font-semibold mb-1">{album.name}</h2>
              {album.description && <p className="text-sm text-gray-400 mb-3">{album.description}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(album as any).gallery_media?.map((m: any, i: number) => (
                  <img key={i} src={m.media_url} alt={m.caption || ''} loading="lazy" className="rounded-xl w-full h-40 object-cover border border-[#2a2a2a]" />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/notifications/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, []);

  async function markAll() {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">Notifikasi</h1>
          <button onClick={markAll} className="flex items-center gap-1 text-xs text-[#a3e635]">
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada notifikasi</p>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className={'p-3 rounded-xl border ' + (n.is_read ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-[#a3e635]/5 border-[#a3e635]/30')}>
              <div className="text-sm font-semibold">{n.title}</div>
              {n.message && <p className="text-sm text-gray-300 mt-0.5">{n.message}</p>}
              <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import type { Profile } from '@/types/database';

export default function AppLayout({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/feed', icon: Newspaper, label: 'Feed' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/tasks', icon: ClipboardList, label: 'Tugas' },
    { href: '/schedule', icon: Calendar, label: 'Jadwal' },
    { href: '/gallery', icon: ImageIcon, label: 'Galeri' },
    { href: '/notifications', icon: Bell, label: 'Notifikasi' },
    { href: '/members', icon: Users, label: 'Members' },
  ];
  const mobileItems = [navItems[0], navItems[1], navItems[2], navItems[7]];

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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {mobileItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
`);

console.log('[OK] Part F done: feed/new, tasks, schedule, gallery, notifications, like, sidebar lengkap');

// === PART G: COMMENTS + REAL ERROR MESSAGES ===

wf('components/feed/CommentsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose }: { postId: string; userId: string; onClose: () => void }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) load();
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Komentar</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Belum ada komentar. Mulai diskusi!</p>
          ) : (
            top.map((c) => (
              <div key={c.id}>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="text-xs font-semibold mb-0.5 text-white">{c.profiles?.full_name}</div>
                      <div className="text-sm whitespace-pre-wrap text-gray-200">{c.content}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-gray-500">
                      <button onClick={() => setReplyTo(c)} className="hover:text-white">Balas</button>
                      {c.user_id === userId && (
                        <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-11 mt-2 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                        {(r.profiles?.full_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                          <div className="text-xs font-semibold mb-0.5 text-white">{r.profiles?.full_name}</div>
                          <div className="text-sm whitespace-pre-wrap text-gray-200">{r.content}</div>
                        </div>
                        {r.user_id === userId && (
                          <div className="ml-2 mt-1">
                            <button onClick={() => del(r.id)} className="text-xs text-red-400">Hapus</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-[#2a2a2a]">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2 rounded-full bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button onClick={submit} disabled={!text.trim()} className="p-2 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30" aria-label="Kirim">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

wf('components/feed/CommentButton.tsx', `'use client';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import CommentsSheet from './CommentsSheet';

export default function CommentButton({ postId, userId, count }: { postId: string; userId: string; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
        <MessageCircle className="h-5 w-5" />
        <span>{count}</span>
      </button>
      {open && <CommentsSheet postId={postId} userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts?.map((post) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {(post as any).profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{(post as any).profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{(post as any).profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: post.media_urls.length > 1 ? '1fr 1fr' : '1fr' }}>
                    {post.media_urls.map((url, i) => (
                      <img key={i} src={url} alt="" loading="lazy" className="rounded-xl w-full object-cover max-h-80 border border-[#2a2a2a]" />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                  />
                  <CommentButton postId={post.id} userId={user.id} count={commentCounts[post.id] ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('app/feed/new/page.tsx', `'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, X, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPostPage() {
  const router = useRouter();
  const supabase = createClient();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    const next = [...files];
    const nextPrev = [...previews];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) { setError('Hanya file gambar yang diizinkan.'); continue; }
      if (f.size > 5 * 1024 * 1024) { setError('Maksimal 5MB per gambar.'); continue; }
      if (next.length >= 5) { setError('Maksimal 5 foto per postingan.'); break; }
      next.push(f);
      nextPrev.push(URL.createObjectURL(f));
    }
    setFiles(next);
    setPreviews(nextPrev);
  }

  function removeFile(idx: number) {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function publish() {
    if (!content.trim() && files.length === 0) { setError('Tulis sesuatu atau tambah foto.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const postId = crypto.randomUUID();
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const ext = files[i].name.split('.').pop() || 'jpg';
        const path = user.id + '/' + postId + '/image-' + i + '.' + ext;
        const { error: upErr } = await supabase.storage.from('posts').upload(path, files[i]);
        if (upErr) { setError('Upload gagal: ' + upErr.message); setLoading(false); return; }
        const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim() || null,
        media_urls: urls,
        media_type: urls.length > 0 ? 'image' : 'none',
      });
      if (dbErr) { setError('Gagal simpan post: ' + dbErr.message); setLoading(false); return; }
      router.push('/feed');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan tak terduga.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <Link href="/feed" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Kembali</span>
          </Link>
          <button
            onClick={publish}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Posting
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{error}</div>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Apa yang terjadi di kelas hari ini?"
          rows={5}
          className="w-full p-4 rounded-2xl bg-[#161616] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:border-[#a3e635]/50 resize-none"
        />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative">
                <img src={p} alt="" className="rounded-xl w-full h-28 object-cover border border-[#2a2a2a]" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white"
                  aria-label="Hapus foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-gray-300 hover:border-[#a3e635]/50 w-full"
        >
          <ImageIcon className="h-5 w-5 text-[#a3e635]" />
          Tambah foto (maks 5, maks 5MB/foto)
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
      </main>
    </div>
  );
}
`);

console.log('[OK] Part G done: comments + reply + delete + error transparan di posting');

// === PART H: CHAT REALTIME ===

wf('components/chat/ChatRoom.tsx', `'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, MessageCircle } from 'lucide-react';

type Msg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export default function ChatRoom({ userId, initial, names }: { userId: string; initial: Msg[]; names: Record<string, string> }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setErr('');
    const { error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      content: text.trim(),
    });
    if (error) setErr('Gagal kirim: ' + error.message);
    setText('');
    setSending(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a]">
          <MessageCircle className="h-5 w-5 text-[#a3e635]" />
          <div>
            <div className="font-semibold text-white text-sm">Chat Kelas</div>
            <div className="text-xs text-gray-500">Realtime • semua anggota</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Belum ada pesan. Sapa kelas lu!</p>
          )}
          {messages.map((m) => {
            const own = m.user_id === userId;
            return (
              <div key={m.id} className={'flex ' + (own ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-3 py-2 ' +
                    (own ? 'bg-[#a3e635] text-[#0a0a0a] rounded-br-sm' : 'bg-[#0f0f0f] border border-[#2a2a2a] rounded-bl-sm')
                  }
                >
                  {!own && (
                    <div className="text-xs font-semibold mb-0.5 text-[#a3e635]">
                      {names[m.user_id] || 'Warga Kelas'}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  <div className={'text-[10px] mt-1 ' + (own ? 'text-[#0a0a0a]/60' : 'text-gray-500')}>
                    {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[#2a2a2a]">
          {err && <div className="text-xs text-red-400 mb-2">{err}</div>}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tulis pesan..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="p-2.5 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

wf('app/chat/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ChatRoom from '@/components/chat/ChatRoom';

export default async function ChatPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: messages }, { data: profs }] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('id, user_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('user_id, full_name'),
  ]);

  const names: Record<string, string> = {};
  for (const p of profs ?? []) names[p.user_id] = p.full_name;
  const initial = (messages ?? []).reverse();

  return (
    <AppLayout profile={user.profile}>
      <ChatRoom userId={user.id} initial={initial} names={names} />
    </AppLayout>
  );
}
`);

console.log('[OK] Part H done: chat realtime');

// === PART I: ADMIN PANEL + FIX crossOrigin ===

wf('app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
`);

wf('lib/supabase/admin.ts', `import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
`);

wf('lib/auth/admin-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function adminCreateUser(formData: FormData) {
  await requireRole('admin');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'student');
  const password = String(formData.get('password') || '');

  if (!email || !username || !full_name) return { error: 'Semua field wajib diisi.' };
  if (password.length < 6) return { error: 'Password minimal 6 karakter.' };

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return { error: 'Username sudah dipakai.' };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name },
  });
  if (error) return { error: error.message };
  if (data.user) {
    await admin.from('profiles').update({ role, full_name, username }).eq('user_id', data.user.id);
  }
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminUpdateRole(userId: string, role: string) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminSetBan(userId: string, banned: boolean) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_banned: banned }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}
`);

wf('components/admin/AdminUsersClient.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminCreateUser, adminUpdateRole, adminSetBan } from '@/lib/auth/admin-actions';
import { Plus, X, Shield } from 'lucide-react';

type Member = {
  user_id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  is_banned: boolean;
};

export default function AdminUsersClient({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setMsg('');
    const res = await adminCreateUser(fd);
    setBusy(false);
    if (res && res.error) {
      setMsg('Gagal: ' + res.error);
    } else {
      setMsg('Akun berhasil dibuat.');
      setShowForm(false);
      router.refresh();
    }
  }

  async function changeRole(userId: string, role: string) {
    const res = await adminUpdateRole(userId, role);
    if (res && res.error) setMsg('Gagal ubah role: ' + res.error);
    router.refresh();
  }

  async function toggleBan(m: Member) {
    const res = await adminSetBan(m.user_id, !m.is_banned);
    if (res && res.error) setMsg('Gagal: ' + res.error);
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#a3e635]" />
          Manajemen Anggota
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Tutup' : 'Buat Akun'}
        </button>
      </div>

      {msg && <div className="p-3 rounded-xl bg-[#161616] border border-[#2a2a2a] text-sm text-gray-200">{msg}</div>}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
          className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5 grid md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input name="email" type="email" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="murid@classhub.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input name="username" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="raka" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nama Lengkap</label>
            <input name="full_name" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="Raka Pratama" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password Sementara</label>
            <input name="password" type="text" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="min. 6 karakter" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Role</label>
            <select name="role" className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50">
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
              {busy ? 'Membuat...' : 'Buat Akun'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className={'flex flex-wrap items-center gap-3 p-3 rounded-xl border ' + (m.is_banned ? 'bg-red-500/5 border-red-500/30' : 'bg-[#161616] border-[#2a2a2a]')}>
            <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-bold">
              {m.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {m.full_name}
                {m.user_id === currentUserId && <span className="text-[#a3e635] text-xs ml-2">(lu)</span>}
              </div>
              <div className="text-xs text-gray-400 truncate">@{m.username} • {m.email}</div>
            </div>
            <select
              value={m.role}
              disabled={m.user_id === currentUserId}
              onChange={(e) => changeRole(m.user_id, e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white disabled:opacity-40"
            >
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
            <button
              onClick={() => toggleBan(m)}
              disabled={m.user_id === currentUserId}
              className={'px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ' + (m.is_banned ? 'bg-[#a3e635] text-[#0a0a0a]' : 'bg-red-500/10 text-red-400 border border-red-500/20')}
            >
              {m.is_banned ? 'Aktifkan' : 'Ban'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

wf('app/admin/users/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export default async function AdminUsersPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const { data: members } = await supabase.from('profiles').select('*').order('created_at');
  return (
    <AppLayout profile={user.profile}>
      <AdminUsersClient members={(members ?? []) as any} currentUserId={user.id} />
    </AppLayout>
  );
}
`);

wf('app/admin/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Users, Newspaper, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const [{ count: memberCount }, { count: postCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#a3e635]" />
          Panel Admin
        </h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Users className="h-5 w-5 text-[#a3e635] mb-2" />
            <div className="text-xs text-gray-400">Total Anggota</div>
            <div className="text-2xl font-bold">{memberCount ?? 0}</div>
          </div>
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Newspaper className="h-5 w-5 text-[#fb923c] mb-2" />
            <div className="text-xs text-gray-400">Total Post</div>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
          </div>
        </div>
        <Link href="/admin/users" className="block p-4 rounded-2xl bg-[#a3e635] text-[#0a0a0a] font-semibold hover:bg-[#84cc16] transition">
          Kelola Anggota → buat akun, ubah role, ban
        </Link>
      </div>
    </AppLayout>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
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
  const navItems = profile.role === 'admin'
    ? [...baseItems, { href: '/admin', icon: Shield, label: 'Admin' }]
    : baseItems;
  const mobileItems = [baseItems[0], baseItems[1], baseItems[2], baseItems[7]];

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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {mobileItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
`);

console.log('[OK] Part I done: admin panel + fix crossOrigin');

// === PART J: TASKS + SUBMISSION + GRADING ===

wf('lib/auth/task-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_FILE = 20 * 1024 * 1024;

export async function createTask(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const taskId = randomUUID();
  let attachment_url: string | null = null;

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 20MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = user.id + '/' + taskId + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream' });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await admin.from('tasks').insert({
    id: taskId,
    created_by: user.id,
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
    attachment_url,
    status: 'active',
  });
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function submitTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get('task_id') || '');
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Pilih file jawaban dulu.' };
  if (file.size > MAX_FILE) return { error: 'File maksimal 20MB.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return { error: 'Kamu sudah mengumpulkan tugas ini.' };

  const { data: task } = await admin.from('tasks').select('deadline').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Tugas tidak ditemukan.' };
  const late = new Date(task.deadline) < new Date();

  const ext = file.name.split('.').pop() || 'bin';
  const path = user.id + '/' + taskId + '/submission.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('tasks')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await admin.from('task_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    file_url: url,
    file_name: file.name,
    status: late ? 'late' : 'submitted',
  });
  if (dbErr) return { error: dbErr.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}
`);

wf('components/tasks/CreateTaskForm.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/lib/auth/task-actions';
import { Plus, X } from 'lucide-react';

export default function CreateTaskForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await createTask(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else { setShow(false); router.refresh(); }
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16]"
      >
        <Plus className="h-4 w-4" />
        Buat Tugas
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Tugas Baru</h2>
        <button type="button" onClick={() => setShow(false)} className="text-gray-400 hover:text-white" aria-label="Tutup">
          <X className="h-5 w-5" />
        </button>
      </div>
      {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Judul</label>
          <input name="title" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="Tugas Bab 6" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Mapel</label>
          <input name="subject" className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" placeholder="Matematika" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Deskripsi</label>
        <textarea name="description" rows={3} className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50 resize-none" placeholder="Instruksi tugas..." />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Deadline</label>
          <input name="deadline" type="datetime-local" required className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Lampiran (opsional)</label>
          <input name="attachment" type="file" className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white" />
        </div>
      </div>
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
        {busy ? 'Membuat...' : 'Terbitkan Tugas'}
      </button>
    </form>
  );
}
`);

wf('components/tasks/SubmissionsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gradeSubmission } from '@/lib/auth/task-actions';
import { X, FileText } from 'lucide-react';

function GradeForm({ sub, onDone }: { sub: any; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await gradeSubmission(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else onDone();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="flex flex-wrap items-center gap-2 mt-2"
    >
      <input type="hidden" name="submission_id" value={sub.id} />
      <input
        type="number"
        name="grade"
        min={0}
        max={100}
        required
        defaultValue={sub.grade ?? ''}
        placeholder="0-100"
        className="w-20 px-2 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        type="text"
        name="feedback"
        defaultValue={sub.feedback ?? ''}
        placeholder="Feedback..."
        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-xs font-semibold disabled:opacity-50">
        {busy ? '...' : 'Simpan Nilai'}
      </button>
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </form>
  );
}

export default function SubmissionsSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const supabase = createClient();
  const [subs, setSubs] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from('task_submissions')
      .select('*, profiles(full_name, username)')
      .eq('task_id', taskId)
      .order('submitted_at');
    setSubs(data ?? []);
  }

  useEffect(() => {
    load();
  }, [taskId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Submission ({subs.length})</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {subs.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Belum ada yang mengumpulkan.</p>
          ) : (
            subs.map((s) => (
              <div key={s.id} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{s.profiles?.username}</div>
                  </div>
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {s.file_name}
                  </a>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Status: {s.status === 'graded' ? 'Dinilai (' + s.grade + ')' : s.status === 'late' ? 'Terlambat' : 'Masuk'}
                </div>
                <GradeForm sub={s} onDone={load} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
`);

wf('components/tasks/TaskCard.tsx', `'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/lib/auth/task-actions';
import SubmissionsSheet from './SubmissionsSheet';
import { Clock, CheckCircle2, AlertCircle, Upload, Users, Paperclip } from 'lucide-react';

export default function TaskCard({ task, mySub, subCount, isStaff, userId }: { task: any; mySub: any; subCount: number; isStaff: boolean; userId: string }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const late = !mySub && new Date(task.deadline) < new Date();

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await submitTask(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{task.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="flex items-center gap-1 text-xs text-[#a3e635] shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            {mySub.status === 'graded' ? 'Nilai: ' + mySub.grade : mySub.status === 'late' ? 'Terlambat' : 'Masuk'}
          </span>
        ) : late ? (
          <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
            <AlertCircle className="h-4 w-4" />
            Lewat deadline
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[#fb923c] shrink-0">
            <Clock className="h-4 w-4" />
            Aktif
          </span>
        )}
      </div>

      {task.description && <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-gray-500">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-gray-300">
          <span className="text-[#a3e635] font-semibold">Feedback: </span>
          {mySub.feedback}
        </div>
      )}

      {!isStaff && !mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2a2a2a]"
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input
            type="file"
            name="file"
            required
            className="flex-1 min-w-[160px] text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-xs font-semibold disabled:opacity-50">
            <Upload className="h-3 w-3" />
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
        >
          <Users className="h-3 w-3" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
`);

wf('app/tasks/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import TaskCard from '@/components/tasks/TaskCard';
import CreateTaskForm from '@/components/tasks/CreateTaskForm';
import { ClipboardList } from 'lucide-react';

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';

  const [{ data: tasks }, { data: mySubs }, { data: allSubs }] = await Promise.all([
    supabase.from('tasks').select('*').order('deadline', { ascending: false }),
    supabase.from('task_submissions').select('*').eq('user_id', user.id),
    supabase.from('task_submissions').select('task_id'),
  ]);

  const mySubMap = new Map((mySubs ?? []).map((s) => [s.task_id, s]));
  const subCounts: Record<string, number> = {};
  for (const s of allSubs ?? []) subCounts[s.task_id] = (subCounts[s.task_id] ?? 0) + 1;

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tugas</h1>
          {isStaff && <CreateTaskForm />}
        </div>

        {(tasks?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada tugas.</p>
          </div>
        ) : (
          (tasks ?? []).map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              mySub={mySubMap.get(t.id) ?? null}
              subCount={subCounts[t.id] ?? 0}
              isStaff={isStaff}
              userId={user.id}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part J done: create task, submit file, grading, feedback, status otomatis');

// === PART J2: FIX LIMIT UPLOAD + UPSERT ===

wf('next.config.ts', `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverActions: {
    bodySizeLimit: '50mb',
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

export default nextConfig;
`);

wf('lib/auth/task-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_FILE = 50 * 1024 * 1024;

export async function createTask(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const taskId = randomUUID();
  let attachment_url: string | null = null;

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 50MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = user.id + '/' + taskId + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await admin.from('tasks').insert({
    id: taskId,
    created_by: user.id,
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
    attachment_url,
    status: 'active',
  });
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function submitTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get('task_id') || '');
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Pilih file jawaban dulu.' };
  if (file.size > MAX_FILE) return { error: 'File maksimal 50MB.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return { error: 'Kamu sudah mengumpulkan tugas ini.' };

  const { data: task } = await admin.from('tasks').select('deadline').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Tugas tidak ditemukan.' };
  const late = new Date(task.deadline) < new Date();

  const ext = file.name.split('.').pop() || 'bin';
  const path = user.id + '/' + taskId + '/submission.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('tasks')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await admin.from('task_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    file_url: url,
    file_name: file.name,
    status: late ? 'late' : 'submitted',
  });
  if (dbErr) return { error: dbErr.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id);
  if (error) return { error: error.message };
  return { success: true };
}
`);

wf('components/tasks/TaskCard.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/lib/auth/task-actions';
import SubmissionsSheet from './SubmissionsSheet';
import { Clock, CheckCircle2, AlertCircle, Upload, Users, Paperclip } from 'lucide-react';

export default function TaskCard({ task, mySub, subCount, isStaff, userId }: { task: any; mySub: any; subCount: number; isStaff: boolean; userId: string }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const late = !mySub && new Date(task.deadline) < new Date();

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const res = await submitTask(fd);
      if (res && res.error) setErr(res.error);
      else router.refresh();
    } catch (e: any) {
      setErr('Error: ' + (e && e.message ? e.message : 'gagal mengirim'));
    }
    setBusy(false);
  }

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{task.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="flex items-center gap-1 text-xs text-[#a3e635] shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            {mySub.status === 'graded' ? 'Nilai: ' + mySub.grade : mySub.status === 'late' ? 'Terlambat' : 'Masuk'}
          </span>
        ) : late ? (
          <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
            <AlertCircle className="h-4 w-4" />
            Lewat deadline
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[#fb923c] shrink-0">
            <Clock className="h-4 w-4" />
            Aktif
          </span>
        )}
      </div>

      {task.description && <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-gray-500">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-gray-300">
          <span className="text-[#a3e635] font-semibold">Feedback: </span>
          {mySub.feedback}
        </div>
      )}

      {!isStaff && !mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2a2a2a]"
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input
            type="file"
            name="file"
            required
            className="flex-1 min-w-[160px] text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-xs font-semibold disabled:opacity-50">
            <Upload className="h-3 w-3" />
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          <div className="w-full text-[10px] text-gray-500">Maksimal 50MB per file</div>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
        >
          <Users className="h-3 w-3" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
`);

console.log('[OK] Part J2 done: limit 50MB + upsert + error handling submit');

// === PART J3: MIGRATION STATUS COLUMN ===

wf('supabase/migrations/003_add_submission_status.sql', `ALTER TABLE public.task_submissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted';

NOTIFY pgrst, 'reload schema';
`);

console.log('[OK] Part J3 done: migration file recorded');

// === PART J4: FIX GRADING + ERROR TRANSPARAN ===

wf('lib/auth/task-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_FILE = 50 * 1024 * 1024;

export async function createTask(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const taskId = randomUUID();
  let attachment_url: string | null = null;

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 50MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = user.id + '/' + taskId + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await admin.from('tasks').insert({
    id: taskId,
    created_by: user.id,
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
    attachment_url,
    status: 'active',
  });
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function submitTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get('task_id') || '');
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Pilih file jawaban dulu.' };
  if (file.size > MAX_FILE) return { error: 'File maksimal 50MB.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return { error: 'Kamu sudah mengumpulkan tugas ini.' };

  const { data: task } = await admin.from('tasks').select('deadline').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Tugas tidak ditemukan.' };
  const late = new Date(task.deadline) < new Date();

  const ext = file.name.split('.').pop() || 'bin';
  const path = user.id + '/' + taskId + '/submission.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('tasks')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await admin.from('task_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    file_url: url,
    file_name: file.name,
    status: late ? 'late' : 'submitted',
  });
  if (dbErr) return { error: dbErr.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (!id) return { error: 'ID submission kosong.' };
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: '0 baris terupdate — submission tidak ketemu.' };
  revalidatePath('/tasks');
  return { success: true };
}
`);

wf('components/tasks/SubmissionsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gradeSubmission } from '@/lib/auth/task-actions';
import { X, FileText } from 'lucide-react';

function GradeForm({ sub, onDone }: { sub: any; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    setSaved(false);
    try {
      const res = await gradeSubmission(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setSaved(true);
        onDone();
      }
    } catch (e: any) {
      console.error('gradeSubmission error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="flex flex-wrap items-center gap-2 mt-2"
    >
      <input type="hidden" name="submission_id" value={sub.id} />
      <input
        type="number"
        name="grade"
        min={0}
        max={100}
        required
        defaultValue={sub.grade ?? ''}
        placeholder="0-100"
        className="w-20 px-2 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        type="text"
        name="feedback"
        defaultValue={sub.feedback ?? ''}
        placeholder="Feedback..."
        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-xs font-semibold disabled:opacity-50"
      >
        {busy ? '...' : 'Simpan Nilai'}
      </button>
      {saved && <span className="text-[#a3e635] text-xs">Tersimpan ✓</span>}
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </form>
  );
}

export default function SubmissionsSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const supabase = createClient();
  const [subs, setSubs] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from('task_submissions')
      .select('*, profiles(full_name, username)')
      .eq('task_id', taskId)
      .order('submitted_at');
    setSubs(data ?? []);
  }

  useEffect(() => {
    load();
  }, [taskId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Submission ({subs.length})</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {subs.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Belum ada yang mengumpulkan.</p>
          ) : (
            subs.map((s) => (
              <div key={s.id} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{s.profiles?.username}</div>
                  </div>
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {s.file_name}
                  </a>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Status: {s.status === 'graded' ? 'Dinilai (' + s.grade + ')' : s.status === 'late' ? 'Terlambat' : 'Masuk'}
                </div>
                <GradeForm sub={s} onDone={load} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
`);

console.log('[OK] Part J4 done: grading transparan + deteksi 0 baris');

// === PART K2: FIX NEXT 16 CONFIG + TS TYPES ===

wf('next.config.ts', `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

export default nextConfig;
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{post.profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: post.media_urls.length > 1 ? '1fr 1fr' : '1fr' }}>
                    {post.media_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" loading="lazy" className="rounded-xl w-full object-cover max-h-80 border border-[#2a2a2a]" />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                  />
                  <CommentButton postId={post.id} userId={user.id} count={commentCounts[post.id] ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part K2 done: next 16 config + typed feed');

// === PART M: LIGHTBOX + MEDIA FULL + LOADING STATE ===

wf('app/loading.tsx', `export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[#a3e635] border-t-transparent animate-spin" />
    </div>
  );
}
`);

wf('components/feed/Lightbox.tsx', `'use client';
import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function Lightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((p) => Math.min(urls.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setI((p) => Math.max(0, p - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <button
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white z-10"
        aria-label="Tutup"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => Math.max(0, p - 1)); }}
            disabled={i === 0}
            className="absolute left-1 md:left-6 p-2 text-white/70 hover:text-white disabled:opacity-20 z-10"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => Math.min(urls.length - 1, p + 1)); }}
            disabled={i === urls.length - 1}
            className="absolute right-1 md:right-6 p-2 text-white/70 hover:text-white disabled:opacity-20 z-10"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {isVideo(urls[i]) ? (
        <video src={urls[i]} controls playsInline className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img
          src={urls[i]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain select-none rounded-lg"
        />
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-4 text-xs text-white/60">{i + 1} / {urls.length}</div>
      )}
    </div>
  );
}
`);

wf('components/feed/PostMedia.tsx', `'use client';
import { useState } from 'react';
import Lightbox from './Lightbox';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="w-full mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="w-full h-auto max-h-[520px]" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="w-full h-auto max-h-[520px] object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]"
            aria-label="Lihat detail"
          >
            {isVideo(url) ? (
              <video src={url} muted preload="metadata" playsInline className="w-full h-40 object-cover" />
            ) : (
              <img src={url} alt="" loading="lazy" className="w-full h-40 object-cover" />
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import PostMedia from '@/components/feed/PostMedia';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{post.profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                  />
                  <CommentButton postId={post.id} userId={user.id} count={commentCounts[post.id] ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part M done: lightbox + media full + loading state');

// === PART M2: FIX BLACK BARS + PART L: STORIES 24 JAM ===

wf('components/feed/PostMedia.tsx', `'use client';
import { useState } from 'react';
import Lightbox from './Lightbox';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]"
            aria-label="Lihat detail"
          >
            {isVideo(url) ? (
              <video src={url} muted preload="metadata" playsInline className="w-full h-40 object-cover" />
            ) : (
              <img src={url} alt="" loading="lazy" className="w-full h-40 object-cover" />
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
`);

wf('components/feed/StoryViewer.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

type Story = { id: string; media_url: string; caption: string | null; user_id: string };
type Group = { profile: any; stories: Story[] };

export default function StoryViewer({ groups, start, onClose }: { groups: Group[]; start: number; onClose: () => void }) {
  const supabase = createClient();
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [prog, setProg] = useState(0);
  const group = groups[gi];
  const story = group ? group.stories[si] : null;

  function next() {
    if (!group) return onClose();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }

  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(0); }
  }

  useEffect(() => {
    setProg(0);
    const t = setInterval(() => setProg((p) => Math.min(100, p + 2)), 100);
    return () => clearInterval(t);
  }, [gi, si]);

  useEffect(() => {
    if (prog >= 100) next();
  }, [prog]);

  useEffect(() => {
    if (!story) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('story_views').insert({ story_id: story.id, user_id: user.id });
    })();
  }, [story ? story.id : '']);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto">
        <div className="absolute top-0 left-0 right-0 z-20 p-3 space-y-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-0.5 rounded bg-white/25 overflow-hidden">
                <div
                  className="h-full bg-[#a3e635]"
                  style={{ width: (i < si ? 100 : i === si ? prog : 0) + '%' }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold text-white">
                {group.profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-sm font-semibold text-white">{group.profile?.full_name}</div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white" aria-label="Tutup">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <button className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={prev} aria-label="Sebelumnya" />
        <button className="absolute right-0 top-0 bottom-0 w-1/3 z-10" onClick={next} aria-label="Berikutnya" />

        <img src={story.media_url} alt="" className="w-full h-full object-contain" />

        {story.caption && (
          <div className="absolute bottom-4 left-4 right-4 z-20 text-center text-sm text-white bg-black/50 rounded-xl px-3 py-2">
            {story.caption}
          </div>
        )}
      </div>
    </div>
  );
}
`);

wf('components/feed/StoryBar.tsx', `'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, X, Loader2 } from 'lucide-react';
import StoryViewer from './StoryViewer';

export default function StoryBar({ userId }: { userId: string }) {
  const supabase = createClient();
  const [groups, setGroups] = useState<any[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: stories } = await supabase
      .from('stories')
      .select('*, profiles(full_name, username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at');
    const map = new Map<string, any>();
    for (const s of stories ?? []) {
      if (!map.has(s.user_id)) map.set(s.user_id, { profile: s.profiles, stories: [] });
      map.get(s.user_id).stories.push(s);
    }
    const gs = Array.from(map.values());
    setGroups(gs);
    const ids: string[] = [];
    for (const g of gs) for (const s of g.stories) ids.push(s.id);
    if (ids.length > 0) {
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', userId)
        .in('story_id', ids);
      setViewedIds((views ?? []).map((v: any) => v.story_id));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function publish(file: File) {
    setBusy(true);
    setErr('');
    try {
      if (!file.type.startsWith('image/')) { setErr('Hanya file gambar.'); return; }
      if (file.size > 5 * 1024 * 1024) { setErr('Maksimal 5MB.'); return; }
      const storyId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = userId + '/' + storyId + '.' + ext;
      const { error: upErr } = await supabase.storage.from('stories').upload(path, file);
      if (upErr) { setErr('Upload gagal: ' + upErr.message); return; }
      const url = supabase.storage.from('stories').getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await supabase.from('stories').insert({
        user_id: userId,
        media_url: url,
        media_type: 'image',
        caption: caption.trim() || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (dbErr) { setErr(dbErr.message); return; }
      setShowCreate(false);
      setCaption('');
      load();
    } catch {
      setErr('Gagal membuat story.');
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button onClick={() => setShowCreate(true)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="h-16 w-16 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center">
            <Plus className="h-6 w-6 text-[#a3e635]" />
          </div>
          <span className="text-[10px] text-gray-400">Ceritamu</span>
        </button>
        {groups.map((g, i) => {
          const allViewed = g.stories.every((s: any) => viewedIds.indexOf(s.id) !== -1);
          return (
            <button key={i} onClick={() => setOpen(i)} className="flex flex-col items-center gap-1 shrink-0">
              <div className={'h-16 w-16 rounded-full p-0.5 ' + (allViewed ? 'border border-[#3a3a3a]' : 'border-2 border-[#a3e635]')}>
                <div className="h-full w-full rounded-full bg-[#3a3a3a] flex items-center justify-center text-lg font-bold text-white">
                  {g.profile?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 max-w-[64px] truncate">{g.profile?.full_name}</span>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Buat Story</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (opsional)"
              className="w-full px-3 py-2 rounded-lg bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button
              disabled={busy}
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (!f) { setErr('Pilih gambar dulu.'); return; }
                publish(f);
              }}
              className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Mengunggah...' : 'Terbitkan (24 jam)'}
            </button>
          </div>
        </div>
      )}

      {open !== null && groups.length > 0 && (
        <StoryViewer groups={groups} start={open} onClose={() => { setOpen(null); load(); }} />
      )}
    </div>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import PostMedia from '@/components/feed/PostMedia';
import StoryBar from '@/components/feed/StoryBar';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <StoryBar userId={user.id} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{post.profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                  />
                  <CommentButton postId={post.id} userId={user.id} count={commentCounts[post.id] ?? 0} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part M2+L done: fix black bars + stories 24 jam');

// === PART N: GALLERY ALBUMS + UPLOAD ===

wf('lib/auth/gallery-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createAlbum(formData: FormData) {
  await requireRole('teacher');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
`);

wf('components/gallery/CreateAlbumForm.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAlbum } from '@/lib/auth/gallery-actions';
import { Plus, X } from 'lucide-react';

export default function CreateAlbumForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await createAlbum(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else { setShow(false); router.refresh(); }
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16]"
      >
        <Plus className="h-4 w-4" />
        Album Baru
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3 w-full"
    >
      {err && <div className="text-xs text-red-400">{err}</div>}
      <input
        name="name"
        required
        placeholder="Nama album (mis. Kegiatan Kelas)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="description"
        placeholder="Deskripsi (opsional)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold disabled:opacity-50">
          {busy ? '...' : 'Buat Album'}
        </button>
        <button type="button" onClick={() => setShow(false)} className="px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
`);

wf('components/gallery/UploadModal.tsx', `'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { X, Loader2, Upload } from 'lucide-react';

export default function UploadModal({ albumId, userId, onClose }: { albumId: string; userId: string; onClose: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setErr('Pilih foto dulu.'); return; }
    setBusy(true);
    setErr('');
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setErr('Hanya gambar atau video.'); return; }
        if (f.size > 20 * 1024 * 1024) { setErr('Maksimal 20MB per file.'); return; }
        const id = crypto.randomUUID();
        const ext = f.name.split('.').pop() || 'jpg';
        const path = userId + '/' + id + '.' + ext;
        const { error: upErr } = await supabase.storage.from('gallery').upload(path, f, { upsert: true });
        if (upErr) { setErr('Upload gagal: ' + upErr.message); return; }
        const url = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl;
        const { error: dbErr } = await supabase.from('gallery_media').insert({
          album_id: albumId,
          user_id: userId,
          media_url: url,
          media_type: f.type.startsWith('video/') ? 'video' : 'image',
          caption: f.name,
        });
        if (dbErr) { setErr(dbErr.message); return; }
      }
      router.refresh();
      onClose();
    } catch {
      setErr('Gagal mengunggah.');
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Tambah Foto</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          ref={fileRef}
          className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
        />
        <button
          onClick={upload}
          disabled={busy}
          className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Mengunggah...' : 'Unggah'}
        </button>
      </div>
    </div>
  );
}
`);

wf('components/gallery/GalleryAlbum.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { deleteAlbum } from '@/lib/auth/gallery-actions';
import { Upload, Trash2 } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff }: { album: any; userId: string; isStaff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);

  async function remove() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus dari galeri.')) return;
    const res = await deleteAlbum(album.id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">{album.name}</h2>
          {album.description && <p className="text-sm text-gray-400">{album.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
          >
            <Upload className="h-3 w-3" />
            Tambah Foto
          </button>
          {isStaff && (
            <button onClick={remove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus album">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Album kosong. Tambah foto pertama!</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {media.map((m: any, i: number) => (
            <button key={m.id} onClick={() => setOpen(i)} className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]">
              {m.media_type === 'video' ? (
                <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-40 object-cover" />
              ) : (
                <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-40 object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} userId={userId} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
`);

wf('app/gallery/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import GalleryAlbum from '@/components/gallery/GalleryAlbum';
import CreateAlbumForm from '@/components/gallery/CreateAlbumForm';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';
  const { data: albums } = await supabase
    .from('gallery_albums')
    .select('*, gallery_media(id, media_url, media_type, caption)')
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Galeri Kelas</h1>
          {isStaff && <CreateAlbumForm />}
        </div>

        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>{isStaff ? 'Belum ada album. Buat album pertama!' : 'Belum ada album. Tunggu admin membuat album.'}</p>
          </div>
        ) : (
          (albums ?? []).map((a: any) => (
            <GalleryAlbum key={a.id} album={a} userId={user.id} isStaff={isStaff} />
          ))
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part N done: gallery albums + upload + lightbox');

// === PART N2: FIX CREATE ALBUM TRANSPARAN ===

wf('lib/auth/gallery-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createAlbum(formData: FormData) {
  await requireRole('teacher');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('gallery_albums')
    .insert({ name, description: description || null })
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Insert gagal tanpa pesan (0 baris).' };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
`);

wf('components/gallery/CreateAlbumForm.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAlbum } from '@/lib/auth/gallery-actions';
import { Plus, X } from 'lucide-react';

export default function CreateAlbumForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const res = await createAlbum(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setShow(false);
        router.refresh();
      }
    } catch (e: any) {
      console.error('createAlbum error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal membuat album'));
    }
    setBusy(false);
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16]"
      >
        <Plus className="h-4 w-4" />
        Album Baru
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3 w-full"
    >
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      <input
        name="name"
        required
        placeholder="Nama album (mis. Kegiatan Kelas)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="description"
        placeholder="Deskripsi (opsional)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold disabled:opacity-50">
          {busy ? 'Membuat...' : 'Buat Album'}
        </button>
        <button type="button" onClick={() => setShow(false)} className="px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
`);

console.log('[OK] Part N2 done: create album transparan');

// === PART N3: GALLERY ROBUST + ERROR VISIBLE ===

wf('app/gallery/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import GalleryAlbum from '@/components/gallery/GalleryAlbum';
import CreateAlbumForm from '@/components/gallery/CreateAlbumForm';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';

  const [{ data: albums, error: errAlbums }, { data: media, error: errMedia }] = await Promise.all([
    supabase.from('gallery_albums').select('*').order('created_at', { ascending: false }),
    supabase.from('gallery_media').select('*').order('created_at'),
  ]);

  const mediaByAlbum: Record<string, any[]> = {};
  for (const m of media ?? []) {
    if (!mediaByAlbum[m.album_id]) mediaByAlbum[m.album_id] = [];
    mediaByAlbum[m.album_id].push(m);
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {(errAlbums || errMedia) && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">
            {errAlbums ? 'Error album: ' + errAlbums.message : 'Error media: ' + (errMedia ? errMedia.message : '')}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Galeri Kelas</h1>
          {isStaff && <CreateAlbumForm />}
        </div>

        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>{isStaff ? 'Belum ada album. Buat album pertama!' : 'Belum ada album. Tunggu admin membuat album.'}</p>
          </div>
        ) : (
          (albums ?? []).map((a: any) => (
            <GalleryAlbum
              key={a.id}
              album={{ ...a, gallery_media: mediaByAlbum[a.id] ?? [] }}
              userId={user.id}
              isStaff={isStaff}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part N3 done: gallery robust + error visible');

// === PART N4: MASONRY NO-CROP ===

wf('components/gallery/GalleryAlbum.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { deleteAlbum } from '@/lib/auth/gallery-actions';
import { Upload, Trash2 } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff }: { album: any; userId: string; isStaff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);

  async function remove() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus dari galeri.')) return;
    const res = await deleteAlbum(album.id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">{album.name}</h2>
          {album.description && <p className="text-sm text-gray-400">{album.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
          >
            <Upload className="h-3 w-3" />
            Tambah Foto
          </button>
          {isStaff && (
            <button onClick={remove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus album">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Album kosong. Tambah foto pertama!</p>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <button
              key={m.id}
              onClick={() => setOpen(i)}
              className="mb-2 w-full rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] break-inside-avoid"
              aria-label="Lihat detail"
            >
              {m.media_type === 'video' ? (
                <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto" />
              ) : (
                <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto" />
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} userId={userId} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
`);

wf('components/feed/PostMedia.tsx', `'use client';
import { useState } from 'react';
import Lightbox from './Lightbox';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="columns-2 gap-2 mb-3">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="mb-2 w-full rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] break-inside-avoid"
            aria-label="Lihat detail"
          >
            {isVideo(url) ? (
              <video src={url} muted preload="metadata" playsInline className="w-full h-auto" />
            ) : (
              <img src={url} alt="" loading="lazy" className="w-full h-auto" />
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
`);

console.log('[OK] Part N4 done: masonry no-crop gallery + feed');

// === PART N5: FEED CAROUSEL ===

wf('app/globals.css', `@import "tailwindcss";

@theme {
  --font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

html, body {
  background-color: #0a0a0a;
  color: #ffffff;
  font-family: var(--font-sans);
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 4px; }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`);

wf('components/feed/PostMedia.tsx', `'use client';
import { useRef, useState } from 'react';
import Lightbox from './Lightbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="relative mb-3">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] no-scrollbar"
        >
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setOpen(i)}
              className="snap-center shrink-0 w-full"
              aria-label="Lihat detail"
            >
              {isVideo(url) ? (
                <video src={url} muted preload="metadata" playsInline className="w-full h-auto max-h-[520px] object-contain" />
              ) : (
                <img src={url} alt="" loading="lazy" className="w-full h-auto max-h-[520px] object-contain" />
              )}
            </button>
          ))}
        </div>

        {idx > 0 && (
          <button
            onClick={() => go(idx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < urls.length - 1 && (
          <button
            onClick={() => go(idx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
          {idx + 1}/{urls.length}
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <div
              key={i}
              className={'h-1.5 rounded-full transition-all ' + (i === idx ? 'w-4 bg-[#a3e635]' : 'w-1.5 bg-white/40')}
            />
          ))}
        </div>
      </div>

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
`);

console.log('[OK] Part N5 done: feed carousel swipe + dots + counter');

// === PART N6: MEDIA CARD MAX-W ===

wf('components/feed/PostMedia.tsx', `'use client';
import { useRef, useState } from 'react';
import Lightbox from './Lightbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="relative mb-3 mx-auto w-full max-w-md">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] no-scrollbar"
        >
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setOpen(i)}
              className="snap-center shrink-0 w-full"
              aria-label="Lihat detail"
            >
              {isVideo(url) ? (
                <video src={url} muted preload="metadata" playsInline className="w-full h-auto max-h-[520px] object-contain" />
              ) : (
                <img src={url} alt="" loading="lazy" className="w-full h-auto max-h-[520px] object-contain" />
              )}
            </button>
          ))}
        </div>

        {idx > 0 && (
          <button
            onClick={() => go(idx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < urls.length - 1 && (
          <button
            onClick={() => go(idx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
          {idx + 1}/{urls.length}
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <div
              key={i}
              className={'h-1.5 rounded-full transition-all ' + (i === idx ? 'w-4 bg-[#a3e635]' : 'w-1.5 bg-white/40')}
            />
          ))}
        </div>
      </div>

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
`);

console.log('[OK] Part N6 done: media card max-w, no empty sides');

// === PART O: MANAJEMEN JADWAL + PENGUMUMAN ===

wf('lib/auth/content-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createSchedule(formData: FormData) {
  await requireRole('teacher');
  const day_of_week = Number(formData.get('day_of_week'));
  const start_time = String(formData.get('start_time') || '');
  const end_time = String(formData.get('end_time') || '');
  const subject = String(formData.get('subject') || '').trim();
  const room = String(formData.get('room') || '').trim();
  if (!day_of_week || !start_time || !end_time || !subject) return { error: 'Hari, jam, dan mapel wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').insert({
    day_of_week,
    start_time,
    end_time,
    subject,
    room: room || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteSchedule(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function createAnnouncement(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const content = String(formData.get('content') || '').trim();
  const is_pinned = formData.get('is_pinned') === 'on';
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').insert({
    author_id: user.id,
    title,
    content,
    is_pinned,
    is_published: true,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function togglePin(id: string, pinned: boolean) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').update({ is_pinned: pinned }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
`);

wf('components/admin/ScheduleManager.tsx', `'use client';
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
        className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 grid md:grid-cols-5 gap-3"
      >
        <select name="day_of_week" className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50">
          {DAYS.map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
        <input name="start_time" type="time" required className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        <input name="end_time" type="time" required className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        <input name="subject" required placeholder="Mapel" className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        <input name="room" placeholder="Ruang (opsional)" className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        <button type="submit" disabled={busy} className="md:col-span-5 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
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
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{day}</div>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#161616] border border-[#2a2a2a]">
                    <div className="text-sm font-bold text-[#a3e635] min-w-[100px]">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </div>
                    <div className="flex-1 text-sm text-white">
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
`);

wf('components/admin/AnnouncementManager.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAnnouncement, deleteAnnouncement, togglePin } from '@/lib/auth/content-actions';
import { Trash2, Pin, PinOff, Plus } from 'lucide-react';

export default function AnnouncementManager({ announcements }: { announcements: any[] }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await createAnnouncement(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus pengumuman ini?')) return;
    const res = await deleteAnnouncement(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function pin(id: string, pinned: boolean) {
    const res = await togglePin(id, !pinned);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
        className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3"
      >
        <input name="title" required placeholder="Judul pengumuman" className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50" />
        <textarea name="content" required rows={3} placeholder="Isi pengumuman..." className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50 resize-none" />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input name="is_pinned" type="checkbox" className="accent-[#a3e635]" />
          Pin di atas
        </label>
        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {busy ? 'Menyimpan...' : 'Terbitkan Pengumuman'}
        </button>
        {err && <div className="text-xs text-red-400">{err}</div>}
      </form>

      <div className="space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="p-3 rounded-xl bg-[#161616] border border-[#2a2a2a]">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm text-white">{a.is_pinned ? '📌 ' : ''}{a.title}</div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => pin(a.id, a.is_pinned)} className="p-1.5 text-gray-400 hover:text-white rounded-lg" aria-label="Pin">
                  {a.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(a.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`);

wf('app/admin/content/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ScheduleManager from '@/components/admin/ScheduleManager';
import AnnouncementManager from '@/components/admin/AnnouncementManager';
import { Calendar, Megaphone } from 'lucide-react';

export default async function AdminContentPage() {
  const user = await requireRole('teacher');
  const supabase = await createClient();
  const [{ data: schedules }, { data: announcements }] = await Promise.all([
    supabase.from('schedules').select('*').order('day_of_week').order('start_time'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
            <Calendar className="h-6 w-6 text-[#a3e635]" />
            Jadwal Pelajaran
          </h1>
          <ScheduleManager schedules={schedules ?? []} />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
            <Megaphone className="h-6 w-6 text-[#fb923c]" />
            Pengumuman
          </h1>
          <AnnouncementManager announcements={announcements ?? []} />
        </div>
      </div>
    </AppLayout>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2 } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
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
  const mobileItems = [baseItems[0], baseItems[1], baseItems[2], baseItems[7]];

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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {mobileItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
`);

console.log('[OK] Part O done: manajemen jadwal + pengumuman via UI');

// === PART P: NOTIFIKASI OTOMATIS + BADGE ===

wf('components/NotifBadge.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function NotifBadge({ userId }: { userId: string }) {
  const supabase = createClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setCount(count ?? 0);
    })();
  }, [userId]);

  if (count === 0) return null;
  return (
    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#a3e635] text-[#0a0a0a] text-[10px] font-bold">
      {count}
    </span>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2 } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import NotifBadge from '@/components/NotifBadge';
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
  const mobileItems = [baseItems[0], baseItems[1], baseItems[2], baseItems[6]];

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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {mobileItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] flex items-center gap-1">
                {item.label}
                {item.href === '/notifications' && <NotifBadge userId={profile.user_id} />}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
`);

wf('components/feed/LikeButton.tsx', `'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

export default function LikeButton({ postId, userId, initialCount, initialLiked, ownerId, actorName }: { postId: string; userId: string; initialCount: number; initialLiked: boolean; ownerId: string; actorName: string }) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase.from('likes').delete().eq('user_id', userId).eq('target_type', 'post').eq('target_id', postId);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      await supabase.from('likes').insert({ user_id: userId, target_type: 'post', target_id: postId });
      if (ownerId !== userId) {
        await supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'like',
          title: actorName + ' menyukai postinganmu',
          actor_id: userId,
          target_type: 'post',
          target_id: postId,
        });
      }
    }
  }

  return (
    <button onClick={toggle} className={'flex items-center gap-2 text-sm transition ' + (liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400')}>
      <Heart className={'h-5 w-5 ' + (liked ? 'fill-red-400' : '')} />
      <span>{count}</span>
    </button>
  );
}
`);

wf('components/feed/CommentsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose, postOwnerId, actorName }: { postId: string; userId: string; onClose: () => void; postOwnerId: string; actorName: string }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    const target = replyTo ? replyTo.user_id : postOwnerId;
    if (target && target !== userId) {
      await supabase.from('notifications').insert({
        user_id: target,
        type: 'comment',
        title: actorName + (replyTo ? ' membalas komentarmu' : ' mengomentari postinganmu'),
        actor_id: userId,
        target_type: 'post',
        target_id: postId,
      });
    }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) load();
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Komentar</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Belum ada komentar. Mulai diskusi!</p>
          ) : (
            top.map((c) => (
              <div key={c.id}>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="text-xs font-semibold mb-0.5 text-white">{c.profiles?.full_name}</div>
                      <div className="text-sm whitespace-pre-wrap text-gray-200">{c.content}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-gray-500">
                      <button onClick={() => setReplyTo(c)} className="hover:text-white">Balas</button>
                      {c.user_id === userId && (
                        <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-11 mt-2 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                        {(r.profiles?.full_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                          <div className="text-xs font-semibold mb-0.5 text-white">{r.profiles?.full_name}</div>
                          <div className="text-sm whitespace-pre-wrap text-gray-200">{r.content}</div>
                        </div>
                        {r.user_id === userId && (
                          <div className="ml-2 mt-1">
                            <button onClick={() => del(r.id)} className="text-xs text-red-400">Hapus</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-[#2a2a2a]">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2 rounded-full bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button onClick={submit} disabled={!text.trim()} className="p-2 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30" aria-label="Kirim">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

wf('components/feed/CommentButton.tsx', `'use client';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import CommentsSheet from './CommentsSheet';

export default function CommentButton({ postId, userId, count, postOwnerId, actorName }: { postId: string; userId: string; count: number; postOwnerId: string; actorName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
        <MessageCircle className="h-5 w-5" />
        <span>{count}</span>
      </button>
      {open && (
        <CommentsSheet
          postId={postId}
          userId={userId}
          onClose={() => setOpen(false)}
          postOwnerId={postOwnerId}
          actorName={actorName}
        />
      )}
    </>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import PostMedia from '@/components/feed/PostMedia';
import StoryBar from '@/components/feed/StoryBar';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <StoryBar userId={user.id} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{post.profiles?.username}</div>
                  </div>
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                    ownerId={post.user_id}
                    actorName={user.profile.full_name}
                  />
                  <CommentButton
                    postId={post.id}
                    userId={user.id}
                    count={commentCounts[post.id] ?? 0}
                    postOwnerId={post.user_id}
                    actorName={user.profile.full_name}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

wf('lib/auth/task-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_FILE = 50 * 1024 * 1024;

export async function createTask(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const taskId = randomUUID();
  let attachment_url: string | null = null;

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 50MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = user.id + '/' + taskId + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await admin.from('tasks').insert({
    id: taskId,
    created_by: user.id,
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
    attachment_url,
    status: 'active',
  });
  if (error) return { error: error.message };

  const { data: members } = await admin.from('profiles').select('user_id').neq('user_id', user.id);
  const notifs = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: 'task',
    title: 'Tugas baru: ' + title,
    message: subject || null,
    actor_id: user.id,
    target_type: 'task',
    target_id: taskId,
  }));
  if (notifs.length > 0) await admin.from('notifications').insert(notifs);

  revalidatePath('/tasks');
  return { success: true };
}

export async function submitTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get('task_id') || '');
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Pilih file jawaban dulu.' };
  if (file.size > MAX_FILE) return { error: 'File maksimal 50MB.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return { error: 'Kamu sudah mengumpulkan tugas ini.' };

  const { data: task } = await admin.from('tasks').select('deadline, created_by, title').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Tugas tidak ditemukan.' };
  const late = new Date(task.deadline) < new Date();

  const ext = file.name.split('.').pop() || 'bin';
  const path = user.id + '/' + taskId + '/submission.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('tasks')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await admin.from('task_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    file_url: url,
    file_name: file.name,
    status: late ? 'late' : 'submitted',
  });
  if (dbErr) return { error: dbErr.message };

  if (task.created_by && task.created_by !== user.id) {
    await admin.from('notifications').insert({
      user_id: task.created_by,
      type: 'submission',
      title: user.profile.full_name + ' mengumpulkan tugas: ' + task.title,
      actor_id: user.id,
      target_type: 'task',
      target_id: taskId,
    });
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  const user = await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (!id) return { error: 'ID submission kosong.' };
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };

  const admin = createAdminClient();
  const { data: sub } = await admin.from('task_submissions').select('user_id').eq('id', id).maybeSingle();

  const { data, error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: '0 baris terupdate — submission tidak ketemu.' };

  if (sub && sub.user_id !== user.id) {
    await admin.from('notifications').insert({
      user_id: sub.user_id,
      type: 'grade',
      title: 'Nilai baru: ' + grade,
      message: feedback || null,
      actor_id: user.id,
      target_type: 'task_submission',
      target_id: id,
    });
  }

  revalidatePath('/tasks');
  return { success: true };
}
`);

wf('lib/auth/content-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createSchedule(formData: FormData) {
  await requireRole('teacher');
  const day_of_week = Number(formData.get('day_of_week'));
  const start_time = String(formData.get('start_time') || '');
  const end_time = String(formData.get('end_time') || '');
  const subject = String(formData.get('subject') || '').trim();
  const room = String(formData.get('room') || '').trim();
  if (!day_of_week || !start_time || !end_time || !subject) return { error: 'Hari, jam, dan mapel wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').insert({
    day_of_week,
    start_time,
    end_time,
    subject,
    room: room || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteSchedule(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function createAnnouncement(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const content = String(formData.get('content') || '').trim();
  const is_pinned = formData.get('is_pinned') === 'on';
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('announcements')
    .insert({ author_id: user.id, title, content, is_pinned, is_published: true })
    .select('id');
  if (error) return { error: error.message };

  const { data: members } = await admin.from('profiles').select('user_id').neq('user_id', user.id);
  const notifs = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: 'announcement',
    title: 'Pengumuman: ' + title,
    actor_id: user.id,
    target_type: 'announcement',
    target_id: data && data.length > 0 ? data[0].id : null,
  }));
  if (notifs.length > 0) await admin.from('notifications').insert(notifs);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function togglePin(id: string, pinned: boolean) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').update({ is_pinned: pinned }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
`);

console.log('[OK] Part P done: notifikasi otomatis + badge unread');

// === PART P2: NOTIFICATIONS PAGE + LAYOUT ===

wf('components/notifications/NotificationsClient.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      setItems(data ?? []);
    })();
  }, [userId]);

  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifikasi</h1>
        <button onClick={markAll} className="flex items-center gap-1 text-xs text-[#a3e635] hover:underline">
          <CheckCheck className="h-4 w-4" />
          Tandai semua dibaca
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bell className="h-12 w-12 mx-auto mb-4" />
          <p>Belum ada notifikasi</p>
        </div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={'p-3 rounded-xl border ' + (n.is_read ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-[#a3e635]/5 border-[#a3e635]/30')}
          >
            <div className="text-sm font-semibold text-white">{n.title}</div>
            {n.message && <p className="text-sm text-gray-300 mt-0.5">{n.message}</p>}
            <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
          </div>
        ))
      )}
    </div>
  );
}
`);

wf('app/notifications/page.tsx', `import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import NotificationsClient from '@/components/notifications/NotificationsClient';

export default async function NotificationsPage() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <NotificationsClient userId={user.id} />
    </AppLayout>
  );
}
`);

console.log('[OK] Part P2 done: notifications page pakai layout');

// === PART Q: PWA (MANIFEST + ICON + SERVICE WORKER) ===

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function makeIcon(size) {
  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * rowBytes + 1 + x * 4;
      let r = 10, g = 10, b = 10;
      const cx = size / 2, cy = size / 2;
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const ringOuter = size * 0.34, ringInner = size * 0.24;
      if (dist <= ringOuter && dist >= ringInner) { r = 163; g = 230; b = 53; }
      if (dist < size * 0.10) { r = 163; g = 230; b = 53; }
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

if (!fs.existsSync('public/icons')) fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', makeIcon(192));
fs.writeFileSync('public/icons/icon-512.png', makeIcon(512));
console.log('[OK] public/icons/icon-192.png + icon-512.png (generated)');

wf('app/manifest.ts', `import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClassHub',
    short_name: 'ClassHub',
    description: 'Aplikasi kelas kamu',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
`);

wf('public/sw.js', `self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open('classhub-v1').then(function (c) {
          c.put(e.request, copy);
        }).catch(function () {});
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
`);

wf('components/SWRegister.tsx', `'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
  }, []);
  return null;
}
`);

wf('app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';
import SWRegister from '@/components/SWRegister';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
`);

console.log('[OK] Part Q done: PWA manifest + icons + service worker');

// === PART Q2: MANIFEST src NOT url ===

wf('app/manifest.ts', `import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClassHub',
    short_name: 'ClassHub',
    description: 'Aplikasi kelas kamu',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
`);

console.log('[OK] Part Q2 done: manifest src');

// === PART Q3: MOBILE NAV LENGKAP + DRAWER ===

wf('components/layout/MobileNav.tsx', `'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import NotifBadge from '@/components/NotifBadge';

type NavItem = { href: string; label: string; icon: any };

export default function MobileNav({ items, userId }: { items: NavItem[]; userId: string }) {
  const [open, setOpen] = useState(false);
  const notif = items.find((i) => i.href === '/notifications');
  const bar = [items[0], items[1], items[2], notif].filter(Boolean) as NavItem[];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#2a2a2a]">
        <div className="flex items-center justify-around h-16">
          {bar.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-gray-400">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] flex items-center gap-1">
                {item.label}
                {item.href === '/notifications' && <NotifBadge userId={userId} />}
              </span>
            </Link>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 text-gray-400" aria-label="Menu">
            <Menu className="h-6 w-6" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-[#0f0f0f] border-l border-[#2a2a2a] p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-white">
                Class<span className="text-[#a3e635]">Hub</span>
              </span>
              <button onClick={() => setOpen(false)} className="p-2 text-gray-400" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#2a2a2a]"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {item.href === '/notifications' && <NotifBadge userId={userId} />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
`);

wf('components/layout/AppLayout.tsx', `import Link from 'next/link';
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
`);

console.log('[OK] Part Q3 done: mobile nav + drawer menu lengkap');

// === PART Q4: APP LAYOUT AS CLIENT COMPONENT ===

wf('components/layout/AppLayout.tsx', `'use client';
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
`);

console.log('[OK] Part Q4 done: AppLayout as client component');

// === PART R: CHAT ATTACHMENTS ===

wf('app/chat/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ChatRoom from '@/components/chat/ChatRoom';

export default async function ChatPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: messages }, { data: profs }] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('id, user_id, content, media_url, media_type, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('user_id, full_name'),
  ]);

  const names: Record<string, string> = {};
  for (const p of profs ?? []) names[p.user_id] = p.full_name;
  const initial = (messages ?? []).reverse();

  return (
    <AppLayout profile={user.profile}>
      <ChatRoom userId={user.id} initial={initial} names={names} />
    </AppLayout>
  );
}
`);

wf('components/chat/ChatRoom.tsx', `'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, MessageCircle, Image as ImageIcon, X } from 'lucide-react';
import Lightbox from '@/components/feed/Lightbox';

type Msg = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
};

export default function ChatRoom({ userId, initial, names }: { userId: string; initial: Msg[]; names: Record<string, string> }) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    setErr('');
    try {
      let media_url: string | null = null;
      if (pendingFile) {
        if (!pendingFile.type.startsWith('image/')) { setErr('Hanya file gambar.'); setSending(false); return; }
        if (pendingFile.size > 10 * 1024 * 1024) { setErr('Foto maksimal 10MB.'); setSending(false); return; }
        const id = crypto.randomUUID();
        const ext = pendingFile.name.split('.').pop() || 'jpg';
        const path = userId + '/' + id + '.' + ext;
        const { error: upErr } = await supabase.storage.from('chat').upload(path, pendingFile, { upsert: true });
        if (upErr) { setErr('Upload gagal: ' + upErr.message); setSending(false); return; }
        media_url = supabase.storage.from('chat').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('chat_messages').insert({
        user_id: userId,
        content: text.trim() || null,
        media_url,
        media_type: media_url ? 'image' : null,
      });
      if (error) { setErr('Gagal kirim: ' + error.message); setSending(false); return; }
      setText('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setErr('Terjadi kesalahan.');
    }
    setSending(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a]">
          <MessageCircle className="h-5 w-5 text-[#a3e635]" />
          <div>
            <div className="font-semibold text-white text-sm">Chat Kelas</div>
            <div className="text-xs text-gray-500">Realtime • semua anggota</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Belum ada pesan. Sapa kelas lu!</p>
          )}
          {messages.map((m) => {
            const own = m.user_id === userId;
            return (
              <div key={m.id} className={'flex ' + (own ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-3 py-2 ' +
                    (own ? 'bg-[#a3e635] text-[#0a0a0a] rounded-br-sm' : 'bg-[#0f0f0f] border border-[#2a2a2a] rounded-bl-sm')
                  }
                >
                  {!own && (
                    <div className="text-xs font-semibold mb-0.5 text-[#a3e635]">
                      {names[m.user_id] || 'Warga Kelas'}
                    </div>
                  )}
                  {m.media_url && (
                    <button onClick={() => setLightbox(m.media_url)} className="block mb-1 rounded-xl overflow-hidden" aria-label="Lihat foto">
                      <img src={m.media_url} alt="" loading="lazy" className="max-h-64 w-full object-contain rounded-xl" />
                    </button>
                  )}
                  {m.content && <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>}
                  <div className={'text-[10px] mt-1 ' + (own ? 'text-[#0a0a0a]/60' : 'text-gray-500')}>
                    {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[#2a2a2a]">
          {err && <div className="text-xs text-red-400 mb-2">{err}</div>}
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-300">
              <ImageIcon className="h-4 w-4 text-[#a3e635]" />
              <span className="truncate">{pendingFile.name}</span>
              <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-gray-500 hover:text-white" aria-label="Hapus foto">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-gray-400 hover:text-white"
              aria-label="Kirim foto"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tulis pesan..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button
              onClick={send}
              disabled={!text.trim() && !pendingFile ? true : sending}
              className="p-2.5 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30"
              aria-label="Kirim pesan"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox urls={[lightbox]} index={0} onClose={() => setLightbox(null)} />}
    </div>
  );
}
`);

console.log('[OK] Part R done: chat kirim foto + lightbox');

// === PART S: MODERASI ===

wf('lib/auth/moderation-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function hidePost(postId: string, hidden: boolean) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').update({ is_hidden: hidden }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/admin/moderation');
  return { success: true };
}

export async function deletePost(postId: string) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').delete().eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  return { success: true };
}

export async function deleteCommentAdmin(commentId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('comments').delete().eq('id', commentId);
  if (error) return { error: error.message };
  return { success: true };
}
`);

wf('components/feed/PostModMenu.tsx', `'use client';
import { useRouter } from 'next/navigation';
import { hidePost, deletePost } from '@/lib/auth/moderation-actions';
import { EyeOff, Trash2 } from 'lucide-react';

export default function PostModMenu({ postId, canDelete }: { postId: string; canDelete: boolean }) {
  const router = useRouter();

  async function hide() {
    if (!window.confirm('Sembunyikan postingan ini dari feed?')) return;
    const res = await hidePost(postId, true);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Hapus postingan ini permanen?')) return;
    const res = await deletePost(postId);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={hide} className="p-1.5 text-gray-500 hover:text-white" aria-label="Sembunyikan postingan">
        <EyeOff className="h-4 w-4" />
      </button>
      {canDelete && (
        <button onClick={remove} className="p-1.5 text-gray-500 hover:text-red-400" aria-label="Hapus postingan">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
`);

wf('components/admin/ModerationList.tsx', `'use client';
import { useRouter } from 'next/navigation';
import { hidePost } from '@/lib/auth/moderation-actions';
import { Eye, ShieldAlert } from 'lucide-react';

export default function ModerationList({ posts }: { posts: any[] }) {
  const router = useRouter();

  async function unhide(id: string) {
    const res = await hidePost(id, false);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="h-6 w-6 text-[#fb923c]" />
        Moderasi
      </h1>
      <p className="text-sm text-gray-400">Postingan yang disembunyikan dari feed kelas.</p>
      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Tidak ada postingan tersembunyi.</div>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="p-3 rounded-xl bg-[#161616] border border-[#2a2a2a]">
            <div className="text-xs text-gray-400 mb-1">
              {p.profiles?.full_name} @{p.profiles?.username}
            </div>
            {p.content && <p className="text-sm text-gray-200 whitespace-pre-wrap">{p.content}</p>}
            {p.media_urls && p.media_urls.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{p.media_urls.length} media</p>
            )}
            <button
              onClick={() => unhide(p.id)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2a2a2a] text-white text-xs font-semibold hover:bg-[#3a3a3a]"
            >
              <Eye className="h-3 w-3" />
              Tampilkan lagi
            </button>
          </div>
        ))
      )}
    </div>
  );
}
`);

wf('app/admin/moderation/page.tsx', `import { requireRole } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import ModerationList from '@/components/admin/ModerationList';

export default async function ModerationPage() {
  const user = await requireRole('teacher');
  const admin = createAdminClient();
  const { data: hiddenPosts } = await admin
    .from('posts')
    .select('*, profiles(full_name, username)')
    .eq('is_hidden', true)
    .order('created_at', { ascending: false });

  return (
    <AppLayout profile={user.profile}>
      <ModerationList posts={hiddenPosts ?? []} />
    </AppLayout>
  );
}
`);

wf('components/layout/AppLayout.tsx', `'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2, ShieldAlert } from 'lucide-react';
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
  if (profile.role !== 'student') {
    extra.push({ href: '/admin/content', icon: Settings2, label: 'Konten' });
    extra.push({ href: '/admin/moderation', icon: ShieldAlert, label: 'Moderasi' });
  }
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
`);

wf('components/feed/CommentsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteCommentAdmin } from '@/lib/auth/moderation-actions';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose, postOwnerId, actorName, isStaff }: { postId: string; userId: string; onClose: () => void; postOwnerId: string; actorName: string; isStaff: boolean }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    const target = replyTo ? replyTo.user_id : postOwnerId;
    if (target && target !== userId) {
      await supabase.from('notifications').insert({
        user_id: target,
        type: 'comment',
        title: actorName + (replyTo ? ' membalas komentarmu' : ' mengomentari postinganmu'),
        actor_id: userId,
        target_type: 'post',
        target_id: postId,
      });
    }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string, ownerId: string) {
    if (ownerId === userId) {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (!error) load();
    } else {
      const res = await deleteCommentAdmin(id);
      if (res && res.error) setErr('Gagal hapus: ' + res.error);
      else load();
    }
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
      <div className="bg-[#0f0f0f] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">Komentar</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Belum ada komentar. Mulai diskusi!</p>
          ) : (
            top.map((c) => (
              <div key={c.id}>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="text-xs font-semibold mb-0.5 text-white">{c.profiles?.full_name}</div>
                      <div className="text-sm whitespace-pre-wrap text-gray-200">{c.content}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-gray-500">
                      <button onClick={() => setReplyTo(c)} className="hover:text-white">Balas</button>
                      {(c.user_id === userId || isStaff) && (
                        <button onClick={() => del(c.id, c.user_id)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-11 mt-2 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-[#3a3a3a] flex items-center justify-center text-xs font-bold shrink-0">
                        {(r.profiles?.full_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                          <div className="text-xs font-semibold mb-0.5 text-white">{r.profiles?.full_name}</div>
                          <div className="text-sm whitespace-pre-wrap text-gray-200">{r.content}</div>
                        </div>
                        {(r.user_id === userId || isStaff) && (
                          <div className="ml-2 mt-1">
                            <button onClick={() => del(r.id, r.user_id)} className="text-xs text-red-400">Hapus</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-[#2a2a2a]">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2 rounded-full bg-[#161616] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
            />
            <button onClick={submit} disabled={!text.trim()} className="p-2 rounded-full bg-[#a3e635] text-[#0a0a0a] disabled:opacity-30" aria-label="Kirim">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

wf('components/feed/CommentButton.tsx', `'use client';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import CommentsSheet from './CommentsSheet';

export default function CommentButton({ postId, userId, count, postOwnerId, actorName, isStaff }: { postId: string; userId: string; count: number; postOwnerId: string; actorName: string; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
        <MessageCircle className="h-5 w-5" />
        <span>{count}</span>
      </button>
      {open && (
        <CommentsSheet
          postId={postId}
          userId={userId}
          onClose={() => setOpen(false)}
          postOwnerId={postOwnerId}
          actorName={actorName}
          isStaff={isStaff}
        />
      )}
    </>
  );
}
`);

wf('app/feed/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import PostMedia from '@/components/feed/PostMedia';
import StoryBar from '@/components/feed/StoryBar';
import PostModMenu from '@/components/feed/PostModMenu';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';
  const isAdmin = user.profile.role === 'admin';
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <StoryBar userId={user.id} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-medium hover:bg-[#84cc16] transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-[#3a3a3a] flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-gray-400">@{post.profiles?.username}</div>
                  </div>
                  {isStaff && <PostModMenu postId={post.id} canDelete={isAdmin} />}
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
                <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                    ownerId={post.user_id}
                    actorName={user.profile.full_name}
                  />
                  <CommentButton
                    postId={post.id}
                    userId={user.id}
                    count={commentCounts[post.id] ?? 0}
                    postOwnerId={post.user_id}
                    actorName={user.profile.full_name}
                    isStaff={isStaff}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part S done: moderasi - hide/delete post, delete komentar, halaman moderasi');

// === PART T: IDENTITAS KELAS ===

wf('lib/auth/settings-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function saveClassSettings(formData: FormData) {
  await requireRole('admin');
  const class_name = String(formData.get('class_name') || '').trim();
  const subtitle = String(formData.get('subtitle') || '').trim();
  if (!class_name) return { error: 'Nama kelas wajib diisi.' };
  const admin = createAdminClient();

  let logo_url: string | null = null;
  const file = formData.get('logo') as File | null;
  if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'Logo harus gambar.' };
    if (file.size > 2 * 1024 * 1024) return { error: 'Logo maksimal 2MB.' };
    const ext = file.name.split('.').pop() || 'png';
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload('class/logo.' + ext, buf, { contentType: file.type || 'image/png', upsert: true });
    if (upErr) return { error: 'Upload logo gagal: ' + upErr.message };
    logo_url = admin.storage.from('avatars').getPublicUrl('class/logo.' + ext).data.publicUrl;
  }

  const { data: existing } = await admin.from('class_settings').select('id').limit(1).maybeSingle();
  const payload: any = { class_name, subtitle: subtitle || null };
  if (logo_url) payload.logo_url = logo_url;
  const { error } = existing
    ? await admin.from('class_settings').update(payload).eq('id', existing.id)
    : await admin.from('class_settings').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
`);

wf('components/ClassBrand.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ClassBrand({ size }: { size: 'lg' | 'sm' }) {
  const supabase = createClient();
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('class_settings').select('*').limit(1).maybeSingle();
      setS(data || null);
    })();
  }, []);

  if (size === 'sm') {
    return (
      <span className="text-lg font-bold text-white flex items-center gap-2">
        {s?.logo_url ? <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
        {s?.class_name ? <span>{s.class_name}</span> : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {s?.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-[#2a2a2a]" />}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white truncate">
          {s?.class_name ? s.class_name : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{s?.subtitle || 'Kelas kamu, satu aplikasi'}</p>
      </div>
    </div>
  );
}
`);

wf('components/admin/ClassSettingsForm.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClassSettings } from '@/lib/auth/settings-actions';

export default function ClassSettingsForm({ initial }: { initial: any }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await saveClassSettings(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-white">Identitas Kelas</h2>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <input
        name="class_name"
        defaultValue={initial?.class_name || ''}
        required
        placeholder="Nama kelas (mis. XII SAINSTECH 2)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="subtitle"
        defaultValue={initial?.subtitle || ''}
        placeholder="Subtitle (mis. nama sekolah)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="logo"
        type="file"
        accept="image/*"
        className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
      />
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
`);

wf('app/admin/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ClassSettingsForm from '@/components/admin/ClassSettingsForm';
import { Users, Newspaper, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const [{ count: memberCount }, { count: postCount }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('class_settings').select('*').limit(1),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#a3e635]" />
          Panel Admin
        </h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Users className="h-5 w-5 text-[#a3e635] mb-2" />
            <div className="text-xs text-gray-400">Total Anggota</div>
            <div className="text-2xl font-bold">{memberCount ?? 0}</div>
          </div>
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Newspaper className="h-5 w-5 text-[#fb923c] mb-2" />
            <div className="text-xs text-gray-400">Total Post</div>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
          </div>
        </div>
        <Link href="/admin/users" className="block p-4 rounded-2xl bg-[#a3e635] text-[#0a0a0a] font-semibold hover:bg-[#84cc16] transition">
          Kelola Anggota → buat akun, ubah role, ban
        </Link>
        <ClassSettingsForm initial={settings && settings.length > 0 ? settings[0] : null} />
      </div>
    </AppLayout>
  );
}
`);

wf('components/layout/AppLayout.tsx', `'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, LogOut, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2, ShieldAlert } from 'lucide-react';
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
  ];
  const extra: typeof baseItems = [];
  if (profile.role === 'admin') extra.push({ href: '/admin', icon: Shield, label: 'Admin' });
  if (profile.role !== 'student') {
    extra.push({ href: '/admin/content', icon: Settings2, label: 'Konten' });
    extra.push({ href: '/admin/moderation', icon: ShieldAlert, label: 'Moderasi' });
  }
  const navItems = [...baseItems, ...extra];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="p-6 border-b border-[#2a2a2a]">
          <ClassBrand size="lg" />
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
          <ClassBrand size="sm" />
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
`);

console.log('[OK] Part T done: identitas kelas');

// === PART T2: SETTINGS FORM TRANSPARAN ===

wf('components/admin/ClassSettingsForm.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveClassSettings } from '@/lib/auth/settings-actions';

export default function ClassSettingsForm({ initial }: { initial: any }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    setSaved(false);
    try {
      const res = await saveClassSettings(fd);
      if (res && res.error) {
        setErr(res.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (e: any) {
      console.error('saveClassSettings error:', e);
      setErr('Error: ' + (e && e.message ? e.message : 'gagal menyimpan'));
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
      className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3"
    >
      <h2 className="font-semibold text-white">Identitas Kelas</h2>
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}
      {saved && <div className="p-2 rounded-lg bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635] text-sm">Tersimpan ✓ — buka halaman lain / refresh buat lihat sidebar berubah.</div>}
      <input
        name="class_name"
        defaultValue={initial?.class_name || ''}
        required
        placeholder="Nama kelas (mis. XII SAINSTECH 2)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="subtitle"
        defaultValue={initial?.subtitle || ''}
        placeholder="Subtitle (mis. nama sekolah)"
        className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
      />
      <input
        name="logo"
        type="file"
        accept="image/*"
        className="w-full text-xs text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-xs file:text-white"
      />
      <button type="submit" disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
        {busy ? 'Menyimpan...' : 'Simpan Identitas'}
      </button>
    </form>
  );
}
`);

console.log('[OK] Part T2 done: settings form transparan');

// === PART T3: SETTINGS READ VIA SERVICE ROLE ===

wf('lib/auth/settings-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function getClassSettings() {
  const admin = createAdminClient();
  const { data } = await admin.from('class_settings').select('*').limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function saveClassSettings(formData: FormData) {
  await requireRole('admin');
  const class_name = String(formData.get('class_name') || '').trim();
  const subtitle = String(formData.get('subtitle') || '').trim();
  if (!class_name) return { error: 'Nama kelas wajib diisi.' };
  const admin = createAdminClient();

  let logo_url: string | null = null;
  const file = formData.get('logo') as File | null;
  if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'Logo harus gambar.' };
    if (file.size > 2 * 1024 * 1024) return { error: 'Logo maksimal 2MB.' };
    const ext = file.name.split('.').pop() || 'png';
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload('class/logo.' + ext, buf, { contentType: file.type || 'image/png', upsert: true });
    if (upErr) return { error: 'Upload logo gagal: ' + upErr.message };
    logo_url = admin.storage.from('avatars').getPublicUrl('class/logo.' + ext).data.publicUrl;
  }

  const { data: existing } = await admin.from('class_settings').select('id').limit(1).maybeSingle();
  const payload: any = { class_name, subtitle: subtitle || null };
  if (logo_url) payload.logo_url = logo_url;
  const { error } = existing
    ? await admin.from('class_settings').update(payload).eq('id', existing.id)
    : await admin.from('class_settings').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
`);

wf('components/ClassBrand.tsx', `'use client';
import { useEffect, useState } from 'react';
import { getClassSettings } from '@/lib/auth/settings-actions';

export default function ClassBrand({ size }: { size: 'lg' | 'sm' }) {
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const d = await getClassSettings();
      setS(d);
    })();
  }, []);

  if (size === 'sm') {
    return (
      <span className="text-lg font-bold text-white flex items-center gap-2">
        {s?.logo_url ? <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
        {s?.class_name ? <span>{s.class_name}</span> : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {s?.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-[#2a2a2a]" />}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white truncate">
          {s?.class_name ? s.class_name : <span>Class<span className="text-[#a3e635]">Hub</span></span>}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{s?.subtitle || 'Kelas kamu, satu aplikasi'}</p>
      </div>
    </div>
  );
}
`);

wf('app/admin/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/actions';
import { getClassSettings } from '@/lib/auth/settings-actions';
import AppLayout from '@/components/layout/AppLayout';
import ClassSettingsForm from '@/components/admin/ClassSettingsForm';
import { Users, Newspaper, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await requireRole('admin');
  const supabase = await createClient();
  const [{ count: memberCount }, { count: postCount }, settings] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    getClassSettings(),
  ]);

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#a3e635]" />
          Panel Admin
        </h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Users className="h-5 w-5 text-[#a3e635] mb-2" />
            <div className="text-xs text-gray-400">Total Anggota</div>
            <div className="text-2xl font-bold">{memberCount ?? 0}</div>
          </div>
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <Newspaper className="h-5 w-5 text-[#fb923c] mb-2" />
            <div className="text-xs text-gray-400">Total Post</div>
            <div className="text-2xl font-bold">{postCount ?? 0}</div>
          </div>
        </div>
        <Link href="/admin/users" className="block p-4 rounded-2xl bg-[#a3e635] text-[#0a0a0a] font-semibold hover:bg-[#84cc16] transition">
          Kelola Anggota → buat akun, ubah role, ban
        </Link>
        <ClassSettingsForm initial={settings} />
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] Part T3 done: settings read via service role');

// === PART U: SETTINGS PROFIL ===

wf('app/settings/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { UserCog, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) { setProfile(p); setName(p.full_name || ''); }
    })();
  }, []);

  async function saveName() {
    if (!profile || !name.trim()) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('user_id', profile.user_id);
    setBusy(false);
    if (error) setErr('Gagal simpan nama: ' + error.message);
    else setMsg('Nama tersimpan ✓');
  }

  async function savePw() {
    setBusy(true); setMsg(''); setErr('');
    if (pw.length < 6) { setErr('Password minimal 6 karakter.'); setBusy(false); return; }
    if (pw !== pw2) { setErr('Konfirmasi password tidak sama.'); setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr('Gagal ganti password: ' + error.message);
    else { setMsg('Password diganti ✓ Gunakan password baru mulai sekarang.'); setPw(''); setPw2(''); }
  }

  if (!profile) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-[#a3e635]" />
          Profil Saya
        </h1>
        {msg && <div className="p-2 rounded-lg bg-[#a3e635]/10 border border-[#a3e635]/30 text-[#a3e635] text-sm">{msg}</div>}
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div className="text-xs text-gray-400">
            Username: <span className="text-white">@{profile.username}</span> • Role: <span className="uppercase text-[#a3e635]">{profile.role}</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
          />
          <button onClick={saveName} disabled={busy} className="w-full py-2 rounded-lg bg-[#a3e635] text-[#0a0a0a] text-sm font-semibold hover:bg-[#84cc16] disabled:opacity-50">
            Simpan Nama
          </button>
        </div>

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="h-4 w-4 text-[#a3e635]" />
            Ganti Password
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password baru (min. 6 karakter)"
            className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Ulangi password baru"
            className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#a3e635]/50"
          />
          <button onClick={savePw} disabled={busy} className="w-full py-2 rounded-lg bg-[#2a2a2a] text-white text-sm font-semibold hover:bg-[#3a3a3a] disabled:opacity-50">
            Ganti Password
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
`);

wf('components/layout/AppLayout.tsx', `'use client';
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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="p-6 border-b border-[#2a2a2a]">
          <ClassBrand size="lg" />
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
          <ClassBrand size="sm" />
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
`);

console.log('[OK] Part U done: profil - ganti nama + password');

// === PART V: THEME SYSTEM + AUTO-RETHEME ===

wf('app/globals.css', `@import "tailwindcss";

@theme inline {
  --color-bg: var(--t-bg);
  --color-card: var(--t-card);
  --color-card-2: var(--t-card2);
  --color-line: var(--t-line);
  --color-line-2: var(--t-line2);
  --color-ink: var(--t-ink);
  --color-ink-soft: var(--t-inksoft);
  --color-mut: var(--t-mut);
  --color-acc: var(--t-acc);
  --color-acc-strong: var(--t-accstrong);
  --color-acc-ink: var(--t-accink);
  --color-warn: var(--t-warn);
  --font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

:root, [data-theme="dark"] {
  --t-bg: #0a0a0a;
  --t-card: #161616;
  --t-card2: #0f0f0f;
  --t-line: #2a2a2a;
  --t-line2: #3a3a3a;
  --t-ink: #ffffff;
  --t-inksoft: #e5e7eb;
  --t-mut: #9ca3af;
  --t-acc: #a3e635;
  --t-accstrong: #84cc16;
  --t-accink: #0a0a0a;
  --t-warn: #fef3c7;
  color-scheme: dark;
}

[data-theme="light"] {
  --t-bg: #f4f6f7;
  --t-card: #ffffff;
  --t-card2: #eef1f2;
  --t-line: #e2e6e9;
  --t-line2: #cfd6db;
  --t-ink: #0f172a;
  --t-inksoft: #1f2937;
  --t-mut: #64748b;
  --t-acc: #4d7c0f;
  --t-accstrong: #3f6212;
  --t-accink: #ffffff;
  --t-warn: #b45309;
  color-scheme: light;
}

html, body {
  background-color: var(--t-bg);
  color: var(--t-ink);
  font-family: var(--font-sans);
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--t-bg); }
::-webkit-scrollbar-thumb { background: var(--t-line2); border-radius: 4px; }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`);

wf('components/ThemeToggle.tsx', `'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ch-theme', next); } catch (e) {}
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-3 md:bottom-4 md:right-4 z-30 p-3 rounded-full bg-card border border-line text-mut hover:text-ink shadow-lg"
      aria-label="Ganti mode gelap/terang"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
`);

wf('app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';
import SWRegister from '@/components/SWRegister';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

const themeScript = "(function(){try{var t=localStorage.getItem('ch-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <SWRegister />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
`);

const THEME_MAP = [
  ['focus:border-[#a3e635]/50', 'focus:border-acc/50'],
  ['focus:ring-[#a3e635]/30', 'focus:ring-acc/30'],
  ['hover:border-[#a3e635]/50', 'hover:border-acc/50'],
  ['bg-[#a3e635]/10', 'bg-acc/10'],
  ['bg-[#a3e635]/5', 'bg-acc/5'],
  ['border-[#a3e635]/30', 'border-acc/30'],
  ['border-[#a3e635]/20', 'border-acc/20'],
  ['border-[#a3e635]', 'border-acc'],
  ['text-[#0a0a0a]/60', 'text-acc-ink/60'],
  ['text-[#0a0a0a]', 'text-acc-ink'],
  ['hover:bg-[#84cc16]', 'hover:bg-acc-strong'],
  ['bg-[#a3e635]', 'bg-acc'],
  ['text-[#a3e635]', 'text-acc'],
  ['accent-[#a3e635]', 'accent-acc'],
  ['bg-[#fef3c7]/10', 'bg-warn/10'],
  ['text-[#fef3c7]', 'text-warn'],
  ['bg-[#0a0a0a]/95', 'bg-bg/95'],
  ['bg-[#0a0a0a]/90', 'bg-bg/90'],
  ['bg-[#0a0a0a]', 'bg-bg'],
  ['bg-[#0f0f0f]', 'bg-card-2'],
  ['bg-[#161616]', 'bg-card'],
  ['hover:bg-[#3a3a3a]', 'hover:bg-line-2'],
  ['hover:bg-[#2a2a2a]', 'hover:bg-line'],
  ['bg-[#3a3a3a]', 'bg-line-2'],
  ['bg-[#2a2a2a]', 'bg-line'],
  ['border-[#3a3a3a]', 'border-line-2'],
  ['border-[#2a2a2a]', 'border-line'],
  ['placeholder-gray-500', 'placeholder-mut'],
  ['text-gray-200', 'text-ink-soft'],
  ['text-gray-300', 'text-ink-soft'],
  ['text-gray-400', 'text-mut'],
  ['text-gray-500', 'text-mut'],
  ['text-white', 'text-ink'],
];

function rethemeDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { rethemeDir(p); continue; }
    if (!entry.name.endsWith('.tsx') && !entry.name.endsWith('.ts')) continue;
    let c = fs.readFileSync(p, 'utf8');
    const before = c;
    for (const pair of THEME_MAP) c = c.split(pair[0]).join(pair[1]);
    if (c !== before) {
      fs.writeFileSync(p, c, 'utf8');
      console.log('[retheme] ' + p);
    }
  }
}

rethemeDir('app');
rethemeDir('components');
console.log('[OK] Part V done: theme system dark/light + retheme otomatis');

// === PART W: EDIT ALBUM + ANIMATIONS ===

wf('lib/auth/gallery-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createAlbum(formData: FormData) {
  await requireRole('teacher');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function updateAlbum(albumId: string, name: string, description: string) {
  await requireRole('teacher');
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('gallery_albums')
    .update({ name, description: description || null })
    .eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
`);

wf('components/gallery/GalleryAlbum.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { updateAlbum, deleteAlbum } from '@/lib/auth/gallery-actions';
import { Upload, Trash2, Pencil, X, Check } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff }: { album: any; userId: string; isStaff: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(album.name || '');
  const [desc, setDesc] = useState(album.description || '');
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);

  async function remove() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus dari galeri.')) return;
    const res = await deleteAlbum(album.id);
    if (res && res.error) window.alert(res.error);
    router.refresh();
  }

  async function saveEdit() {
    if (!name.trim()) return;
    const res = await updateAlbum(album.id, name.trim(), desc.trim());
    if (res && res.error) window.alert(res.error);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="anim-fade-up">
      <div className="flex items-center justify-between gap-2 mb-2">
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold">
                <Check className="h-3 w-3" />
                Simpan
              </button>
              <button onClick={() => { setEditing(false); setName(album.name || ''); setDesc(album.description || ''); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold">
                <X className="h-3 w-3" />
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink truncate">{album.name}</h2>
              {album.description && <p className="text-sm text-mut">{album.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
              >
                <Upload className="h-3 w-3" />
                Tambah Foto
              </button>
              {isStaff && (
                <>
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-mut hover:text-ink" aria-label="Edit album">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={remove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Hapus album">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-mut py-4">Album kosong. Tambah foto pertama!</p>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <button
              key={m.id}
              onClick={() => setOpen(i)}
              style={{ animationDelay: i * 60 + 'ms' }}
              className="anim-fade-up mb-2 w-full rounded-xl overflow-hidden border border-line bg-card-2 break-inside-avoid"
              aria-label="Lihat detail"
            >
              {m.media_type === 'video' ? (
                <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto" />
              ) : (
                <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto" />
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} userId={userId} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
`);

wf('components/feed/LikeButton.tsx', `'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

export default function LikeButton({ postId, userId, initialCount, initialLiked, ownerId, actorName }: { postId: string; userId: string; initialCount: number; initialLiked: boolean; ownerId: string; actorName: string }) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase.from('likes').delete().eq('user_id', userId).eq('target_type', 'post').eq('target_id', postId);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      await supabase.from('likes').insert({ user_id: userId, target_type: 'post', target_id: postId });
      if (ownerId !== userId) {
        await supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'like',
          title: actorName + ' menyukai postinganmu',
          actor_id: userId,
          target_type: 'post',
          target_id: postId,
        });
      }
    }
  }

  return (
    <button onClick={toggle} className={'flex items-center gap-2 text-sm transition ' + (liked ? 'text-red-400' : 'text-mut hover:text-red-400')}>
      <Heart className={'h-5 w-5 ' + (liked ? 'fill-red-400 heart-pop' : '')} />
      <span>{count}</span>
    </button>
  );
}
`);

wf('app/globals.css', `@import "tailwindcss";

@theme inline {
  --color-bg: var(--t-bg);
  --color-card: var(--t-card);
  --color-card-2: var(--t-card2);
  --color-line: var(--t-line);
  --color-line-2: var(--t-line2);
  --color-ink: var(--t-ink);
  --color-ink-soft: var(--t-inksoft);
  --color-mut: var(--t-mut);
  --color-acc: var(--t-acc);
  --color-acc-strong: var(--t-accstrong);
  --color-acc-ink: var(--t-accink);
  --color-warn: var(--t-warn);
  --font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

:root, [data-theme="dark"] {
  --t-bg: #0a0a0a;
  --t-card: #161616;
  --t-card2: #0f0f0f;
  --t-line: #2a2a2a;
  --t-line2: #3a3a3a;
  --t-ink: #ffffff;
  --t-inksoft: #e5e7eb;
  --t-mut: #9ca3af;
  --t-acc: #a3e635;
  --t-accstrong: #84cc16;
  --t-accink: #0a0a0a;
  --t-warn: #fef3c7;
  color-scheme: dark;
}

[data-theme="light"] {
  --t-bg: #f4f6f7;
  --t-card: #ffffff;
  --t-card2: #eef1f2;
  --t-line: #e2e6e9;
  --t-line2: #cfd6db;
  --t-ink: #0f172a;
  --t-inksoft: #1f2937;
  --t-mut: #64748b;
  --t-acc: #4d7c0f;
  --t-accstrong: #3f6212;
  --t-accink: #ffffff;
  --t-warn: #b45309;
  color-scheme: light;
}

html, body {
  background-color: var(--t-bg);
  color: var(--t-ink);
  font-family: var(--font-sans);
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--t-bg); }
::-webkit-scrollbar-thumb { background: var(--t-line2); border-radius: 4px; }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes heartPop {
  0% { transform: scale(1); }
  40% { transform: scale(1.35); }
  100% { transform: scale(1); }
}

.anim-fade-up { animation: fadeUp 0.45s ease both; }
.heart-pop { animation: heartPop 0.35s ease; }

.space-y-4 > * { animation: fadeUp 0.45s ease both; }
.space-y-4 > *:nth-child(2) { animation-delay: 60ms; }
.space-y-4 > *:nth-child(3) { animation-delay: 120ms; }
.space-y-4 > *:nth-child(4) { animation-delay: 180ms; }
.space-y-4 > *:nth-child(5) { animation-delay: 240ms; }
.space-y-4 > *:nth-child(n+6) { animation-delay: 300ms; }

.fixed.inset-0 { animation: fadeIn 0.2s ease both; }
.fixed.inset-0 > * { animation: popIn 0.25s ease both; }

body, aside, header, nav {
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
`);

console.log('[OK] Part W done: edit album + animasi');