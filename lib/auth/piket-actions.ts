'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole, requireUser } from '@/lib/auth/actions';
import { getJakartaDate, getJakartaWeekday } from '@/lib/piket-utils';
import { revalidatePath } from 'next/cache';

export async function addPiket(formData: FormData) {
  await requireRole('teacher');
  const day = Number(formData.get('day'));
  const userId = String(formData.get('user_id') || '');
  if (!Number.isInteger(day) || day < 1 || day > 7 || !userId) return { error: 'Pilih hari dan anggota.' };
  const admin = createAdminClient();
  const { error } = await admin.from('piket_entries').insert({ day_of_week: day, user_id: userId });
  if (error) return { error: 'DB: ' + error.message };
  revalidatePath('/piket');
  return { success: true };
}

export async function updatePiket(id: string, day: number, userId: string) {
  await requireRole('teacher');
  if (!id || !Number.isInteger(day) || day < 1 || day > 7 || !userId) return { error: 'Data tidak lengkap.' };
  const admin = createAdminClient();
  const { error } = await admin.from('piket_entries').update({ day_of_week: day, user_id: userId }).eq('id', id);
  if (error) return { error: 'DB: ' + error.message };
  revalidatePath('/piket');
  return { success: true };
}

export async function removePiket(id: string) {
  await requireRole('teacher');
  if (!id) return { error: 'Jadwal tidak valid.' };
  const admin = createAdminClient();
  const { error } = await admin.from('piket_entries').delete().eq('id', id);
  if (error) return { error: 'DB: ' + error.message };
  revalidatePath('/piket');
  return { success: true };
}

export async function submitPiketEvidence(piketEntryId: string, photoDataUrl: string) {
  const user = await requireUser();
  if (user.profile.role !== 'student') return { error: 'Fitur ini khusus siswa.' };
  if (typeof piketEntryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(piketEntryId)) {
    return { error: 'Jadwal piket tidak valid.' };
  }
  if (typeof photoDataUrl !== 'string' || photoDataUrl.length > 2100000) {
    return { error: 'Ukuran foto maksimal 1,5 MB.' };
  }

  const dayLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const dutyDate = getJakartaDate();
  const weekdayNumber = getJakartaWeekday();
  const admin = createAdminClient();
  const { data: entry, error: entryError } = await admin
    .from('piket_entries')
    .select('id, user_id, day_of_week')
    .eq('id', piketEntryId)
    .maybeSingle();

  if (entryError) return { error: 'Gagal memeriksa jadwal: ' + entryError.message };
  if (!entry || entry.user_id !== user.id) return { error: 'Jadwal piket ini bukan milikmu.' };
  if (entry.day_of_week !== weekdayNumber) return { error: 'Bukti hanya dapat dikirim pada hari jadwal piket.' };

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoDataUrl);
  if (!match) return { error: 'Foto harus diambil langsung dari kamera.' };
  const photo = Buffer.from(match[1], 'base64');
  if (photo.length < 4 || photo.length > 1572864) return { error: 'Ukuran foto maksimal 1,5 MB.' };
  if (photo[0] !== 0xff || photo[1] !== 0xd8 || photo[2] !== 0xff) {
    return { error: 'Format foto tidak valid.' };
  }

  const { data: existing, error: existingError } = await admin
    .from('piket_submissions')
    .select('id, user_id, status, evidence_path')
    .eq('piket_entry_id', piketEntryId)
    .eq('user_id', user.id)
    .eq('duty_date', dutyDate)
    .maybeSingle();
  if (existingError) return { error: 'Gagal memeriksa bukti sebelumnya: ' + existingError.message };
  if (existing && existing.status !== 'rejected') {
    return { error: 'Bukti untuk jadwal ini sudah dikirim.' };
  }

  const evidencePath = user.id + '/' + piketEntryId + '/' + crypto.randomUUID() + '.jpg';
  const { error: uploadError } = await admin.storage
    .from('piket-evidence')
    .upload(evidencePath, photo, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) return { error: 'Gagal menyimpan foto: ' + uploadError.message };

  if (existing) {
    const { data: updated, error: updateError } = await admin
      .from('piket_submissions')
      .update({
        evidence_path: evidencePath,
        status: 'pending',
        rejection_reason: null,
      })
      .eq('id', existing.id)
      .eq('status', 'rejected')
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      const { error: cleanupError } = await admin.storage.from('piket-evidence').remove([evidencePath]);
      const cleanupMessage = cleanupError ? ' Foto baru juga belum dapat dibersihkan.' : '';
      return { error: (updateError ? 'Gagal mengirim ulang bukti: ' + updateError.message : 'Bukti sudah diperbarui. Muat ulang halaman.') + cleanupMessage };
    }

    const { error: removeError } = existing.evidence_path
      ? await admin.storage.from('piket-evidence').remove([existing.evidence_path])
      : { error: null };
    if (removeError) {
      revalidatePath('/piket');
      revalidatePath('/piket/riwayat');
      revalidatePath('/admin/piket');
      return { success: true, warning: 'Bukti terkirim, tetapi foto lama tidak dapat dibersihkan.' };
    }
  } else {
    const { error: insertError } = await admin.from('piket_submissions').insert({
      piket_entry_id: piketEntryId,
      user_id: user.id,
      student_name: user.profile.full_name,
      group_label: 'Kelompok ' + dayLabels[entry.day_of_week - 1],
      evidence_path: evidencePath,
    });

    if (insertError) {
      const { error: cleanupError } = await admin.storage.from('piket-evidence').remove([evidencePath]);
      if (cleanupError) {
        return { error: 'Gagal mencatat bukti: ' + insertError.message + '. Foto sementara juga belum dapat dibersihkan.' };
      }
      if (insertError.code === '23505') return { error: 'Bukti untuk jadwal ini sudah dikirim.' };
      return { error: 'Gagal mencatat bukti: ' + insertError.message };
    }
  }

  revalidatePath('/piket');
  revalidatePath('/piket/riwayat');
  revalidatePath('/admin/piket');
  return { success: true };
}

