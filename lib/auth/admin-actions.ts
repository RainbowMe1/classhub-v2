'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const COMMON = ['password', 'password1', '123456', '1234567', '12345678', '123456789', '12345', '121212', 'qwerty', 'abc123', '111111', 'iloveyou', 'admin123', 'sainstech123', 'kelas123', 'man4bogor'];

function checkPw(pw: string): string | null {
  if (pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password harus kombinasi huruf dan angka.';
  if (COMMON.indexOf(pw.toLowerCase()) !== -1) return 'Password terlalu umum — pakai yang lebih unik.';
  return null;
}

async function guardOwner(admin: any, actorId: string, targetId: string): Promise<string | null> {
  if (actorId === targetId) return null;
  const [{ data: target }, { data: actor }] = await Promise.all([
    admin.from('profiles').select('is_owner').eq('user_id', targetId).maybeSingle(),
    admin.from('profiles').select('is_owner').eq('user_id', actorId).maybeSingle(),
  ]);
  if (target?.is_owner && !actor?.is_owner) {
    return 'Akun owner tidak bisa diubah oleh admin lain.';
  }
  return null;
}

export async function adminCreateUser(formData: FormData) {
  await requireRole('admin');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') || '').trim();
  const role = String(formData.get('role') || 'student');
  const password = String(formData.get('password') || '');

  if (!email || !username || !full_name) return { error: 'Semua field wajib diisi.' };
  const bad = checkPw(password);
  if (bad) return { error: bad };
  if (role === 'admin') return { error: 'Akun baru hanya boleh student/teacher. Naikkan role lewat dropdown setelah dibuat.' };

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
  revalidatePath('/members');
  return { success: true };
}

export async function adminUpdateRole(userId: string, role: string) {
  const user = await requireRole('admin');
  const admin = createAdminClient();
  const guard = await guardOwner(admin, user.id, userId);
  if (guard) return { error: guard };
  const { error } = await admin.from('profiles').update({ role }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminSetBan(userId: string, banned: boolean) {
  const user = await requireRole('admin');
  const admin = createAdminClient();
  const guard = await guardOwner(admin, user.id, userId);
  if (guard) return { error: guard };
  const { error } = await admin.from('profiles').update({ is_banned: banned }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { success: true };
}

export async function adminResetPassword(userId: string, password: string) {
  const user = await requireRole('admin');
  const bad = checkPw(password);
  if (bad) return { error: bad };
  const admin = createAdminClient();
  const guard = await guardOwner(admin, user.id, userId);
  if (guard) return { error: guard };
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { success: true };
}

export async function adminSetJabatan(userId: string, jabatan: string) {
  const user = await requireRole('admin');
  const admin = createAdminClient();
  const guard = await guardOwner(admin, user.id, userId);
  if (guard) return { error: guard };
  const { error } = await admin.from('profiles').update({ jabatan: jabatan || null }).eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  revalidatePath('/members');
  revalidatePath('/feed');
  return { success: true };
}
