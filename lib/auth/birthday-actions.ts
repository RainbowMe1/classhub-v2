'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

function todayParts() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const p = s.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

export async function setMyBirthday(value: string) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Format tanggal tidak valid.' };
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ birthday: value }).eq('user_id', user.id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function adminSetBirthday(userId: string, value: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: me } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (!me || me.role !== 'admin') return { error: 'Khusus admin.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Format tanggal tidak valid.' };
  const { error } = await admin.from('profiles').update({ birthday: value }).eq('user_id', userId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function addWish(toUserId: string, message: string) {
  const user = await requireUser();
  const msg = String(message || '').trim().slice(0, 300);
  if (!msg) return { error: 'Pesan ucapan kosong.' };
  const admin = createAdminClient();
  const { error } = await admin.from('birthday_wishes').insert({
    to_user_id: toUserId,
    from_user_id: user.id,
    message: msg,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getBirthdays(): Promise<any> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin.from('profiles').select('user_id, username, full_name, avatar_url, birthday, is_banned, role');
  if (error) return { error: error.message, today: [], upcoming: [], mine: null, yearMap: [], wishes: {}, all: [], stats: { filled: 0, total: 0, thisMonth: 0 } };
  const members = (data || []).filter((r: any) => !r.is_banned);
  const rows = members.filter((r: any) => r.birthday);
  const t = todayParts();
  const todayUtc = new Date(Date.UTC(t.y, t.m - 1, t.d, 12));
  const nameMap: Record<string, string> = {};
  members.forEach((r: any) => { nameMap[r.user_id] = r.full_name; });

  const todayList: any[] = [];
  const upcoming: any[] = [];
  const yearMap: any[] = [];
  for (let i = 0; i < 12; i++) yearMap.push([]);

  for (const r of rows) {
    const p = String(r.birthday).slice(0, 10).split('-').map(Number);
    const by = p[0], bm = p[1], bd = p[2];
    if (!bm || !bd) continue;
    yearMap[bm - 1].push({ name: r.full_name, day: bd });
    if (bm === t.m && bd === t.d) {
      todayList.push({ user_id: r.user_id, name: r.full_name, age: t.y - by, avatar_url: r.avatar_url });
    }
    let ann = new Date(Date.UTC(t.y, bm - 1, bd, 12));
    if (ann.getTime() < todayUtc.getTime()) ann = new Date(Date.UTC(t.y + 1, bm - 1, bd, 12));
    const daysLeft = Math.round((ann.getTime() - todayUtc.getTime()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 60) {
      upcoming.push({ name: r.full_name, daysLeft, turning: ann.getUTCFullYear() - by });
    }
  }
  yearMap.forEach((arr: any[]) => arr.sort((a, b) => a.day - b.day));
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

  const wishes: Record<string, any[]> = {};
  for (const tp of todayList) {
    const { data: w } = await admin
      .from('birthday_wishes')
      .select('*')
      .eq('to_user_id', tp.user_id)
      .order('created_at', { ascending: false })
      .limit(20);
    wishes[tp.user_id] = (w || []).map((x: any) => ({ from: nameMap[x.from_user_id] || 'Anggota', message: x.message }));
  }

  const all = members
    .map((r: any) => {
      let daysLeft: number | null = null;
      if (r.birthday) {
        const p = String(r.birthday).slice(0, 10).split('-').map(Number);
        if (p[1] && p[2]) {
          let ann = new Date(Date.UTC(t.y, p[1] - 1, p[2], 12));
          if (ann.getTime() < todayUtc.getTime()) ann = new Date(Date.UTC(t.y + 1, p[1] - 1, p[2], 12));
          daysLeft = Math.round((ann.getTime() - todayUtc.getTime()) / 86400000);
        }
      }
      return { user_id: r.user_id, full_name: r.full_name, role: r.role, birthday: r.birthday ? String(r.birthday).slice(0, 10) : null, daysLeft };
    })
    .sort((a: any, b: any) => {
      if (a.daysLeft === null && b.daysLeft === null) return 0;
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });

  const mine = members.find((r: any) => r.user_id === user.id);

  return {
    today: todayList,
    upcoming: upcoming.slice(0, 10),
    mine: mine && mine.birthday ? String(mine.birthday).slice(0, 10) : null,
    myRole: mine ? mine.role : 'student',
    yearMap,
    wishes,
    all,
    stats: { filled: rows.length, total: members.length, thisMonth: yearMap[t.m - 1].length },
  };
}
