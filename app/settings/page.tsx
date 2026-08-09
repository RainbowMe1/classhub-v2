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
