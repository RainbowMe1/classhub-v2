'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const MAX_FILE = 50 * 1024 * 1024;

export async function createTask(formData: FormData) {
  const user = await requireRole('teacher');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const taskId = randomUUID();
  let attachment_url: string | null = null;

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 50MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = user.id + '/' + taskId + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await admin.from('tasks').insert({
    id: taskId,
    created_by: user.id,
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
    attachment_url,
    status: 'active',
  });
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function submitTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get('task_id') || '');
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Pilih file jawaban dulu.' };
  if (file.size > MAX_FILE) return { error: 'File maksimal 50MB.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return { error: 'Kamu sudah mengumpulkan tugas ini.' };

  const { data: task } = await admin.from('tasks').select('deadline').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Tugas tidak ditemukan.' };
  const late = new Date(task.deadline) < new Date();

  const ext = file.name.split('.').pop() || 'bin';
  const path = user.id + '/' + taskId + '/submission.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('tasks')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;

  const { error: dbErr } = await admin.from('task_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    file_url: url,
    file_name: file.name,
    status: late ? 'late' : 'submitted',
  });
  if (dbErr) return { error: dbErr.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (!id) return { error: 'ID submission kosong.' };
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: '0 baris terupdate — submission tidak ketemu.' };
  revalidatePath('/tasks');
  return { success: true };
}
