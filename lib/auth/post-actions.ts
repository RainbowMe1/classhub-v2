'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function updateOwnPost(formData: FormData) {
  const user = await requireUser();
  const postId = String(formData.get('id') || '');
  const content = String(formData.get('content') || '').trim();
  if (!postId) return { error: 'ID post kosong.' };
  const admin = createAdminClient();
  const { data: row } = await admin.from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!row || row.user_id !== user.id) return { error: 'Ini bukan postinganmu.' };
  const { error } = await admin.from('posts').update({ content: content || null }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  return { success: true };
}

export async function hideOwnPost(postId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: row } = await admin.from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!row || row.user_id !== user.id) return { error: 'Ini bukan postinganmu.' };
  const { error } = await admin.from('posts').update({ is_hidden: true }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  return { success: true };
}

export async function unhideOwnPost(postId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: row } = await admin.from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!row || row.user_id !== user.id) return { error: 'Ini bukan postinganmu.' };
  const { error } = await admin.from('posts').update({ is_hidden: false }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  return { success: true };
}

export async function hideAnyPost(postId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').update({ is_hidden: true }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  revalidatePath('/admin/posts');
  return { success: true };
}

export async function unhideAnyPost(postId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').update({ is_hidden: false }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  revalidatePath('/admin/posts');
  return { success: true };
}

export async function deleteAnyPost(postId: string) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').delete().eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  revalidatePath('/admin/posts');
  return { success: true };
}
