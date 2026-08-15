const fs = require('fs');
const path = require('path');
function wf(p, c) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] ' + p);
}

// === PART AI: TAB CHAT AI + GEMINI KEY ADMIN ===

wf('lib/auth/ai-actions.ts', `'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';

export async function saveAISettings(formData: FormData) {
  await requireRole('admin');
  const api_key = String(formData.get('api_key') || '').trim();
  const model = String(formData.get('model') || '').trim() || 'gemini-2.0-flash';
  const admin = createAdminClient();
  const { data: existing } = await admin.from('ai_settings').select('id').limit(1).maybeSingle();
  const payload: any = { model };
  if (api_key) payload.api_key = api_key;
  let error: any = null;
  if (existing) {
    const r = await admin.from('ai_settings').update(payload).eq('id', existing.id);
    error = r.error;
  } else {
    const r = await admin.from('ai_settings').insert(payload);
    error = r.error;
  }
  if (error) return { error: error.message };
  return { success: true };
}

export async function askAI(messages: { role: string; text: string }[]) {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('*').limit(1).maybeSingle();
  if (!data || !data.api_key) return { error: 'AI belum dikonfigurasi. Admin harus isi API key dulu di halaman AI.' };
  const model = data.model || 'gemini-2.0-flash';
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + data.api_key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Kamu asisten kelas yang ramah dan membantu. Jawab dalam Bahasa Indonesia dengan ringkas dan jelas.' }],
        },
        contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { error: 'Gemini error ' + res.status + ': ' + t.slice(0, 300) };
    }
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join('') || '(tidak ada jawaban)';
    return { text };
  } catch (e: any) {
    return { error: 'Gagal memanggil Gemini: ' + (e && e.message ? e.message : 'network error') };
  }
}
`);

wf('components/ai/AISettings.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAISettings } from '@/lib/auth/ai-actions';
import { X, KeyRound } from 'lucide-react';

export default function AISettings({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await saveAISettings(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      onClose();
      router.refresh();
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}
        className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-acc" />
            Pengaturan AI
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        <div>
          <div className="text-xs text-mut mb-1">Gemini API Key (kosongkan biar tetap yang lama)</div>
          <input name="api_key" type="password" placeholder="AIza..." className={inputCls} />
        </div>
        <div>
          <div className="text-xs text-mut mb-1">Model</div>
          <input name="model" defaultValue="gemini-2.0-flash" className={inputCls} />
        </div>
        <button disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
        <p className="text-[11px] text-mut">Key disimpan di database & dipakai server-side. Gak pernah dikirim ke browser anggota.</p>
      </form>
    </div>
  );
}
`);

wf('components/ai/AIChat.tsx', `'use client';
import { useEffect, useRef, useState } from 'react';
import { askAI } from '@/lib/auth/ai-actions';
import { Bot, Send, Trash2, Loader2, Settings2 } from 'lucide-react';
import AISettings from './AISettings';

type M = { role: 'user' | 'model'; text: string };

export default function AIChat({ isAdmin, configured, model }: { isAdmin: boolean; configured: boolean; model: string }) {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showCfg, setShowCfg] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setErr('');
    const next = [...msgs, { role: 'user' as const, text: t }];
    setMsgs(next);
    setText('');
    setBusy(true);
    const res = await askAI(next);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else setMsgs([...next, { role: 'model' as const, text: res.text || '(tidak ada jawaban)' }]);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="flex items-center justify-between pb-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-acc" />
          AI Kelas
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-mut font-normal">{model}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMsgs([])}
            className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line"
            aria-label="Bersihkan percakapan"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCfg(true)}
              className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line"
              aria-label="Pengaturan AI"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!configured ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mut space-y-2">
            <Bot className="h-12 w-12 mx-auto text-line-2" />
            <p className="text-sm">AI belum dikonfigurasi.</p>
            <p className="text-xs">{isAdmin ? 'Pencet ikon gerigi di kanan atas buat masukin Gemini API key.' : 'Minta admin mengaktifkan fitur ini.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {msgs.length === 0 && !busy && (
              <div className="text-center py-16 text-mut">
                <Bot className="h-10 w-10 mx-auto mb-3 text-acc" />
                <p className="text-sm">Tanya apa aja — materi pelajaran, tugas, ide kegiatan kelas.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[85%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words ' +
                    (m.role === 'user'
                      ? 'bg-acc text-acc-ink rounded-2xl rounded-br-md'
                      : 'bg-card border border-line rounded-2xl rounded-bl-md')
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-line text-sm text-mut flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mikir...
                </div>
              </div>
            )}
            {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
            <div ref={endRef} />
          </div>
          <div className="shrink-0 pt-3 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tanya apa aja..."
              className="flex-1 px-4 py-3 rounded-xl bg-card border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="p-3 rounded-xl bg-acc text-acc-ink disabled:opacity-50"
              aria-label="Kirim"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {showCfg && isAdmin && <AISettings onClose={() => setShowCfg(false)} />}
    </div>
  );
}
`);

wf('app/ai/page.tsx', `import { requireUser } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import AIChat from '@/components/ai/AIChat';

export default async function AIPage() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('api_key, model').limit(1).maybeSingle();
  return (
    <AppLayout profile={user.profile}>
      <AIChat
        isAdmin={user.profile.role === 'admin'}
        configured={!!data?.api_key}
        model={data?.model || 'gemini-2.0-flash'}
      />
    </AppLayout>
  );
}
`);

fs.writeFileSync('components/layout/AppLayout.tsx', `'use client';
import Link from 'next/link';
import { Home, Newspaper, MessageCircle, Users, ClipboardList, Calendar, Image as ImageIcon, Bell, Shield, Settings2, ShieldAlert, UserCog, Music, Award, Globe, Files, Brush, Bot } from 'lucide-react';
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
    { href: '/ai', icon: Bot, label: 'AI' },
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
`, 'utf8');
console.log('[OK] AppLayout + menu AI');

console.log('[OK] PART AI done: tab chat AI + gemini key admin');