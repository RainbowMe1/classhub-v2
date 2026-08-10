'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function getClassSettings() {
  const admin = createAdminClient();
  const { data } = await admin.from('class_settings').select('*').limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function saveClassSettings(formData: FormData) {
  await requireRole('admin');
  const class_name = String(formData.get('class_name') || '').trim();
  const subtitle = String(formData.get('subtitle') || '').trim();
  const school_name = String(formData.get('school_name') || '').trim();
  const teacher_name = String(formData.get('teacher_name') || '').trim();
  const school_year = String(formData.get('school_year') || '').trim();
  const remove_bg = formData.get('remove_bg') === 'on';
  const remove_bg_mobile = formData.get('remove_bg_mobile') === 'on';
  if (!class_name) return { error: 'Nama kelas wajib diisi.' };
  const admin = createAdminClient();

  async function uploadBg(file: File, path: string) {
    const ext = file.name.split('.').pop() || 'png';
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('gallery')
      .upload(path + '.' + ext, buf, { contentType: file.type || 'image/png', upsert: true });
    if (upErr) return { error: 'Upload background gagal: ' + upErr.message };
    return { url: admin.storage.from('gallery').getPublicUrl(path + '.' + ext).data.publicUrl };
  }

  let logo_url: string | null = null;
  const file = formData.get('logo') as File | null;
  if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'Logo harus gambar.' };
    if (file.size > 2 * 1024 * 1024) return { error: 'Logo maksimal 2MB.' };
    const ext = file.name.split('.').pop() || 'png';
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload('class/logo.' + ext, buf, { contentType: file.type || 'image/png', upsert: true });
    if (upErr) return { error: 'Upload logo gagal: ' + upErr.message };
    logo_url = admin.storage.from('avatars').getPublicUrl('class/logo.' + ext).data.publicUrl;
  }

  let bg_url: string | null = null;
  const bgFile = formData.get('bg') as File | null;
  if (bgFile && bgFile.size > 0) {
    if (!bgFile.type.startsWith('image/')) return { error: 'Background harus gambar.' };
    if (bgFile.size > 10 * 1024 * 1024) return { error: 'Background maksimal 10MB.' };
    const r = await uploadBg(bgFile, 'class/bg');
    if ('error' in r && r.error) return { error: r.error };
    bg_url = (r as any).url;
  }

  let bg_url_mobile: string | null = null;
  const bgmFile = formData.get('bg_mobile') as File | null;
  if (bgmFile && bgmFile.size > 0) {
    if (!bgmFile.type.startsWith('image/')) return { error: 'Background HP harus gambar.' };
    if (bgmFile.size > 10 * 1024 * 1024) return { error: 'Background HP maksimal 10MB.' };
    const r = await uploadBg(bgmFile, 'class/bg-mobile');
    if ('error' in r && r.error) return { error: r.error };
    bg_url_mobile = (r as any).url;
  }

  const { data: existing } = await admin.from('class_settings').select('id').limit(1).maybeSingle();
  const payload: any = {
    class_name,
    subtitle: subtitle || null,
    school_name: school_name || null,
    teacher_name: teacher_name || null,
    school_year: school_year || null,
  };
  if (logo_url) payload.logo_url = logo_url;
  if (bg_url) payload.bg_url = bg_url;
  if (bg_url_mobile) payload.bg_url_mobile = bg_url_mobile;
  if (remove_bg) payload.bg_url = null;
  if (remove_bg_mobile) payload.bg_url_mobile = null;
  const { error } = existing
    ? await admin.from('class_settings').update(payload).eq('id', existing.id)
    : await admin.from('class_settings').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
