'use client';
import { useCallback, useEffect, useState } from 'react';
import { getAllProfiles, adminUpdateProfile } from '@/lib/auth/admin-profile-actions';
import { Shield, Loader2, CheckCircle2, Trash2, Edit3 } from 'lucide-react';

export default function AdminProfilesPage() {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r: any = await getAllProfiles();
      setData(r);
    } catch (e) {}
  }, []);
  useEffect(() => { load(); }, [load]);

  function startEdit(p: any) {
    setEditing(p.user_id);
    setForm({ full_name: p.full_name || '', bio: p.bio || '', jabatan: p.jabatan || '', sesi_pendidikan: p.sesi_pendidikan || '', role: p.role || 'student', is_banned: p.is_banned || false });
    setMsg(''); setErr('');
  }

  async function save() {
    if (!editing) return;
    setBusy(true); setMsg(''); setErr('');
    const res: any = await adminUpdateProfile(editing, form);
    setBusy(false);
    if (res && res.error) { setErr(res.error); return; }
    setMsg('Profil berhasil diperbarui ✓');
    setEditing(null);
    await load();
  }

  if (!data || data.error) {
    return <div className="max-w-3xl mx-auto px-4 py-6 text-red-400 text-sm">{data && data.error ? data.error : 'Memuat...'}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="h-6 w-6 text-acc" />
        Kelola Profil Anggota
      </h1>
      {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs">{msg}</div>}
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      <div className="space-y-2">
        {data.profiles.map(function (p: any) {
          const isEditing = editing === p.user_id;
          return (
            <div key={p.user_id} className="bg-card border border-line rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover border border-line" />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-line-2 flex items-center justify-center text-sm font-bold">{(p.full_name || '?').charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate flex items-center gap-2">
                    {p.full_name || '-'}
                    {p.root_admin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-acc/20 text-acc font-bold">ROOT</span>}
                    {p.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">BANNED</span>}
                  </div>
                  <div className="text-[11px] text-mut">@{p.username} • {p.role}{p.jabatan ? ' • ' + p.jabatan : ''}</div>
                </div>
                {!isEditing && !p.root_admin && (
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg bg-line text-mut hover:text-ink" aria-label="Edit">
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                {p.root_admin && <span className="text-[10px] text-mut px-2">Terlindungi</span>}
              </div>

              {isEditing && (
                <div className="space-y-2 pt-2 border-t border-line">
                  <div>
                    <label className="text-[10px] text-mut">Nama Lengkap</label>
                    <input value={form.full_name} onChange={(e) => setForm(Object.assign({}, form, { full_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-mut">Jabatan</label>
                      <input value={form.jabatan} onChange={(e) => setForm(Object.assign({}, form, { jabatan: e.target.value }))} placeholder="Ketua Kelas, dll" className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-mut">Sesi Pendidikan</label>
                      <input value={form.sesi_pendidikan} onChange={(e) => setForm(Object.assign({}, form, { sesi_pendidikan: e.target.value }))} placeholder="Pagi/Siang" className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-mut">Bio</label>
                    <textarea value={form.bio} onChange={(e) => setForm(Object.assign({}, form, { bio: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-mut">Role</label>
                    <select value={form.role} onChange={(e) => setForm(Object.assign({}, form, { role: e.target.value }))} className="px-3 py-1.5 rounded-lg bg-card-2 border border-line text-xs">
                      <option value="student">Siswa</option>
                      <option value="teacher">Guru</option>
                      <option value="admin">Admin</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-mut ml-auto">
                      <input type="checkbox" checked={!!form.is_banned} onChange={(e) => setForm(Object.assign({}, form, { is_banned: e.target.checked }))} />
                      Banned
                    </label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-line text-ink text-sm font-semibold">Batal</button>
                    <button onClick={save} disabled={busy} className="flex-1 py-2 rounded-lg bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Simpan
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
