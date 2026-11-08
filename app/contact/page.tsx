import { requireUser } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import ContactAdminPage, { type AdminContact, type FeedbackItem } from '@/components/contact/ContactAdminPage';

export default async function ContactPage() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: admins, error: contactError } = await admin
    .from('profiles')
    .select('user_id, full_name, username, email, instagram, whatsapp')
    .eq('role', 'admin')
    .eq('is_banned', false)
    .order('full_name');

  const contacts = (admins ?? []) as AdminContact[];
  let feedback: FeedbackItem[] = [];
  let feedbackError = '';

  if (user.profile.role === 'admin') {
    const { data: submissions, error } = await admin
      .from('contact_feedback')
      .select('id, sender_id, category, subject, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      feedbackError = error.message;
    } else if (submissions?.length) {
      const senderIds = [...new Set(submissions.map((item) => item.sender_id))];
      const { data: senders, error: sendersError } = await admin
        .from('profiles')
        .select('user_id, full_name, username')
        .in('user_id', senderIds);

      if (sendersError) {
        feedbackError = `Masukan berhasil dimuat, tetapi data pengirim gagal dimuat: ${sendersError.message}`;
      }

      const senderById = new Map((senders ?? []).map((sender) => [sender.user_id, sender]));
      feedback = submissions.map((item) => {
        const sender = senderById.get(item.sender_id);
        return {
          ...item,
          sender_name: sender?.full_name ?? 'Anggota',
          sender_username: sender?.username ?? '',
        };
      }) as FeedbackItem[];
    }
  }

  return (
    <AppLayout profile={user.profile}>
      <ContactAdminPage
        currentUserId={user.id}
        isAdmin={user.profile.role === 'admin'}
        contacts={contacts}
        contactError={contactError?.message ?? ''}
        feedback={feedback}
        feedbackError={feedbackError}
      />
    </AppLayout>
  );
}
