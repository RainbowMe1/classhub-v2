'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function hidePost(postId: string, hidden: boolean) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').update({ is_hidden: hidden }).eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/admin/moderation');
  return { success: true };
}

export async function deletePost(postId: string) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('posts').delete().eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  return { success: true };
}

export async function deleteCommentAdmin(commentId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('comments').delete().eq('id', commentId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteOwnPost(postId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: row } = await admin.from('posts').select('user_id').eq('id', postId).maybeSingle();
  if (!row) return { error: 'Postingan tidak ditemukan.' };
  if (row.user_id !== user.id) return { error: 'Ini bukan postinganmu.' };
  const { error } = await admin.from('posts').delete().eq('id', postId);
  if (error) return { error: error.message };
  revalidatePath('/feed');
  revalidatePath('/my-posts');
  return { success: true };
}
