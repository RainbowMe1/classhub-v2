'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_AUDIO_SIZE = 8 * 1024 * 1024;
const MAX_COVER_SIZE = 4 * 1024 * 1024;
const AUDIO_TYPES: Record<string, string[]> = {
  mp3: ['audio/mpeg'],
  m4a: ['audio/mp4'],
  aac: ['audio/aac'],
  ogg: ['audio/ogg'],
  opus: ['audio/opus', 'audio/ogg'],
};
const COVER_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function getExtension(name: string) {
  return (name.split('.').pop() || '').toLowerCase();
}

function fileMime(file: File) {
  return file.type.split(';')[0].trim().toLowerCase();
}

function validAudioFile(file: File) {
  const ext = getExtension(file.name);
  const mime = fileMime(file);
  return file.size > 0 && file.size <= MAX_AUDIO_SIZE && (AUDIO_TYPES[ext] || []).includes(mime);
}

function validCoverFile(file: File) {
  const ext = getExtension(file.name);
  const mime = fileMime(file);
  return file.size > 0 && file.size <= MAX_COVER_SIZE && COVER_TYPES[ext] === mime;
}

function musicObjectPath(url: string | null | undefined) {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const marker = '/storage/v1/object/public/music/';
    const index = path.indexOf(marker);
    if (index === -1) return null;
    return path
      .slice(index + marker.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');
  } catch {
    return null;
  }
}

async function removeObjects(admin: ReturnType<typeof createAdminClient>, urls: (string | null | undefined)[]) {
  const paths = Array.from(new Set(urls.map(musicObjectPath).filter((path): path is string => Boolean(path))));
  if (paths.length === 0) return null;
  try {
    const { error } = await admin.storage.from('music').remove(paths);
    return error?.message ?? null;
  } catch (error) {
    return actionError(error);
  }
}

async function requireStaff(userId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { admin, role: null, error: 'Tidak dapat memverifikasi peran akun.' };
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return { admin, role: profile?.role ?? null, error: 'Aksi ini hanya tersedia untuk admin dan guru.' };
  }
  return { admin, role: profile.role, error: null };
}

function actionError(error: unknown) {
  return error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan perubahan.';
}

export async function uploadTrack(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get('title') || '').trim();
  const artist = String(formData.get('artist') || '').trim();
  const durationValue = Number(formData.get('duration_seconds') || 0);
  const file = formData.get('file');

  if (!title) return { error: 'Judul lagu wajib diisi.' };
  if (title.length > 140 || artist.length > 140) return { error: 'Judul dan artis maksimal 140 karakter.' };
  if (!(file instanceof File)) return { error: 'Pilih file audio dulu.' };
  if (file.size > MAX_AUDIO_SIZE) return { error: 'Maksimal 8MB per lagu.' };
  if (!validAudioFile(file)) return { error: 'Format file dan MIME harus cocok: MP3, M4A, AAC, OGG, atau OPUS.' };
  if (!Number.isFinite(durationValue) || durationValue < 0 || durationValue > 86400) {
    return { error: 'Durasi lagu tidak valid.' };
  }

  let uploadedUrl: string | null = null;
  try {
    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (countError) return { error: 'Tidak dapat memeriksa slot upload: ' + countError.message };
    if ((count ?? 0) >= 8) return { error: 'Slot upload kamu penuh (8 lagu). Hapus salah satu di tab Upload Saya dulu.' };

    const { data: lastTrack, error: orderError } = await admin
      .from('tracks')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) return { error: 'Tidak dapat menyiapkan urutan lagu: ' + orderError.message };

    const id = randomUUID();
    const ext = getExtension(file.name);
    const path = user.id + '/' + id + '.' + ext;
    const { error: uploadError } = await admin.storage
      .from('music')
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: fileMime(file), upsert: false });
    if (uploadError) return { error: 'Upload gagal: ' + uploadError.message };

    const url = admin.storage.from('music').getPublicUrl(path).data.publicUrl;
    uploadedUrl = url;
    const { error: insertError } = await admin.from('tracks').insert({
      id,
      user_id: user.id,
      title,
      artist: artist || null,
      url,
      duration_seconds: durationValue ? Math.round(durationValue) : null,
      sort_order: (lastTrack?.sort_order ?? -1) + 1,
    });
    if (insertError) {
      const cleanupError = await removeObjects(admin, [url]);
      return {
        error: 'Lagu gagal disimpan: ' + insertError.message +
          (cleanupError ? ' File yang terunggah juga gagal dibersihkan: ' + cleanupError : ''),
      };
    }

    revalidatePath('/music');
    return { success: true };
  } catch (error) {
    const cleanupError = uploadedUrl ? await removeObjects(createAdminClient(), [uploadedUrl]) : null;
    return {
      error: 'Upload gagal: ' + actionError(error) +
        (cleanupError ? ' File yang terunggah juga gagal dibersihkan: ' + cleanupError : ''),
    };
  }
}

