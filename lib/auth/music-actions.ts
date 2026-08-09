'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function uploadTrack(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get('title') || '').trim();
  const artist = String(formData.get('artist') || '').trim();
  const file = formData.get('file') as File | null;
  if (!title || !file || file.size === 0) return { error: 'Judul dan file audio wajib diisi.' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Maksimal 20MB per lagu.' };
  const admin = createAdminClient();
  const id = randomUUID();
  const ext = file.name.split('.').pop() || 'mp3';
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('music')
    .upload(id + '.' + ext, buf, { contentType: file.type || 'audio/mpeg', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('music').getPublicUrl(id + '.' + ext).data.publicUrl;
  const { error } = await admin.from('tracks').insert({ id, title, artist: artist || null, url, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath('/music');
  return { success: true };
}

export async function deleteTrack(id: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: row } = await admin.from('tracks').select('created_by').eq('id', id).maybeSingle();
  const isStaff = user.profile.role !== 'student';
  if (!row || (row.created_by !== user.id && !isStaff)) return { error: 'Kamu tidak punya hak menghapus lagu ini.' };
  const { error } = await admin.from('tracks').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/music');
  return { success: true };
}