export async function reviewPiketSubmission(
  id: string,
  status: 'verified' | 'rejected',
  rejectionReason: string,
) {
  const user = await requireRole('teacher');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || (status !== 'verified' && status !== 'rejected')) {
    return { error: 'Permintaan verifikasi tidak valid.' };
  }
  if (typeof rejectionReason !== 'string') return { error: 'Alasan penolakan tidak valid.' };

  const reason = rejectionReason.trim();
  if (status === 'rejected' && !reason) return { error: 'Alasan penolakan wajib diisi.' };
  if (reason.length > 500) return { error: 'Alasan penolakan maksimal 500 karakter.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('piket_submissions')
    .update({
      status,
      rejection_reason: status === 'rejected' ? reason : null,
      reviewed_by: user.id,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Gagal memperbarui status: ' + error.message };
  if (!data) return { error: 'Bukti sudah ditinjau atau tidak ditemukan.' };

  revalidatePath('/piket');
  revalidatePath('/piket/riwayat');
  revalidatePath('/admin/piket');
  return { success: true };
}

export async function deletePiketEvidence(id: string, reason: string) {
  const user = await requireRole('teacher');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { error: 'Bukti piket tidak valid.' };
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return { error: 'Alasan penghapusan wajib diisi.' };
  }
  if (reason.trim().length > 500) {
    return { error: 'Alasan penghapusan maksimal 500 karakter.' };
  }

  const admin = createAdminClient();
  const { data: submission, error: submissionError } = await admin
    .from('piket_submissions')
    .select('id, evidence_path')
    .eq('id', id)
    .maybeSingle();

  if (submissionError) return { error: 'Gagal memeriksa bukti: ' + submissionError.message };
  if (!submission || !submission.evidence_path) return { error: 'Foto bukti sudah dihapus atau tidak ditemukan.' };

  const { data: updated, error: updateError } = await admin
    .from('piket_submissions')
    .update({
      evidence_path: null,
      deleted_evidence_path: submission.evidence_path,
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_by: user.id,
    })
    .eq('id', id)
    .eq('evidence_path', submission.evidence_path)
    .select('id')
    .maybeSingle();

  if (updateError) return { error: 'Gagal menandai bukti untuk dikirim ulang: ' + updateError.message };
  if (!updated) return { error: 'Bukti berubah saat diproses. Muat ulang halaman lalu coba lagi.' };

  const { error: removeError } = await admin.storage
    .from('piket-evidence')
    .remove([submission.evidence_path]);
  if (removeError) {
    revalidatePath('/piket');
    revalidatePath('/piket/riwayat');
    revalidatePath('/admin/piket');
    return {
      success: true,
      warning: 'Bukti ditolak dan siswa dapat mengirim ulang, tetapi file foto belum terhapus dari penyimpanan. Pembersihan otomatis akan mencoba lagi.',
    };
  }

  const { error: clearPendingPathError } = await admin
    .from('piket_submissions')
    .update({ deleted_evidence_path: null })
    .eq('id', id)
    .eq('deleted_evidence_path', submission.evidence_path);
  if (clearPendingPathError) {
    revalidatePath('/piket');
    revalidatePath('/piket/riwayat');
    revalidatePath('/admin/piket');
    return {
      success: true,
      warning: 'Foto sudah dihapus dan siswa dapat mengirim ulang, tetapi penanda pembersihan belum diperbarui.',
    };
  }

  revalidatePath('/piket');
  revalidatePath('/piket/riwayat');
  revalidatePath('/admin/piket');
  return { success: true };
}
