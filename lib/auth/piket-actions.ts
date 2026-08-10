'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

export async function addPiket(formData: FormData) {
  try {
    await requireRole('teacher');
    const day = Number(formData.get('day'));
    const userId = String(formData.get('user_id') || '');
    if (!day || !userId) return { error: 'Pilih hari dan anggota.' };
    const admin = createAdminClient();
    const { error } = await admin.from('piket_entries').insert({ day_of_week: day, user_id: userId });
    if (error) return { error: 'DB: ' + error.message };
    revalidatePath('/piket');
    return { success: true };
  } catch (e: any) {
    return { error: 'Action: ' + (e && e.message ? e.message : 'gagal') };
  }
}

export async function updatePiket(id: string, day: number, userId: string) {
  try {
    await requireRole('teacher');
    if (!id || !day || !userId) return { error: 'Data tidak lengkap.' };
    const admin = createAdminClient();
    const { error } = await admin.from('piket_entries').update({ day_of_week: day, user_id: userId }).eq('id', id);
    if (error) return { error: 'DB: ' + error.message };
    revalidatePath('/piket');
    return { success: true };
  } catch (e: any) {
    return { error: 'Action: ' + (e && e.message ? e.message : 'gagal') };
  }
}

export async function removePiket(id: string) {
  try {
    await requireRole('teacher');
    const admin = createAdminClient();
    const { error } = await admin.from('piket_entries').delete().eq('id', id);
    if (error) return { error: 'DB: ' + error.message };
    revalidatePath('/piket');
    return { success: true };
  } catch (e: any) {
    return { error: 'Action: ' + (e && e.message ? e.message : 'gagal') };
  }
}
