'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

export async function canEditUser(targetId: string): Promise<any> {
  const me = await requireUser();
  const admin = createAdminClient();
  const { data: meProf } = await admin.from('profiles').select('role, root_admin').eq('user_id', me.id).maybeSingle();
  const { data: target } = await admin.from('profiles').select('role, root_admin, is_banned').eq('user_id', targetId).maybeSingle();
  if (!meProf) return { allowed: false, reason: 'Profil kamu tidak ditemukan.' };
  if (!target) return { allowed: false, reason: 'User target tidak ditemukan.' };
  if (target.root_admin) return { allowed: false, reason: 'Akun root admin tidak bisa diedit.' };
  if (me.id === targetId) return { allowed: false, reason: 'Edit diri sendiri pakai menu Profil biasa.' };
  if (meProf.role === 'admin' || meProf.role === 'teacher') return { allowed: true, me: meProf, target };
  return { allowed: false, reason: 'Khusus admin/guru.' };
}

export async function adminUpdateProfile(targetId: string, updates: any): Promise<any> {
  const check = await canEditUser(targetId);
  if (!check.allowed) return { error: check.reason };
  const admin = createAdminClient();
  const allowed = ['full_name', 'avatar_url', 'bio', 'jabatan', 'sesi_pendidikan', 'role', 'is_banned'];
  const safe: Record<string, any> = {};
  allowed.forEach(function (k) { if (updates[k] !== undefined) safe[k] = updates[k]; });
  if (Object.keys(safe).length === 0) return { error: 'Tidak ada data yang diubah.' };
  const { error } = await admin.from('profiles').update(safe).eq('user_id', targetId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getAllProfiles(): Promise<any> {
  const me = await requireUser();
  const admin = createAdminClient();
  const { data: meProf } = await admin.from('profiles').select('role').eq('user_id', me.id).maybeSingle();
  if (!meProf || (meProf.role !== 'admin' && meProf.role !== 'teacher')) return { error: 'Khusus admin/guru.' };
  const { data, error } = await admin.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { profiles: data || [], myRole: meProf.role };
}
