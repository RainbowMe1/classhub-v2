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
  if (!class_name) return { error: 'Nama kelas wajib diisi.' };
  const admin = createAdminClient();

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

  const { data: existing } = await admin.from('class_settings').select('id').limit(1).maybeSingle();
  const payload: any = { class_name, subtitle: subtitle || null };
  if (logo_url) payload.logo_url = logo_url;
  const { error } = existing
    ? await admin.from('class_settings').update(payload).eq('id', existing.id)
    : await admin.from('class_settings').insert(payload);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}
