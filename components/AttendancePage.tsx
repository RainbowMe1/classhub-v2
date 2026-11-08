'use client';
import { useCallback, useEffect, useState } from 'react';
import { getAttendance, deleteAttendance, updateAttendanceStatus, getLeaderboard } from '@/lib/auth/attendance-actions';
import AttendanceCamera from './AttendanceCamera';
import { Camera, CheckCircle2, Trash2, Loader2, Users, CalendarDays, ShieldAlert, Trophy, X, Image } from 'lucide-react';

function bust(url: any) {
  if (!url) return '';
  const s = String(url);
  if (s.indexOf('?') >= 0) return s;
  return s + '?cb=' + Date.now();
}


export default function AttendancePage({ schoolName, className }: { schoolName: string; className: string }) {
  const [data, setData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selDay, setSelDay] = useState(0);

  const load = useCallback(async () => {
    try {
      const r: any = await getAttendance();
      setData(r);
      const lb: any = await getLeaderboard();
      setLeaderboard(Array.isArray(lb) ? lb : []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    load();
    const h = function () { load(); };
    window.addEventListener('attendance-done', h);
    return () => window.removeEventListener('attendance-done', h);
  }, [load]);

  async function del(id: string) {
    if (!window.confirm('Hapus absensi ini? Siswa bisa absen ulang setelah dihapus.')) return;
    setBusyId(id);
    setErr('');
    const res: any = await deleteAttendance(id);
    setBusyId('');
    if (res && res.error) { setErr(res.error); return; }
    setMsg('Absensi dihapus — siswa bisa absen ulang ✓');
    await load();
  }

  async function setStatus(id: string, st: string) {
    setBusyId(id);
    setErr('');
    const res: any = await updateAttendanceStatus(id, st);
    setBusyId('');
    if (res && res.error) setErr(res.error);
    else await load();
  }

  if (!data) return <div className="max-w-3xl mx-auto px-4 py-6 text-mut text-sm">Memuat...</div>;
  const canManage = data.role === 'admin' || data.role === 'teacher';
  const canAttend = data.role !== 'teacher';
  const selDate = data.weekDays[selDay] ? data.weekDays[selDay].date : '';
  const selRows = (data.weekAll || []).filter(function (r: any) { return r.attend_date === selDate; });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Camera className="h-6 w-6 text-acc" />
        Absensi Kelas
      </h1>

      {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs">{msg}</div>}
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      {canAttend && (data.todayMine ? (
        <div className="bg-card border border-acc/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-acc">
            <CheckCircle2 className="h-5 w-5" />
            Kamu sudah absen hari ini
          </div>
          <button onClick={() => setLightbox(data.todayMine.photo_url)} className="block w-full">
            <img src={bust(data.todayMine.photo_url)} alt="Foto absensi" className="w-full max-w-xs rounded-xl border border-line hover:border-acc/50 transition" />
          </button>
          <div className="text-xs text-mut">
            Status: {data.todayMine.status || 'hadir'}
            {data.todayMine.note ? ' • ' + data.todayMine.note : ''}
            {data.todayMine.location ? ' • 📍 ' + data.todayMine.location : ''}
          </div>
          <div className="text-[11px] text-mut">Salah foto? Chat admin/guru supaya absensimu dihapus, lalu kamu bisa absen ulang.</div>
        </div>
      ) : (
        <AttendanceCamera schoolName={schoolName} className={className} />
      ))}

      {!canAttend && (
        <div className="p-3 rounded-xl bg-line text-mut text-xs">Role guru tidak perlu absen — kelola absensi siswa di bawah.</div>
      )}

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-acc" />
          Riwayat Mingguku (Senin–Minggu)
        </div>
        <div className="grid grid-cols-7 gap-2">
          {data.weekDays.map(function (d: any) {
            return (
              <div key={d.date} className={'rounded-xl border p-2 text-center ' + (d.mine ? 'bg-acc/10 border-acc/40' : 'bg-card-2 border-line')}>
                <div className="text-[10px] text-mut">{d.label}</div>
                {d.mine && d.minePhoto ? (
                  <button onClick={() => setLightbox(d.minePhoto.photo_url)} className="block w-full mt-1">
                    <img src={bust(d.minePhoto.photo_url)} alt="" className="w-full rounded-lg border border-line hover:border-acc/50 transition" />
                  </button>
                ) : (
                  <div className="text-lg mt-1">–</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-mut">
          Minggu berjalan mulai Senin {data.weekDays[0].date}. Begitu Senin baru datang, data minggu lama dihapus otomatis.
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Leaderboard Absensi Minggu Ini
          </div>
          <div className="space-y-2">
            {leaderboard.map(function (l: any, i: number) {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
              return (
                <div key={l.user_id} className="flex items-center gap-3 p-2 rounded-xl bg-card-2 border border-line">
                  <div className="text-xl font-bold w-8 text-center">{medal}</div>
                  {l.avatar_url ? (
                    <img src={l.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border border-line" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-line-2 flex items-center justify-center text-xs font-bold">{(l.name || '?').charAt(0)}</div>
                  )}
                  <div className="flex-1 font-semibold text-sm">{l.name}</div>
                  <div className="text-xs font-bold text-acc">{l.count}x absen</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canManage && (
        <>
          <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-acc" />
              Absensi Hari Ini ({data.todayAll.length})
            </div>
            {data.todayAll.length === 0 ? (
              <div className="text-xs text-mut">Belum ada yang absen hari ini.</div>
            ) : (
              <div className="space-y-2">
                {data.todayAll.map(function (r: any) {
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-xl bg-card-2 border border-line">
                      <button onClick={() => setLightbox(r.photo_url)} className="shrink-0">
                        <img src={bust(r.photo_url)} alt="" className="h-12 w-12 rounded-lg object-cover border border-line hover:border-acc/50 transition" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{r.name}</div>
                        <div className="text-[10px] text-mut">
                          {new Date(r.taken_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                          {r.location ? ' • 📍 ' + r.location : ''}
                          {r.note ? ' • ' + r.note : ''}
                        </div>
                      </div>
                      <select
                        value={r.status || 'hadir'}
                        onChange={(e) => setStatus(r.id, e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-card border border-line text-xs"
                      >
                        <option value="hadir">Hadir</option>
                        <option value="sakit">Sakit</option>
                        <option value="izin">Izin</option>
                        <option value="alpa">Alpa</option>
                      </select>
                      <button
                        onClick={() => del(r.id)}
                        disabled={busyId === r.id}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                        aria-label="Hapus absensi"
                      >
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-acc" />
              Foto Absensi Minggu Ini
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.weekDays.map(function (d: any, i: number) {
                return (
                  <button
                    key={d.date}
                    onClick={() => setSelDay(i)}
                    className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ' + (selDay === i ? 'bg-acc text-acc-ink border-acc' : 'bg-card-2 text-mut border-line hover:border-acc/40')}
                  >
                    {d.label} ({d.count})
                  </button>
                );
              })}
            </div>
            {selRows.length === 0 ? (
              <div className="text-xs text-mut">Tidak ada absensi pada hari ini.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selRows.map(function (r: any) {
                  return (
                    <button key={r.id} onClick={() => setLightbox(r.photo_url)} className="text-left rounded-xl overflow-hidden border border-line bg-card-2 hover:border-acc/50 transition">
                      <img src={bust(r.photo_url)} alt="" className="w-full h-32 object-cover" />
                      <div className="p-2">
                        <div className="text-xs font-semibold truncate">{r.name}</div>
                        <div className="text-[10px] text-mut">
                          {new Date(r.taken_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB • {r.status || 'hadir'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-acc" />
              Rekap Minggu Ini
            </div>
            <div className="space-y-2">
              {data.weekDays.map(function (d: any) {
                return (
                  <div key={d.date} className="p-2 rounded-xl bg-card-2 border border-line text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{d.label}, {d.date}</span>
                      <span>{d.count} absen</span>
                    </div>
                    {d.names.length > 0 && <div className="text-mut mt-1">{d.names.join(', ')}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Tutup">
            <X className="h-6 w-6" />
          </button>
          <img src={bust(lightbox)} alt="Foto absensi" className="max-w-full max-h-full rounded-2xl border-2 border-white/20" />
        </div>
      )}
    </div>
  );
}
