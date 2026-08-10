'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addPiket, updatePiket, removePiket } from '@/lib/auth/piket-actions';
import Avatar from '@/components/Avatar';
import { X, Brush, Pencil, Check } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function PiketBoard({ entries, members, isStaff }: any) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState(1);
  const [editUser, setEditUser] = useState('');
  const todayIdx = (new Date().getDay() + 6) % 7;

  async function add(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await addPiket(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setErr('');
    const res = await updatePiket(editId, Number(editDay), editUser);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setEditId(null);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus dari piket?')) return;
    setErr('');
    const res = await removePiket(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  const selCls = 'px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="space-y-4">
      {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}

      {isStaff && (
        <form
          onSubmit={(e) => { e.preventDefault(); add(new FormData(e.currentTarget)); }}
          className="bg-card border border-line rounded-2xl p-4 grid sm:grid-cols-3 gap-2"
        >
          <select name="day" className={selCls}>
            {DAYS.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
          <select name="user_id" required className={selCls}>
            {members.map((m: any) => (
              <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
            ))}
          </select>
          <button disabled={busy} className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50">
            {busy ? '...' : 'Tambah Piket'}
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {DAYS.map((d, i) => {
          const list = entries.filter((e: any) => e.day_of_week === i + 1);
          const isToday = i === todayIdx;
          return (
            <div key={d} className={'rounded-2xl border p-4 ' + (isToday ? 'border-acc bg-acc/5' : 'border-line bg-card')}>
              <div className="flex items-center gap-2 mb-3">
                <Brush className={'h-4 w-4 ' + (isToday ? 'text-acc' : 'text-mut')} />
                <div className="font-semibold text-sm">{d}</div>
                {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-acc text-acc-ink font-bold">HARI INI</span>}
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-mut">Belum ada petugas.</div>
              ) : (
                <div className="space-y-2">
                  {list.map((e: any) => (
                    <div key={e.id}>
                      {editId === e.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select value={editDay} onChange={(ev) => setEditDay(Number(ev.target.value))} className={selCls}>
                              {DAYS.map((dd, ii) => (
                                <option key={dd} value={ii + 1}>{dd}</option>
                              ))}
                            </select>
                            <select value={editUser} onChange={(ev) => setEditUser(ev.target.value)} className={selCls}>
                              {members.map((m: any) => (
                                <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold">
                              <Check className="h-3 w-3" />
                              Simpan
                            </button>
                            <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold">
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Avatar data={e.profiles} className="h-7 w-7" />
                          <div className="flex-1 text-sm truncate">{e.profiles?.full_name}</div>
                          {isStaff && (
                            <>
                              <button
                                onClick={() => { setEditId(e.id); setEditDay(e.day_of_week); setEditUser(e.user_id); }}
                                className="p-1 text-mut hover:text-ink"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => remove(e.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded" aria-label="Hapus">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
