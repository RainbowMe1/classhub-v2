'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addPiket, updatePiket, removePiket } from '@/lib/auth/piket-actions';
import Avatar from '@/components/Avatar';
import PiketEvidenceCapture from '@/components/piket/PiketEvidenceCapture';
import { ArrowRight, X, Brush, Pencil, Check, Camera, History } from 'lucide-react';
import type { PiketStatus } from '@/lib/piket-data';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const STATUS_LABELS: Record<PiketStatus['status'] | 'none', string> = {
  none: 'Belum Piket',
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
};
const STATUS_STYLES: Record<PiketStatus['status'] | 'none', string> = {
  none: 'border-slate-400/20 bg-slate-400/10 text-mut',
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  verified: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-red-400/20 bg-red-400/10 text-red-300',
};

type Entry = {
  id: string;
  day_of_week: number;
  user_id: string;
  profiles?: { full_name?: string; username?: string; avatar_url?: string | null } | null;
};

type Props = {
  entries: Entry[];
  members: { user_id: string; full_name: string }[];
  submissions: PiketStatus[];
  ownSubmissions: PiketStatus[];
  setupRequired: boolean;
  isStaff: boolean;
  userId: string;
  studentName: string;
  todayWeekday: number;
};

export default function PiketBoard({ entries, members, submissions, ownSubmissions, setupRequired, isStaff, userId, studentName, todayWeekday }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState(1);
  const [editUser, setEditUser] = useState('');
  const [captureEntry, setCaptureEntry] = useState<Entry | null>(null);
  const todayIdx = todayWeekday - 1;

  useEffect(() => {
    if (isStaff) return;
    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refreshVisiblePage, 30000);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [isStaff, router]);

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
      {captureEntry && !setupRequired && (
        <PiketEvidenceCapture
          entryId={captureEntry.id}
          studentName={studentName}
          weekday={DAYS[captureEntry.day_of_week - 1]}
          groupMembers={entries
            .filter((entry) => entry.day_of_week === captureEntry.day_of_week)
            .map((entry) => entry.profiles?.full_name || 'Siswa')}
          rejectionReason={ownSubmissions.find((submission) => submission.piket_entry_id === captureEntry.id)?.rejection_reason ?? null}
          onClose={() => setCaptureEntry(null)}
          onSubmitted={(warning) => {
            setCaptureEntry(null);
            if (warning) setErr(warning);
            router.refresh();
          }}
        />
      )}
      {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm break-all">{err}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mut">Status bukti piket diperbarui setelah ditinjau admin.</p>
        <Link href="/piket/riwayat" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold transition hover:border-acc/50 hover:text-acc">
          <History className="h-4 w-4" aria-hidden="true" />
          Riwayat Piket
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

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
            {members.map((m) => (
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
          const list = entries.filter((e) => e.day_of_week === i + 1);
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
                  {list.map((e) => (
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
                              {members.map((m) => (
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar data={e.profiles} className="h-7 w-7" />
                          <div className="min-w-[7rem] flex-1 truncate text-sm">{e.profiles?.full_name}</div>
                          {(() => {
                            const submission = submissions.find((item) => item.piket_entry_id === e.id && item.user_id === e.user_id);
                            const status = submission?.status ?? 'none';
                            return (
                              <>
                                <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold ' + STATUS_STYLES[status]}>
                                  {STATUS_LABELS[status]}
                                </span>
                                {!setupRequired && !isStaff && e.user_id === userId && isToday && status !== 'pending' && status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => setCaptureEntry(e)}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-acc px-3 text-xs font-bold text-acc-ink transition hover:bg-acc-strong"
                                  >
                                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                                    {status === 'rejected' ? 'Kirim Ulang' : 'Lakukan Piket'}
                                  </button>
                                )}
                                {isStaff && (
                                  <>
                                    <button
                                      onClick={() => { setEditId(e.id); setEditDay(e.day_of_week); setEditUser(e.user_id); }}
                                      className="min-h-11 min-w-11 rounded-lg p-2 text-mut transition hover:bg-line hover:text-ink"
                                      aria-label="Edit jadwal piket"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => remove(e.id)}
                                      className="min-h-11 min-w-11 rounded-lg p-2 text-red-400 transition hover:bg-red-500/10"
                                      aria-label="Hapus jadwal piket"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
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
