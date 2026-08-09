'use client';
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

  if (!profile) return <div className="min-h-screen bg-bg" />;

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-acc" />
          Profil Saya
        </h1>
        {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

        <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
          <div className="text-xs text-mut">
            Username: <span className="text-ink">@{profile.username}</span> • Role: <span className="uppercase text-acc">{profile.role}</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
          />
          <button onClick={saveName} disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
            Simpan Nama
          </button>
        </div>

        <div className="bg-card border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-acc" />
            Ganti Password
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password baru (min. 6 karakter)"
            className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Ulangi password baru"
            className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
          />
          <button onClick={savePw} disabled={busy} className="w-full py-2 rounded-lg bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50">
            Ganti Password
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
