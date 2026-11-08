'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

function weekInfo() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const d = new Date(today + 'T12:00:00Z');
  const wd = d.getUTCDay();
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  const mondayUtc = new Date(d.getTime() + mondayOffset * 86400000);
  const weekKey = mondayUtc.toISOString().slice(0, 10);
  const weekday = wd === 0 ? 7 : wd;
  return { today: today, weekKey: weekKey, weekday: weekday, mondayUtc: mondayUtc };
}

async function purgeOldWeeks(admin: any, weekKey: string) {
  const { data: old } = await admin.from('attendance').select('id, photo_url').lt('week_key', weekKey);
  if (old && old.length) {
    const paths = old
      .map(function (r: any) {
        const u = String(r.photo_url || '');
        const idx = u.indexOf('/attendance/');
        if (idx < 0) return null;
        return decodeURIComponent(u.slice(idx + 12)).split('?')[0];
      })
      .filter(Boolean);
    if (paths.length) {
      try { await admin.storage.from('attendance').remove(paths); } catch (e) {}
    }
    await admin.from('attendance').delete().lt('week_key', weekKey);
  }
}

export async function getAttendance(): Promise<any> {
  const user = await requireUser();
  const admin = createAdminClient();
  const w = weekInfo();
  await purgeOldWeeks(admin, w.weekKey);
  const { data: me } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  const role = me ? me.role : 'student';
  const { data: weekRows } = await admin.from('attendance').select('*').eq('week_key', w.weekKey).order('taken_at');
  const rows = weekRows || [];
  const mine = rows.filter(function (r: any) { return r.user_id === user.id; });
  const todayMine = mine.find(function (r: any) { return r.attend_date === w.today; }) || null;
  const { data: profs } = await admin.from('profiles').select('user_id, full_name, avatar_url');
  const nameMap: Record<string, any> = {};
  (profs || []).forEach(function (p: any) { nameMap[p.user_id] = p; });
  const todayAll = rows
    .filter(function (r: any) { return r.attend_date === w.today; })
    .map(function (r: any) {
      const p = nameMap[r.user_id];
      return Object.assign({}, r, { name: p ? p.full_name : '?' });
    });
  const labels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const ds = new Date(w.mondayUtc.getTime() + i * 86400000).toISOString().slice(0, 10);
    const dayRows = rows.filter(function (r: any) { return r.attend_date === ds; });
    weekDays.push({
      date: ds,
      label: labels[i],
      count: dayRows.length,
      names: dayRows.map(function (r: any) { return nameMap[r.user_id] ? nameMap[r.user_id].full_name : '?'; }),
      mine: dayRows.some(function (r: any) { return r.user_id === user.id; }),
      minePhoto: (dayRows.find(function (r: any) { return r.user_id === user.id; }) || null),
    });
  }
  const weekAll = (role === 'admin' || role === 'teacher')
    ? rows.map(function (r: any) {
        const p = nameMap[r.user_id];
        return Object.assign({}, r, { name: p ? p.full_name : '?', avatar_url: p ? p.avatar_url : null });
      })
    : [];
  return { role: role, today: w.today, weekKey: w.weekKey, mine: mine, todayMine: todayMine, todayAll: todayAll, weekDays: weekDays, weekAll: weekAll };
}

export async function submitAttendance(photoDataUrl: string, location: string, status: string, note: string, orientation: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const w = weekInfo();
  await purgeOldWeeks(admin, w.weekKey);
  const { data: existing } = await admin.from('attendance').select('id').eq('user_id', user.id).eq('attend_date', w.today).maybeSingle();
  if (existing) return { error: 'Kamu sudah absen hari ini. Kalau ada kesalahan, minta admin/guru hapus absensimu.' };
  const base = String(photoDataUrl || '');
  if (base.indexOf('data:image/jpeg;base64,') !== 0) return { error: 'Foto tidak valid.' };
  const buf = Buffer.from(base.split(',')[1], 'base64');
  if (buf.length > 2000000) return { error: 'Foto terlalu besar.' };
  const ts = Date.now();
  const filePath = user.id + '/' + w.today + '_' + ts + '.jpg';
  const up = await admin.storage.from('attendance').upload(filePath, buf, { contentType: 'image/jpeg', upsert: false });
  if (up.error) return { error: 'Gagal simpan foto: ' + up.error.message };
  const pub = admin.storage.from('attendance').getPublicUrl(filePath).data;
  const ins = await admin.from('attendance').insert({
    user_id: user.id,
    attend_date: w.today,
    weekday: w.weekday,
    week_key: w.weekKey,
    photo_url: pub.publicUrl + '?cb=' + ts,
    location: String(location || '').slice(0, 120),
    status: ['hadir', 'sakit', 'izin'].indexOf(status) !== -1 ? status : 'hadir',
    note: String(note || '').slice(0, 500),
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
  });
  if (ins.error) {
    if (ins.error.code === '23505') return { error: 'Kamu sudah absen hari ini.' };
    return { error: ins.error.message };
  }
  return { success: true };
}

export async function deleteAttendance(id: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: me } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (!me || (me.role !== 'admin' && me.role !== 'teacher')) return { error: 'Khusus admin/guru.' };
  const { data: row } = await admin.from('attendance').select('photo_url').eq('id', id).maybeSingle();
  if (row && row.photo_url) {
    const u = String(row.photo_url);
    const idx = u.indexOf('/attendance/');
    if (idx >= 0) {
      const raw = decodeURIComponent(u.slice(idx + 12));
      const path = raw.split('?')[0];
      try { await admin.storage.from('attendance').remove([path]); } catch (e) {}
    }
  }
  const del = await admin.from('attendance').delete().eq('id', id);
  if (del.error) return { error: del.error.message };
  return { success: true };
}

export async function updateAttendanceStatus(id: string, status: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: me } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (!me || (me.role !== 'admin' && me.role !== 'teacher')) return { error: 'Khusus admin/guru.' };
  if (['hadir', 'sakit', 'izin', 'alpa'].indexOf(status) === -1) return { error: 'Status tidak valid.' };
  const up = await admin.from('attendance').update({ status: status }).eq('id', id);
  if (up.error) return { error: up.error.message };
  return { success: true };
}

export async function getLeaderboard(): Promise<any> {
  const user = await requireUser();
  const admin = createAdminClient();
  const w = weekInfo();
  const { data: rows } = await admin.from('attendance').select('user_id').eq('week_key', w.weekKey);
  const { data: profs } = await admin.from('profiles').select('user_id, full_name, avatar_url');
  const nameMap: Record<string, any> = {};
  (profs || []).forEach(function (p: any) { nameMap[p.user_id] = p; });
  const counts: Record<string, number> = {};
  (rows || []).forEach(function (r: any) { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
  const list = Object.keys(counts)
    .map(function (uid) {
      const p = nameMap[uid];
      return {
        user_id: uid,
        name: p ? p.full_name : '?',
        avatar_url: p ? p.avatar_url : null,
        count: counts[uid],
      };
    })
    .sort(function (a, b) { return b.count - a.count; });
  return list.slice(0, 20);
}
