'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

export async function canEditUser(targetId: string): Promise<any> {
  const me = await requireUser();
  const admin = createAdminClient();
  const { data: meProf } = await admin.from('profiles').select('role, root_admin').eq('user_id', me.id).maybeSingle();
  const { data: target } = await admin.from('profiles').select('role, root_admin, is_banned, avatar_url').eq('user_id', targetId).maybeSingle();
  
  if (!meProf) return { allowed: false, reason: 'Profil kamu tidak ditemukan.' };
  if (!target) return { allowed: false, reason: 'User target tidak ditemukan.' };
  if (target.root_admin) return { allowed: false, reason: 'Akun root admin tidak bisa diedit.' };
  if (me.id === targetId) return { allowed: false, reason: 'Edit diri sendiri pakai menu Profil biasa.' };
  if (meProf.role === 'admin' || meProf.role === 'teacher') return { allowed: true, me: meProf, target };
  return { allowed: false, reason: 'Khusus admin/guru.' };
}

export async function adminUpdateProfile(targetId: string, formData: FormData): Promise<any> {
  const check = await canEditUser(targetId);
  if (!check.allowed) return { error: check.reason };
  
  const admin = createAdminClient();
  
  const fullName = formData.get('full_name') as string;
  const bio = formData.get('bio') as string;
  const jabatan = formData.get('jabatan') as string;
  const sesi = formData.get('sesi_pendidikan') as string;
  const role = formData.get('role') as string;
  const isBanned = formData.get('is_banned') === 'on';
  const file = formData.get('avatar_file') as File;

  let avatarUrl = check.target?.avatar_url || '';

  // 1. Handle Upload Foto jika ada file baru
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${targetId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await admin.storage.from('avatars').upload(fileName, file, { 
      upsert: true,
      contentType: file.type 
    });
    
    if (uploadError) return { error: 'Gagal upload foto: ' + uploadError.message };
    
    const { data: urlData } = admin.storage.from('avatars').getPublicUrl(fileName);
    avatarUrl = urlData.publicUrl;
  }

  // 2. Update Database
  const { error } = await admin.from('profiles').update({
    full_name: fullName,
    bio,
    jabatan,
    sesi_pendidikan: sesi,
    role,
    is_banned: isBanned,
    avatar_url: avatarUrl
  }).eq('user_id', targetId);

  if (error) return { error: error.message };
  return { success: true };
}