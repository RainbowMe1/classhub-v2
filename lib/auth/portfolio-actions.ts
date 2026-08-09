'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function saveAbout(formData: FormData) {
  await requireRole('teacher');
  const about = String(formData.get('about') || '').trim();
  const admin = createAdminClient();
  const { data: existing } = await admin.from('class_settings').select('id').limit(1).maybeSingle();
  const { error } = existing
    ? await admin.from('class_settings').update({ about }).eq('id', existing.id)
    : await admin.from('class_settings').insert({ class_name: 'ClassHub', about });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function addTeacher(formData: FormData) {
  await requireRole('teacher');
  const name = String(formData.get('name') || '').trim();
  const role = String(formData.get('role') || '').trim();
  if (!name) return { error: 'Nama wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('class_teachers').insert({ name, role: role || null });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteTeacher(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('class_teachers').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function addAchievement(formData: FormData) {
  await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const year = String(formData.get('year') || '').trim();
  const level = String(formData.get('level') || '').trim();
  if (!title) return { error: 'Judul prestasi wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('class_achievements').insert({ title, year: year || null, level: level || null });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteAchievement(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('class_achievements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function addJourney(formData: FormData) {
  await requireRole('teacher');
  const period = String(formData.get('period') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const story = String(formData.get('story') || '').trim();
  if (!period || !title) return { error: 'Periode dan judul wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('class_journey').insert({ period, title, story: story || null });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteJourney(id: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('class_journey').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
