'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/Avatar';
import AvatarEditor from '@/components/AvatarEditor';
import { UserCog, KeyRound, Sparkles, Camera, AtSign } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [ig, setIg] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) {
        setProfile(p);
        setName(p.full_name || '');
        setBio(p.bio || '');
        setIg(p.instagram || '');
      }
    })();
  }, []);

  async function uploadAvatar(f: File) {
    if (!profile) return;
    setBusy(true);
    setMsg('');
    setErr('');
    const path = profile.user_id + '/avatar.jpg';
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) { setErr('Upload foto gagal: ' + upErr.message); setBusy(false); return; }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url, avatar_zoom: 1, avatar_x: 0, avatar_y: 0 })
      .eq('user_id', profile.user_id);
    setBusy(false);
    if (error) { setErr('Gagal simpan: ' + error.message); return; }
    setProfile({ ...profile, avatar_url: url, avatar_zoom: 1, avatar_x: 0, avatar_y: 0 });
    setEditFile(null);
    setMsg('Foto profil diganti ✓');
  }

  async function saveName() {
    if (!profile || !name.trim()) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('user_id', profile.user_id);
    setBusy(false);
    if (error) setErr('Gagal simpan nama: ' + error.message);
    else setMsg('Nama tersimpan ✓');
  }

  async function saveBio() {
    if (!profile) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio.trim() || null, instagram: ig.trim() || null })
      .eq('user_id', profile.user_id);
    setBusy(false);
    if (error) setErr('Gagal simpan: ' + error.message);
    else {
      setProfile({ ...profile, bio: bio.trim() || null, instagram: ig.trim() || null });
      setMsg('Bio & Instagram tersimpan ✓');
    }
  }

  async function savePw() {
    setBusy(true); setMsg(''); setErr('');
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) { setErr('Password minimal 8 karakter, kombinasi huruf dan angka.'); setBusy(false); return; }
    if (pw !== pw2) { setErr('Konfirmasi password tidak sama.'); setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr('Gagal ganti password: ' + error.message);
    else { setMsg('Password diganti ✓ Gunakan password baru mulai sekarang.'); setPw(''); setPw2(''); }
  }

  async function toggleGlow(val: boolean) {
    if (!profile) return;
    setMsg(''); setErr('');
    const { error } = await supabase.from('profiles').update({ glow_border: val }).eq('user_id', profile.user_id);
    if (error) setErr('Gagal simpan preferensi: ' + error.message);
    else setProfile({ ...profile, glow_border: val });
  }

  if (!profile) return <div className="min-h-screen" />;

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-acc" />
          Profil Saya
        </h1>

        {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-4">
            <Avatar data={profile} className="h-16 w-16 text-xl" />
            <div className="flex-1">
              <div className="text-sm text-mut mb-2">
                Username: <span className="text-ink font-semibold">@{profile.username}</span> • Role: <span className="text-ink font-semibold">{profile.role}</span>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-line text-ink text-sm font-semibold hover:bg-line-2 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                Ganti Foto Profil
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setEditFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <button onClick={saveName} disabled={busy} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
            Simpan Nama
          </button>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <AtSign className="h-5 w-5 text-acc" />
            Bio & Instagram
          </h2>
          <div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 60))}
              rows={2}
              maxLength={60}
              placeholder="Bio pendek buat kartu anggota (maks 60 karakter)"
              className={inputCls + ' resize-none'}
            />
            <div className="text-right text-[10px] text-mut">{bio.length}/60</div>
          </div>
          <input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            placeholder="Instagram (mis. @deza atau link lengkap)"
            className={inputCls}
          />
          <button onClick={saveBio} disabled={busy} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
            Simpan Bio & IG
          </button>
        </div>

        {profile.role === 'admin' && (
          <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-acc" />
              Tampilan Admin
            </h2>
            <label className="flex items-center gap-3 text-sm text-mut cursor-pointer">
              <input
                type="checkbox"
                checked={profile.glow_border !== false}
                onChange={(e) => toggleGlow(e.target.checked)}
                className="accent-acc h-4 w-4"
              />
              Pakai border gradient di avatar (khusus admin)
            </label>
          </div>
        )}

        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-acc" />
            Ganti Password
          </h2>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password baru (min. 8, huruf+angka)" className={inputCls} />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ulangi password baru" className={inputCls} />
          <button onClick={savePw} disabled={busy} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
            Ganti Password
          </button>
        </div>
      </div>

      {editFile && (
        <AvatarEditor
          file={editFile}
          onClose={() => setEditFile(null)}
          onDone={uploadAvatar}
        />
      )}
    </AppLayout>
  );
}
