'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

function dayStr(offset: number) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export async function getCheckInStatus(): Promise<any> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('check_ins')
    .select('*')
    .eq('user_id', user.id)
    .order('check_in_date', { ascending: false })
    .limit(120);
  if (error) return { error: 'DB: ' + error.message };
  const rows = data ?? [];
  const todayRow = rows.find((r) => r.check_in_date === dayStr(0)) || null;
  const dates = new Set(rows.map((r) => r.check_in_date));
  let streak = 0;
  for (let i = todayRow ? 0 : -1; ; i--) {
    if (dates.has(dayStr(i))) streak++;
    else break;
  }
  return { today: todayRow, streak };
}

export async function checkIn(mood: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.from('check_ins').insert({
    user_id: user.id,
    check_in_date: dayStr(0),
    mood,
  });
  if (error) {
    if (error.code === '23505') return { error: 'Kamu udah check-in hari ini.' };
    return { error: 'DB: ' + error.message };
  }
  return { success: true };
}
