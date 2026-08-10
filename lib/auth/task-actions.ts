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

  const { data: members } = await admin.from('profiles').select('user_id').neq('user_id', user.id);
  const notifs = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: 'task',
    title: 'Tugas baru: ' + title,
    message: subject || null,
    actor_id: user.id,
    target_type: 'task',
    target_id: taskId,
  }));
  if (notifs.length > 0) await admin.from('notifications').insert(notifs);

  revalidatePath('/tasks');
  revalidatePath('/admin/tasks');
  return { success: true };
}

export async function updateTask(formData: FormData) {
  await requireRole('teacher');
  const id = String(formData.get('id') || '');
  const title = String(formData.get('title') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const deadlineRaw = String(formData.get('deadline') || '');
  if (!id) return { error: 'ID tugas kosong.' };
  if (!title || !deadlineRaw) return { error: 'Judul dan deadline wajib diisi.' };
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return { error: 'Format deadline tidak valid.' };

  const admin = createAdminClient();
  const payload: any = {
    title,
    subject: subject || 'Umum',
    description,
    deadline: deadline.toISOString(),
  };

  const file = formData.get('attachment') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_FILE) return { error: 'Lampiran maksimal 50MB.' };
    const ext = file.name.split('.').pop() || 'pdf';
    const path = 'updates/' + id + '/attachment.' + ext;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('tasks')
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (upErr) return { error: 'Upload lampiran gagal: ' + upErr.message };
    payload.attachment_url = admin.storage.from('tasks').getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await admin.from('tasks').update(payload).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Tugas tidak ditemukan.' };

  revalidatePath('/tasks');
  revalidatePath('/admin/tasks');
  return { success: true };
}

export async function deleteTask(id: string) {
  await requireRole('teacher');
  if (!id) return { error: 'ID tugas kosong.' };
  const admin = createAdminClient();
  const { error } = await admin.from('tasks').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  revalidatePath('/admin/tasks');
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

  const { data: task } = await admin.from('tasks').select('deadline, created_by, title').eq('id', taskId).maybeSingle();
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

  if (task.created_by && task.created_by !== user.id) {
    await admin.from('notifications').insert({
      user_id: task.created_by,
      type: 'submission',
      title: user.profile.full_name + ' mengumpulkan tugas: ' + task.title,
      actor_id: user.id,
      target_type: 'task',
      target_id: taskId,
    });
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function gradeSubmission(formData: FormData) {
  const user = await requireRole('teacher');
  const id = String(formData.get('submission_id') || '');
  const grade = Number(formData.get('grade'));
  const feedback = String(formData.get('feedback') || '').trim();
  if (!id) return { error: 'ID submission kosong.' };
  if (isNaN(grade) || grade < 0 || grade > 100) return { error: 'Nilai harus 0-100.' };

  const admin = createAdminClient();
  const { data: sub } = await admin.from('task_submissions').select('user_id').eq('id', id).maybeSingle();

  const { data, error } = await admin
    .from('task_submissions')
    .update({ grade, feedback, status: 'graded' })
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: '0 baris terupdate — submission tidak ketemu.' };

  if (sub && sub.user_id !== user.id) {
    await admin.from('notifications').insert({
      user_id: sub.user_id,
      type: 'grade',
      title: 'Nilai baru: ' + grade,
      message: feedback || null,
      actor_id: user.id,
      target_type: 'task_submission',
      target_id: id,
    });
  }

  revalidatePath('/tasks');
  return { success: true };
}
