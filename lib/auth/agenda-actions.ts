'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

const CATEGORIES = ['umum', 'ujian', 'libur', 'acara'] as const;

type AgendaFields = {
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  category: (typeof CATEGORIES)[number];
};

type AgendaActionResult =
  | { error: string }
  | { success: true; warning: string | null };

type StaffContextResult =
  | { ok: false; error: string }
  | { ok: true; user: Awaited<ReturnType<typeof requireUser>>; admin: ReturnType<typeof createAdminClient> };

function isStaff(role: string) {
  return role === 'admin' || role === 'teacher';
}

async function getStaffContext(): Promise<StaffContextResult> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, is_banned')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { ok: false, error: `Gagal memverifikasi hak akses: ${error.message}` };
  if (!profile || profile.is_banned) return { ok: false, error: 'Profil tidak ditemukan atau tidak aktif.' };
  if (!isStaff(profile.role)) return { ok: false, error: 'Khusus admin/guru.' };
  return { ok: true, user, admin };
}

function readAgendaForm(formData: FormData): { error: string } | { value: AgendaFields } {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const eventDate = String(formData.get('event_date') ?? '').trim();
  const eventTime = String(formData.get('event_time') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();

  if (!title || title.length > 120) {
    return { error: 'Judul agenda wajib diisi dan maksimal 120 karakter.' };
  }
  if (description.length > 2000) {
    return { error: 'Deskripsi maksimal 2.000 karakter.' };
  }
  const parsedDate = new Date(`${eventDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== eventDate
  ) {
    return { error: 'Tanggal agenda tidak valid.' };
  }
  if (eventTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)) {
    return { error: 'Waktu agenda tidak valid.' };
  }
  if (location.length > 160) {
    return { error: 'Lokasi maksimal 160 karakter.' };
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: 'Kategori agenda tidak valid.' };
  }

  return {
    value: {
      title,
      description: description || null,
      event_date: eventDate,
      event_time: eventTime || null,
      location: location || null,
      category: category as AgendaFields['category'],
    },
  };
}

async function notifyMembers(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  agendaId: string,
  title: string,
  verb: 'baru' | 'diperbarui',
) {
  const { data: members, error: membersError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('is_banned', false)
    .neq('user_id', actorId);
  if (membersError) return `Agenda tersimpan, tetapi daftar penerima notifikasi gagal dimuat: ${membersError.message}`;
  if (!members?.length) return null;

  const { error } = await admin.from('notifications').insert(
    members.map((member) => ({
      user_id: member.user_id,
      type: 'agenda',
      title: `Agenda ${verb}: ${title}`,
      message: `Agenda kelas "${title}" ${verb}. Buka menu Agenda untuk detailnya.`,
      actor_id: actorId,
      target_type: 'agenda',
      target_id: agendaId,
    })),
  );
  return error ? `Agenda tersimpan, tetapi notifikasi gagal dikirim: ${error.message}` : null;
}

export async function getAgendas(): Promise<{ data: unknown[] | null; error: string | null }> {
  await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('agendas')
    .select('*')
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function addAgenda(formData: FormData): Promise<AgendaActionResult> {
  const context = await getStaffContext();
  if (!context.ok) return { error: context.error };
  const parsed = readAgendaForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const { user, admin } = context;
  const { data, error } = await admin
    .from('agendas')
    .insert({ ...parsed.value, created_by: user.id })
    .select('id, title')
    .single();
  if (error) return { error: error.message };

  const warning = await notifyMembers(admin, user.id, data.id, data.title, 'baru');
  revalidatePath('/agenda');
  return { success: true, warning };
}

export async function updateAgenda(id: string, formData: FormData): Promise<AgendaActionResult> {
  const context = await getStaffContext();
  if (!context.ok) return { error: context.error };
  const parsed = readAgendaForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const { user, admin } = context;
  const { data, error } = await admin
    .from('agendas')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, title')
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Agenda tidak ditemukan.' };

  const warning = await notifyMembers(admin, user.id, data.id, data.title, 'diperbarui');
  revalidatePath('/agenda');
  return { success: true, warning };
}

export async function deleteAgenda(id: string): Promise<{ error: string } | { success: true }> {
  const context = await getStaffContext();
  if (!context.ok) return { error: context.error };

  const { admin } = context;
  const { error, count } = await admin.from('agendas').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: error.message };
  if (count === 0) return { error: 'Agenda tidak ditemukan.' };

  revalidatePath('/agenda');
  return { success: true };
}
