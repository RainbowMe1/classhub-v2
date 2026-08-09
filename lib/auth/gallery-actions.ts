'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function createAlbum(formData: FormData) {
  await requireRole('teacher');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function updateAlbum(albumId: string, name: string, description: string) {
  await requireRole('teacher');
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('gallery_albums')
    .update({ name, description: description || null })
    .eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  await requireRole('teacher');
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
