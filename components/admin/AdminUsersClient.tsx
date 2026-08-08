'use client';
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
