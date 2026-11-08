'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

type AdminContext =
  | { ok: false; error: string }
  | { ok: true; userId: string; admin: ReturnType<typeof createAdminClient> };

async function requireAdmin(): Promise<AdminContext> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, is_banned')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { ok: false, error: `Gagal memverifikasi admin: ${error.message}` };
  if (!profile || profile.is_banned || profile.role !== 'admin') {
    return { ok: false, error: 'Fitur ini khusus admin aktif.' };
  }
  return { ok: true, userId: user.id, admin };
}

export async function saveAdminWhatsapp(formData: FormData) {
  const context = await requireAdmin();
  if (!context.ok) return { error: context.error };

  const rawPhone = String(formData.get('whatsapp') ?? '').trim();
  const phone = rawPhone.replace(/[\s().-]/g, '');
  if (rawPhone && (!/^\+?\d{10,15}$/.test(phone) || !/^[+()\d\s.-]+$/.test(rawPhone))) {
    return { error: 'Masukkan nomor WhatsApp yang valid, misalnya +6281234567890.' };
  }

  const { error } = await context.admin
    .from('profiles')
    .update({ whatsapp: phone || null })
    .eq('user_id', context.userId);
  if (error) return { error: `Gagal menyimpan nomor WhatsApp: ${error.message}` };

  revalidatePath('/contact');
  return { success: true };
}

export async function submitContactFeedback(formData: FormData) {
  const user = await requireUser();
  const category = String(formData.get('category') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (category !== 'saran' && category !== 'kritik') {
    return { error: 'Pilih jenis saran atau kritik.' };
  }
  if (!subject || subject.length > 120) {
    return { error: 'Judul wajib diisi dan maksimal 120 karakter.' };
  }
  if (message.length < 10 || message.length > 3000) {
    return { error: 'Pesan harus berisi 10–3.000 karakter.' };
  }

  const admin = createAdminClient();
  const { data: submission, error } = await admin
    .from('contact_feedback')
    .insert({
      sender_id: user.id,
      category,
      subject,
      message,
    })
    .select('id')
    .single();
  if (error) return { error: `Saran/kritik gagal dikirim: ${error.message}` };

  const { data: admins, error: adminsError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('role', 'admin')
    .eq('is_banned', false);
  if (adminsError) {
    revalidatePath('/contact');
    return { success: true, warning: `Pesan tersimpan, tetapi notifikasi admin gagal dimuat: ${adminsError.message}` };
  }

  if (admins?.length) {
    const { error: notificationError } = await admin.from('notifications').insert(
      admins.map((recipient) => ({
        user_id: recipient.user_id,
        type: 'contact_feedback',
        title: `Saran/kritik baru: ${subject}`,
        message: 'Ada masukan baru dari anggota kelas.',
        actor_id: user.id,
        target_type: 'contact_feedback',
        target_id: submission.id,
      })),
    );
    revalidatePath('/contact');
    if (notificationError) {
      return { success: true, warning: `Pesan tersimpan, tetapi notifikasi admin gagal dikirim: ${notificationError.message}` };
    }
  }

  revalidatePath('/contact');
  return { success: true };
}

export async function updateContactFeedbackStatus(id: string, status: string) {
  const context = await requireAdmin();
  if (!context.ok) return { error: context.error };
  if (!['baru', 'ditinjau', 'selesai'].includes(status)) {
    return { error: 'Status masukan tidak valid.' };
  }

  const { data, error } = await context.admin
    .from('contact_feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { error: `Status masukan gagal diperbarui: ${error.message}` };
  if (!data) return { error: 'Masukan tidak ditemukan.' };

  revalidatePath('/contact');
  return { success: true };
}
