'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_SIZE = 8 * 1024 * 1024;
const OK_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'opus'];

export async function uploadTrack(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get('title') || '').trim();
  const artist = String(formData.get('artist') || '').trim();
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) return { error: 'Pilih file audio dulu.' };
  if (!title) return { error: 'Judul lagu wajib diisi.' };
  if (file.size > MAX_SIZE) return { error: 'Maksimal 8MB per lagu.' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (OK_EXT.indexOf(ext) === -1) {
    return { error: 'Format harus mp3/m4a/aac/ogg/opus. FLAC & WAV tidak diizinkan biar storage hemat.' };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('tracks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= 8) {
    return { error: 'Slot upload kamu penuh (8 lagu). Hapus salah satu di tab Upload Saya dulu.' };
  }

  const id = randomUUID();
  const path = user.id + '/' + id + '.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('music')
    .upload(path, buf, { contentType: file.type || 'audio/mpeg', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('music').getPublicUrl(path).data.publicUrl;

  const { error } = await admin.from('tracks').insert({
    id,
    user_id: user.id,
    title,
    artist: artist || null,
    url,
  });
  if (error) return { error: error.message };
  revalidatePath('/music');
  return { success: true };
}

export async function deleteTrack(id: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: row } = await admin.from('tracks').select('user_id').eq('id', id).maybeSingle();
  if (!row) return { error: 'Lagu tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (row.user_id !== user.id && !isStaff) return { error: 'Bukan lagu uploadanmu.' };
  const { error } = await admin.from('tracks').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/music');
  return { success: true };
}
