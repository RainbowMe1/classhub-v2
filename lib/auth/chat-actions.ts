'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, requireUser } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';

export type ChatSticker = {
  id: string;
  user_id: string;
  file_path: string;
  media_type: 'image' | 'gif';
  created_at: string;
};

export async function saveChatSticker(filePath: string, mediaType: 'image' | 'gif') {
  const user = await requireUser();
  if (
    typeof filePath !== 'string' ||
    (mediaType !== 'image' && mediaType !== 'gif')
  ) {
    return { error: 'File stiker tidak valid.' };
  }
  const validPath = new RegExp(
    `^${user.id}/stickers/[0-9a-f-]{36}\\.(png|jpe?g|webp|gif)$`
  ).test(filePath);
  const extension = filePath.split('.').pop();

  if (!validPath || (extension === 'gif') !== (mediaType === 'gif')) {
    return { error: 'File stiker tidak valid.' };
  }

  const admin = createAdminClient();
  const { error: fileError } = await admin.storage.from('chat').createSignedUrl(filePath, 60);
  if (fileError) return { error: 'File stiker tidak ditemukan: ' + fileError.message };

  const { data: sticker, error } = await admin
    .from('chat_stickers')
    .insert({ user_id: user.id, file_path: filePath, media_type: mediaType })
    .select('id, user_id, file_path, media_type, created_at')
    .single();

  if (error) {
    const { error: cleanupError } = await admin.storage.from('chat').remove([filePath]);
    if (cleanupError) {
      return { error: `${error.message}. File sementara gagal dibersihkan: ${cleanupError.message}` };
    }
    if (error.message.includes('Maksimal 5 stiker')) {
      return { error: 'Maksimal 5 stiker. Hapus salah satu stiker lama dulu.' };
    }
    return { error: error.message };
  }

  revalidatePath('/chat');
  return { sticker: sticker as ChatSticker };
}

export async function deleteOwnChatSticker(stickerId: string) {
  const user = await requireUser();
  if (typeof stickerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(stickerId)) {
    return { error: 'Stiker tidak valid.' };
  }

  const admin = createAdminClient();
  const { data: sticker, error: findError } = await admin
    .from('chat_stickers')
    .select('file_path')
    .eq('id', stickerId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (!sticker) return { error: 'Stiker tidak ditemukan.' };

  const { count, error: usageError } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('media_url', sticker.file_path)
    .eq('media_type', 'sticker');
  if (usageError) return { error: usageError.message };

  if (count === 0) {
    const { error: storageError } = await admin.storage.from('chat').remove([sticker.file_path]);
    if (storageError) return { error: 'Gagal menghapus file stiker: ' + storageError.message };
  }

  const { error } = await admin
    .from('chat_stickers')
    .delete()
    .eq('id', stickerId)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/chat');
  return { success: true };
}

export async function deleteChatMessage(messageId: string) {
  await requireRole('admin');
  if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { error: 'Pesan tidak valid.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('chat_messages')
    .delete()
    .eq('id', messageId)
    .select('id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Pesan tidak ditemukan.' };

  revalidatePath('/chat');
  return { success: true };
}
