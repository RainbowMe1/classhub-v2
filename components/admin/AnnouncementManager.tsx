'use client';
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
