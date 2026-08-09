'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createSchedule(formData: FormData) {
  await requireRole('teacher');
  const day_of_week = Number(formData.get('day_of_week'));
  const start_time = String(formData.get('start_time') || '');
  const end_time = String(formData.get('end_time') || '');
  const subject = String(formData.get('subject') || '').trim();
  const room = String(formData.get('room') || '').trim();
  if (!day_of_week || !start_time || !end_time || !subject) return { error: 'Hari, jam, dan mapel wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').insert({
    day_of_week,
    start_time,
    end_time,
    subject,
    room: room || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteSchedule(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('schedules').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function createAnnouncement(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const content = String(formData.get('content') || '').trim();
  const is_pinned = formData.get('is_pinned') === 'on';
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('announcements')
    .insert({ author_id: user.id, title, content, is_pinned, is_published: true })
    .select('id');
  if (error) return { error: error.message };

  const { data: members } = await admin.from('profiles').select('user_id').neq('user_id', user.id);
  const notifs = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: 'announcement',
    title: 'Pengumuman: ' + title,
    actor_id: user.id,
    target_type: 'announcement',
    target_id: data && data.length > 0 ? data[0].id : null,
  }));
  if (notifs.length > 0) await admin.from('notifications').insert(notifs);

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function togglePin(id: string, pinned: boolean) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('announcements').update({ is_pinned: pinned }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