export async function updateTrack(id: string, formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get('title') || '').trim();
  const artist = String(formData.get('artist') || '').trim();
  const cover = formData.get('cover');

  if (!title) return { error: 'Judul lagu wajib diisi.' };
  if (title.length > 140 || artist.length > 140) return { error: 'Judul dan artis maksimal 140 karakter.' };
  if (cover && !(cover instanceof File)) return { error: 'File cover tidak valid.' };
  if (cover instanceof File && cover.size > 0) {
    if (cover.size > MAX_COVER_SIZE) return { error: 'Cover maksimal 4MB.' };
    if (!validCoverFile(cover)) return { error: 'Cover harus PNG, JPG, WebP, atau GIF dengan MIME yang sesuai.' };
  }

  const access = await requireStaff(user.id);
  if (access.error) return { error: access.error };

  let uploadedCoverUrl: string | null = null;
  try {
    const { data: track, error: trackError } = await access.admin
      .from('tracks')
      .select('cover_url')
      .eq('id', id)
      .maybeSingle();
    if (trackError) return { error: 'Tidak dapat memuat lagu: ' + trackError.message };
    if (!track) return { error: 'Lagu tidak ditemukan.' };

    let coverUrl: string | null | undefined;
    if (cover instanceof File && cover.size > 0) {
      const ext = getExtension(cover.name);
      const path = 'covers/' + user.id + '/' + id + '/' + randomUUID() + '.' + ext;
      const { error: uploadError } = await access.admin.storage
        .from('music')
        .upload(path, Buffer.from(await cover.arrayBuffer()), { contentType: fileMime(cover), upsert: false });
      if (uploadError) return { error: 'Upload cover gagal: ' + uploadError.message };
      uploadedCoverUrl = access.admin.storage.from('music').getPublicUrl(path).data.publicUrl;
      coverUrl = uploadedCoverUrl;
    }

    const updates: { title: string; artist: string | null; cover_url?: string | null } = {
      title,
      artist: artist || null,
    };
    if (coverUrl !== undefined) updates.cover_url = coverUrl;
    const { error: updateError } = await access.admin.from('tracks').update(updates).eq('id', id);
    if (updateError) {
      const cleanupError = uploadedCoverUrl ? await removeObjects(access.admin, [uploadedCoverUrl]) : null;
      return {
        error: 'Perubahan lagu gagal disimpan: ' + updateError.message +
          (cleanupError ? ' Cover baru juga gagal dibersihkan: ' + cleanupError : ''),
      };
    }

    const cleanupError = uploadedCoverUrl && track.cover_url
      ? await removeObjects(access.admin, [track.cover_url])
      : null;
    revalidatePath('/music');
    return cleanupError
      ? { success: true, warning: 'Cover baru tersimpan, tetapi cover lama gagal dibersihkan: ' + cleanupError }
      : { success: true };
  } catch (error) {
    const cleanupError = uploadedCoverUrl ? await removeObjects(access.admin, [uploadedCoverUrl]) : null;
    return {
      error: 'Perubahan lagu gagal: ' + actionError(error) +
        (cleanupError ? ' Cover baru juga gagal dibersihkan: ' + cleanupError : ''),
    };
  }
}

export async function reorderTracks(orderedIds: string[]) {
  const user = await requireUser();
  const access = await requireStaff(user.id);
  if (access.error) return { error: access.error };
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    return { error: 'Urutan lagu tidak valid.' };
  }

  try {
    const { data: tracks, error: listError } = await access.admin.from('tracks').select('id');
    if (listError) return { error: 'Tidak dapat memuat urutan lagu: ' + listError.message };
    const existingIds = (tracks ?? []).map((track) => track.id);
    if (
      orderedIds.length !== existingIds.length ||
      new Set(orderedIds).size !== orderedIds.length ||
      existingIds.some((id) => !orderedIds.includes(id))
    ) {
      return { error: 'Daftar lagu berubah. Muat ulang sebelum mengurutkan.' };
    }

    for (const [index, id] of orderedIds.entries()) {
      const { error } = await access.admin.from('tracks').update({ sort_order: index }).eq('id', id);
      if (error) return { error: 'Urutan sebagian gagal disimpan: ' + error.message };
    }
    revalidatePath('/music');
    return { success: true };
  } catch (error) {
    return { error: 'Urutan lagu gagal disimpan: ' + actionError(error) };
  }
}

export async function deleteTrack(id: string) {
  const user = await requireUser();

  try {
    const access = await requireStaff(user.id);
    const { data: track, error: trackError } = await access.admin
      .from('tracks')
      .select('user_id,url,cover_url')
      .eq('id', id)
      .maybeSingle();
    if (trackError) return { error: 'Tidak dapat memuat lagu: ' + trackError.message };
    if (!track) return { error: 'Lagu tidak ditemukan.' };

    if (access.error && track.user_id !== user.id) return { error: 'Bukan lagu uploadanmu.' };
    const { error: deleteError } = await access.admin.from('tracks').delete().eq('id', id);
    if (deleteError) return { error: 'Lagu gagal dihapus: ' + deleteError.message };

    const cleanupError = await removeObjects(access.admin, [track.url, track.cover_url]);
    revalidatePath('/music');
    return cleanupError
      ? { success: true, warning: 'Lagu dihapus, tetapi file storage gagal dibersihkan: ' + cleanupError }
      : { success: true };
  } catch (error) {
    return { error: 'Penghapusan lagu gagal: ' + actionError(error) };
  }
}
