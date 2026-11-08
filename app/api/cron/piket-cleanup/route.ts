import { createAdminClient } from '@/lib/supabase/admin';
import { getJakartaWeekRange } from '@/lib/piket-utils';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

const BATCH_SIZE = 100;

async function removeStoredFiles(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
  for (let index = 0; index < paths.length; index += BATCH_SIZE) {
    const batch = paths.slice(index, index + BATCH_SIZE);
    if (!batch.length) continue;

    const { error } = await admin.storage.from('piket-evidence').remove(batch);
    if (error) throw new Error('Gagal menghapus foto bukti piket: ' + error.message);
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET belum dikonfigurasi untuk pembersihan bukti piket.');
    return Response.json({ error: 'Pembersihan otomatis belum dikonfigurasi.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const weekStart = getJakartaWeekRange().start;
  let removedRecords = 0;
  let removedFiles = 0;

  try {
    const admin = createAdminClient();
    while (true) {
      const { data: pendingCleanup, error: pendingError } = await admin
        .from('piket_submissions')
        .select('id, deleted_evidence_path')
        .not('deleted_evidence_path', 'is', null)
        .limit(BATCH_SIZE);

      if (pendingError) throw new Error('Gagal memuat antrean penghapusan foto: ' + pendingError.message);
      if (!pendingCleanup?.length) break;

      const paths = pendingCleanup
        .map((row) => row.deleted_evidence_path)
        .filter((path): path is string => Boolean(path));
      await removeStoredFiles(admin, paths);
      removedFiles += paths.length;

      for (const row of pendingCleanup) {
        const { error } = await admin
          .from('piket_submissions')
          .update({ deleted_evidence_path: null })
          .eq('id', row.id)
          .eq('deleted_evidence_path', row.deleted_evidence_path);
        if (error) throw new Error('Gagal memperbarui antrean penghapusan foto: ' + error.message);
      }
    }

    while (true) {
      const { data: expired, error: expiredError } = await admin
        .from('piket_submissions')
        .select('id, evidence_path, deleted_evidence_path')
        .lt('duty_date', weekStart)
        .order('id')
        .limit(BATCH_SIZE);

      if (expiredError) throw new Error('Gagal memuat riwayat piket lama: ' + expiredError.message);
      if (!expired?.length) break;

      const paths = expired.flatMap((row) => [row.evidence_path, row.deleted_evidence_path])
        .filter((path): path is string => Boolean(path));
      await removeStoredFiles(admin, paths);
      removedFiles += paths.length;

      const ids = expired.map((row) => row.id);
      const { error: deleteError } = await admin
        .from('piket_submissions')
        .delete()
        .in('id', ids);
      if (deleteError) throw new Error('Gagal menghapus riwayat piket lama: ' + deleteError.message);
      removedRecords += ids.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kesalahan tak dikenal saat pembersihan piket.';
    console.error(message);
    return Response.json({ error: message }, { status: 500 });
  }

  if (removedRecords > 0) {
    revalidatePath('/piket');
    revalidatePath('/piket/riwayat');
    revalidatePath('/admin/piket');
  }

  return Response.json({
    success: true,
    weekStart,
    removedRecords,
    removedFiles,
  });
}
