'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminCreateUser, adminUpdateRole, adminSetBan, adminResetPassword, adminSetJabatan } from '@/lib/auth/admin-actions';
import { Plus, KeyRound, Crown } from 'lucide-react';

const JABATAN = ['Ketua Kelas', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator Keamanan', 'Koordinator Kebersihan'];

type Member = {
  user_id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  is_banned: boolean;
  is_owner?: boolean;
  jabatan?: string | null;
};

export default function AdminUsersClient({ members, currentUserId, currentIsOwner }: { members: Member[]; currentUserId: string; currentIsOwner: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  async function create(fd: FormData) {
    setBusy(true);
    setMsg('');
    const res = await adminCreateUser(fd);
    setBusy(false);
    if (res && res.error) setMsg('Gagal: ' + res.error);
    else {
      setMsg('Akun berhasil dibuat.');
      setShowForm(false);
      router.refresh();
    }
  }

  async function changeRole(userId: string, role: string) {
    setMsg('');
    const res = await adminUpdateRole(userId, role);
    if (res && res.error) setMsg(res.error);
    router.refresh();
  }

  async function changeJabatan(userId: string, jabatan: string) {
    setMsg('');
    const res = await adminSetJabatan(userId, jabatan);
    if (res && res.error) setMsg(res.error);
    else setMsg('Jabatan tersimpan.');
    router.refresh();
  }

  async function toggleBan(m: Member) {
    setMsg('');
    const res = await adminSetBan(m.user_id, !m.is_banned);
    if (res && res.error) setMsg(res.error);
    router.refresh();
  }

  async function doReset(userId: string) {
    setBusy(true);
    setMsg('');
    const res = await adminResetPassword(userId, resetPw);
    setBusy(false);
    if (res && res.error) setMsg('Gagal reset: ' + res.error);
    else {
      setMsg('Password berhasil direset. Kirim password baru lewat chat pribadi.');
      setResetId(null);
      setResetPw('');
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Manajemen Anggota</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Tutup' : 'Buat Akun'}
        </button>
      </div>

      {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm break-all">{msg}</div>}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
          className="bg-card border border-line rounded-2xl p-5 grid md:grid-cols-2 gap-4"
        >
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="username" required placeholder="Username" className={inputCls} />
          <input name="full_name" required placeholder="Nama lengkap" className={inputCls} />
          <input name="password" required placeholder="Password (min 8, huruf+angka)" className={inputCls} />
          <select name="role" className={inputCls}>
            <option value="student">student</option>
            <option value="teacher">teacher</option>
          </select>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
            {busy ? 'Membuat...' : 'Buat Akun'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {members.map((m) => {
          const ownerLocked = !!m.is_owner && !currentIsOwner;
          return (
            <div key={m.user_id} className="bg-card border border-line rounded-2xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-line-2 flex items-center justify-center font-bold text-ink shrink-0">
                  {m.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate flex items-center gap-1.5">
                    {m.full_name}
                    {m.is_owner && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-acc/10 text-acc border border-acc/30 font-bold">
                        <Crown className="h-3 w-3" />
                        OWNER
                      </span>
                    )}
                    {m.user_id === currentUserId && <span className="text-mut font-normal">(lu)</span>}
                  </div>
                  <div className="text-xs text-mut truncate">@{m.username} • {m.email}</div>
                </div>
                <select
                  value={m.jabatan || ''}
                  disabled={ownerLocked}
                  onChange={(e) => changeJabatan(m.user_id, e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-card-2 border border-line text-xs text-ink disabled:opacity-40"
                  aria-label="Jabatan"
                >
                  <option value="">— jabatan —</option>
                  {JABATAN.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <select
                  value={m.role}
                  disabled={m.user_id === currentUserId || ownerLocked}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-card-2 border border-line text-xs text-ink disabled:opacity-40"
                >
                  <option value="student">student</option>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  onClick={() => { setResetId(resetId === m.user_id ? null : m.user_id); setResetPw(''); }}
                  disabled={ownerLocked}
                  className="p-2 rounded-lg text-mut hover:text-ink hover:bg-line disabled:opacity-40"
                  aria-label="Reset password"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleBan(m)}
                  disabled={m.user_id === currentUserId || ownerLocked}
                  className={'px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ' + (m.is_banned ? 'bg-acc text-acc-ink' : 'bg-red-500/10 text-red-400 border border-red-500/20')}
                >
                  {m.is_banned ? 'Aktifkan' : 'Ban'}
                </button>
              </div>
              {resetId === m.user_id && (
                <div className="flex gap-2 mt-3">
                  <input
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="Password baru (min 8, huruf+angka)"
                    className={inputCls}
                  />
                  <button onClick={() => doReset(m.user_id)} disabled={busy} className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold disabled:opacity-50 shrink-0">
                    {busy ? '...' : 'Simpan'}
                  </button>
                  <button onClick={() => setResetId(null)} className="px-3 py-2 rounded-lg bg-line text-ink text-xs font-semibold shrink-0">
                    Batal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
