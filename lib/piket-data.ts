import { createAdminClient } from '@/lib/supabase/admin';
import { getJakartaWeekRange } from '@/lib/piket-utils';

export type PiketStatus = {
  piket_entry_id: string | null;
  user_id: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  duty_date: string;
};

export type PiketHistoryRow = {
  id: string;
  piket_entry_id: string | null;
  user_id: string;
  student_name: string;
  group_label: string;
  duty_date: string;
  submitted_at: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  evidence_url: string | null;
};

export type PiketQueryResult<T> = {
  rows: T[];
  setupRequired: boolean;
};

function isMissingSubmissionsTable(error: { code?: string; message?: string }) {
  return error.code === 'PGRST205'
    || error.message?.includes("Could not find the table 'public.piket_submissions' in the schema cache");
}

export async function getPiketStatuses(userId?: string): Promise<PiketQueryResult<PiketStatus>> {
  const admin = createAdminClient();
  const week = getJakartaWeekRange();
  let query = admin
    .from('piket_submissions')
    .select('piket_entry_id, user_id, status, rejection_reason, duty_date')
    .gte('duty_date', week.start)
    .lte('duty_date', week.end)
    .order('duty_date', { ascending: false });

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error && isMissingSubmissionsTable(error)) return { rows: [], setupRequired: true };
  if (error) throw new Error('Gagal memuat status piket: ' + error.message);
  return {
    rows: ((data ?? []) as PiketStatus[]).map((row) => ({
      ...row,
      rejection_reason: userId ? row.rejection_reason : null,
    })),
    setupRequired: false,
  };
}

export async function getPiketHistory(userId?: string): Promise<PiketQueryResult<PiketHistoryRow>> {
  const admin = createAdminClient();
  let query = admin
    .from('piket_submissions')
    .select('id, piket_entry_id, user_id, student_name, group_label, duty_date, submitted_at, status, rejection_reason, evidence_path')
    .order('submitted_at', { ascending: false });

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error && isMissingSubmissionsTable(error)) return { rows: [], setupRequired: true };
  if (error) throw new Error('Gagal memuat riwayat piket: ' + error.message);

  const rows = await Promise.all((data ?? []).map(async (row) => {
    if (!row.evidence_path) {
      return {
        id: row.id,
        piket_entry_id: row.piket_entry_id,
        user_id: row.user_id,
        student_name: row.student_name,
        group_label: row.group_label,
        duty_date: row.duty_date,
        submitted_at: row.submitted_at,
        status: row.status,
        rejection_reason: row.rejection_reason,
        evidence_url: null,
      };
    }

    const { data: signed, error: signedError } = await admin.storage
      .from('piket-evidence')
      .createSignedUrl(row.evidence_path, 3600);

    if (signedError) throw new Error('Gagal membuka bukti piket: ' + signedError.message);

    return {
      id: row.id,
      piket_entry_id: row.piket_entry_id,
      user_id: row.user_id,
      student_name: row.student_name,
      group_label: row.group_label,
      duty_date: row.duty_date,
      submitted_at: row.submitted_at,
      status: row.status,
      rejection_reason: row.rejection_reason,
      evidence_url: signed.signedUrl,
    };
  }));
  return { rows, setupRequired: false };
}
