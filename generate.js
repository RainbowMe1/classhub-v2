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