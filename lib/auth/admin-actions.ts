'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function adminCreateUser(formData: FormData) {
  await requireRole('admin');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'student');
  const password = String(formData.get('password') || '');

  if (!email || !username || !full_name) return { error: 'Semua field wajib diisi.' };
  if (password.length < 6) return { error: 'Password minimal 6 karakter.' };

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return { error: 'Username sudah dipakai.' };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name },
  });
  if (error) return { error: error.message };
  if (data.user) {
    await admin.from('profiles').update({ role, full_name, username }).eq('user_id', data.user.id);
  }
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminUpdateRole(userId: string, role: string) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminSetBan(userId: string, banned: boolean) {
  await requireRole('admin');
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_banned: banned }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}
