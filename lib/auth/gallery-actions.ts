'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const STUDENT_MAX = 5;

export async function createAlbum(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function updateAlbum(formData: FormData) {
  const user = await requireUser();
  const albumId = String(formData.get('album_id') || '');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!albumId) return { error: 'Album tidak valid.' };
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { data: album } = await admin.from('gallery_albums').select('created_by').eq('id', albumId).maybeSingle();
  if (!album) return { error: 'Album tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && album.created_by !== user.id) return { error: 'Kamu bukan pembuat album ini.' };
  const { error } = await admin
    .from('gallery_albums')
    .update({ name, description: description || null })
    .eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: album } = await admin.from('gallery_albums').select('created_by').eq('id', albumId).maybeSingle();
  if (!album) return { error: 'Album tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && album.created_by !== user.id) return { error: 'Kamu bukan pembuat album ini.' };
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function uploadMedia(formData: FormData) {
  const user = await requireUser();
  const albumId = String(formData.get('album_id') || '');
  const file = formData.get('file') as File | null;
  if (!albumId) return { error: 'Album tidak valid.' };
  if (!file || file.size === 0) return { error: 'Pilih file dulu.' };
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return { error: 'Hanya gambar atau video.' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Maksimal 20MB per file.' };
  const isStaff = user.profile.role !== 'student';
  const admin = createAdminClient();
  if (!isStaff) {
    const { count } = await admin
      .from('gallery_media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) >= STUDENT_MAX) return { error: 'Kamu sudah upload 5 foto/video (maksimal anggota). Hapus punyamu dulu kalau mau ganti.' };
  }
  const id = randomUUID();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = user.id + '/' + id + '.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('gallery')
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('gallery').getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from('gallery_media').insert({
    album_id: albumId,
    user_id: user.id,
    media_url: url,
    media_type: file.type.startsWith('video/') ? 'video' : 'image',
    caption: file.name,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteMedia(mediaId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: m } = await admin.from('gallery_media').select('user_id').eq('id', mediaId).maybeSingle();
  if (!m) return { error: 'Media tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && m.user_id !== user.id) return { error: 'Kamu hanya bisa hapus foto uploadanmu sendiri.' };
  const { error } = await admin.from('gallery_media').delete().eq('id', mediaId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
