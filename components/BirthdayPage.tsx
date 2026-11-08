'use client';
import { useCallback, useEffect, useState } from 'react';
import { getBirthdays, setMyBirthday, adminSetBirthday, addWish } from '@/lib/auth/birthday-actions';
import { Cake, PartyPopper, CalendarDays, Loader2, CheckCircle2, Pencil, Shield, Send, Users, TrendingUp } from 'lucide-react';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function BirthdayPage() {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [wishText, setWishText] = useState<Record<string, string>>({});
  const [wishBusy, setWishBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const r: any = await getBirthdays();
      setData(r);
      if (r && r.mine) setValue(r.mine);
    } catch (e) {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveMine() {
    setBusy(true); setMsg(''); setErr('');
    const res: any = await setMyBirthday(value);
    setBusy(false);
    if (res && res.error) { setErr(res.error); return; }
    setMsg('Tanggal ulang tahun tersimpan ✓');
    setEditing(false);
    await load();
  }

  async function saveAdmin(uid: string) {
    setSavingId(uid); setMsg(''); setErr('');
    const res: any = await adminSetBirthday(uid, edits[uid] || '');
    setSavingId('');
    if (res && res.error) { setErr(res.error); return; }
    setMsg('Ulang tahun anggota diperbarui ✓');
    setEdits(function (s) { const n = Object.assign({}, s); delete n[uid]; return n; });
    await load();
  }

  async function sendWish(uid: string) {
    setWishBusy(uid); setErr('');
    const res: any = await addWish(uid, wishText[uid] || '');
    setWishBusy('');
    if (res && res.error) { setErr(res.error); return; }
    setWishText(function (s) { const n = Object.assign({}, s); n[uid] = ''; return n; });
    await load();
  }

  if (!data) return null;

  const isAdmin = data.myRole === 'admin';
  const next = data.upcoming && data.upcoming.length ? data.upcoming[0] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Cake className="h-6 w-6 text-acc" />
        Pusat Ulang Tahun Kelas
      </h1>

      {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs">{msg}</div>}
      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-acc" />
          <div className="text-2xl font-black mt-1">{data.stats.filled}/{data.stats.total}</div>
          <div className="text-[10px] text-mut mt-0.5">Sudah Isi Tanggal</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <Cake className="h-5 w-5 mx-auto text-teal-400" />
          <div className="text-2xl font-black mt-1">{data.stats.thisMonth}</div>
          <div className="text-[10px] text-mut mt-0.5">Ultah Bulan Ini</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-orange-400" />
          <div className="text-2xl font-black mt-1">{next ? next.daysLeft : '-'}</div>
          <div className="text-[10px] text-mut mt-0.5 truncate">{next ? next.name : 'Tidak ada'}</div>
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-acc" />
          Ulang Tahunku
        </div>
        {editing || !data.mine ? (
          <div className="flex gap-2">
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-card-2 border border-line text-sm focus:outline-none focus:border-acc/50"
            />
            <button onClick={saveMine} disabled={busy || !value} className="px-4 py-2 rounded-xl bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {new Date(data.mine + 'T12:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}
            </div>
            <button onClick={() => setEditing(true)} className="p-2 rounded-lg bg-line text-mut hover:text-ink" aria-label="Ubah tanggal">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {data.today && data.today.length > 0 && data.today.map((tp: any) => (
        <div key={tp.user_id} className="p-5 rounded-2xl bg-gradient-to-r from-acc/20 to-teal-500/10 border border-acc/40 space-y-3">
          <div className="flex items-center gap-3">
            {tp.avatar_url ? (
              <img src={tp.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover border border-line" />
            ) : (
              <div className="h-11 w-11 rounded-full bg-line-2 flex items-center justify-center text-sm font-bold">{(tp.name || '?').charAt(0)}</div>
            )}
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <PartyPopper className="h-4 w-4 text-acc" />
                Hari ini {tp.name} ulang tahun ke-{tp.age}! 🎂
              </div>
              <div className="text-xs text-mut">Tulis ucapan buat dia di bawah 👇</div>
            </div>
          </div>

          {(data.wishes[tp.user_id] || []).length > 0 && (
            <div className="space-y-2">
              {(data.wishes[tp.user_id] || []).map((w: any, i: number) => (
                <div key={i} className="p-2 rounded-xl bg-card/70 border border-line text-xs">
                  <span className="font-bold text-acc">{w.from}:</span> <span className="text-ink">{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={wishText[tp.user_id] || ''}
              onChange={(e) => setWishText(function (s) { const n = Object.assign({}, s); n[tp.user_id] = e.target.value; return n; })}
              placeholder="Selamat ulang tahun! Semoga..."
              maxLength={300}
              className="flex-1 px-3 py-2 rounded-xl bg-card-2 border border-line text-sm focus:outline-none focus:border-acc/50"
            />
            <button onClick={() => sendWish(tp.user_id)} disabled={wishBusy === tp.user_id} className="px-4 py-2 rounded-xl bg-acc text-acc-ink text-sm font-bold disabled:opacity-50 flex items-center gap-2">
              {wishBusy === tp.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Kirim
            </button>
          </div>
        </div>
      ))}

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Cake className="h-4 w-4 text-acc" />
          Ulang Tahun Terdekat (60 hari)
        </div>
        {!data.upcoming || data.upcoming.length === 0 ? (
          <div className="text-xs text-mut">Tidak ada ultah dalam 60 hari ke depan.</div>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((u: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-card-2 border border-line text-sm">
                <div className="flex-1 font-semibold">{u.name}</div>
                <div className="text-xs text-mut">ke-{u.turning} tahun</div>
                <div className={'text-xs font-bold px-2 py-1 rounded-full ' + (u.daysLeft <= 7 ? 'bg-acc/20 text-acc' : 'bg-line text-mut')}>
                  {u.daysLeft} hari lagi
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-acc" />
          Kalender Ulang Tahun Setahun
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {MONTHS.map(function (mn, i) {
            const list = data.yearMap[i] || [];
            return (
              <div key={mn} className={'rounded-xl border p-3 ' + (list.length ? 'bg-acc/10 border-acc/30' : 'bg-card-2 border-line')}>
                <div className="text-xs font-bold mb-1">{mn}</div>
                {list.length === 0 ? (
                  <div className="text-[10px] text-mut">—</div>
                ) : (
                  <div className="space-y-0.5">
                    {list.map(function (p: any, j: number) {
                      return <div key={j} className="text-[11px] text-mut">{p.day} • <span className="text-ink">{p.name}</span></div>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-acc" />
            Kelola Ulang Tahun Anggota (Admin)
          </div>
          <div className="space-y-2">
            {(data.all || []).map(function (m: any) {
              return (
                <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-xl bg-card-2 border border-line">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{m.full_name}</div>
                    <div className="text-[10px] text-mut">
                      {m.role} • {m.birthday ? (m.daysLeft === 0 ? 'ULTAH HARI INI 🎉' : m.daysLeft + ' hari lagi') : 'belum diisi'}
                    </div>
                  </div>
                  <input
                    type="date"
                    defaultValue={m.birthday || ''}
                    onChange={(e) => setEdits(function (s) { const n = Object.assign({}, s); n[m.user_id] = e.target.value; return n; })}
                    className="px-2 py-1.5 rounded-lg bg-card border border-line text-xs focus:outline-none focus:border-acc/50"
                  />
                  <button
                    onClick={() => saveAdmin(m.user_id)}
                    disabled={savingId === m.user_id || !edits[m.user_id]}
                    className="p-2 rounded-lg bg-acc text-acc-ink disabled:opacity-40"
                    aria-label={'Simpan ulang tahun ' + m.full_name}
                  >
                    {savingId === m.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
