'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock3,
  ContactRound,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';
import {
  saveAdminWhatsapp,
  submitContactFeedback,
  updateContactFeedbackStatus,
} from '@/lib/auth/contact-actions';

export type AdminContact = {
  user_id: string;
  full_name: string;
  username: string;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
};

export type FeedbackItem = {
  id: string;
  sender_id: string;
  category: 'saran' | 'kritik';
  subject: string;
  message: string;
  status: 'baru' | 'ditinjau' | 'selesai';
  created_at: string;
  sender_name: string;
  sender_username: string;
};

function whatsappHref(value: string) {
  let number = value.replace(/\D/g, '');
  if (number.startsWith('0')) number = `62${number.slice(1)}`;
  return `https://wa.me/${number}`;
}

function instagramHref(value: string) {
  const username = value
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];
  return username ? `https://www.instagram.com/${encodeURIComponent(username)}/` : null;
}

function displayEmail(value: string | null) {
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith('@classhub.local')
    ? value
    : null;
}

function feedbackStatusLabel(status: FeedbackItem['status']) {
  if (status === 'ditinjau') return 'Sedang ditinjau';
  if (status === 'selesai') return 'Selesai';
  return 'Baru';
}

export default function ContactAdminPage({
  currentUserId,
  isAdmin,
  contacts,
  contactError,
  feedback: initialFeedback,
  feedbackError,
}: {
  currentUserId: string;
  isAdmin: boolean;
  contacts: AdminContact[];
  contactError: string;
  feedback: FeedbackItem[];
  feedbackError: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFeedback);
  const [feedbackType, setFeedbackType] = useState<'saran' | 'kritik'>('saran');
  const [submitting, setSubmitting] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState('');
  const [contactNotice, setContactNotice] = useState('');
  const [contactErrorMessage, setContactErrorMessage] = useState('');

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setFeedbackNotice('');
    setFeedbackErrorMessage('');
    try {
      const result = await submitContactFeedback(new FormData(form));
      if (result.error) {
        setFeedbackErrorMessage(result.error);
        return;
      }
      form.reset();
      setFeedbackType('saran');
      setFeedbackNotice(result.warning || 'Masukan berhasil dikirim ke admin. Terima kasih!');
    } catch (error) {
      setFeedbackErrorMessage(error instanceof Error ? error.message : 'Masukan gagal dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveWhatsapp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingWhatsapp(true);
    setContactNotice('');
    setContactErrorMessage('');
    try {
      const result = await saveAdminWhatsapp(new FormData(event.currentTarget));
      if (result.error) {
        setContactErrorMessage(result.error);
        return;
      }
      setContactNotice('Nomor WhatsApp admin berhasil disimpan.');
      router.refresh();
    } catch (error) {
      setContactErrorMessage(error instanceof Error ? error.message : 'Kontak gagal disimpan. Coba lagi.');
    } finally {
      setSavingWhatsapp(false);
    }
  }

  async function changeStatus(id: string, status: FeedbackItem['status']) {
    setUpdatingId(id);
    setFeedbackErrorMessage('');
    try {
      const result = await updateContactFeedbackStatus(id, status);
      if (result.error) {
        setFeedbackErrorMessage(result.error);
        return;
      }
      setFeedback((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
    } catch (error) {
      setFeedbackErrorMessage(error instanceof Error ? error.message : 'Status masukan gagal diperbarui.');
    } finally {
      setUpdatingId(null);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-acc/50';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-mut">
          <ContactRound className="h-4 w-4 text-acc" />
          Pusat bantuan kelas
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Kontak Admin</h1>
        <p className="max-w-2xl text-sm text-mut">
          Hubungi admin melalui kontak yang tersedia, atau kirimkan saran dan kritik untuk membantu ClassHub menjadi lebih baik.
        </p>
      </header>

      <section aria-labelledby="admin-contacts-heading" className="space-y-3">
        <div>
          <h2 id="admin-contacts-heading" className="text-lg font-bold">Admin yang bisa dihubungi</h2>
          <p className="mt-1 text-xs text-mut">Kontak hanya ditampilkan jika admin sudah mengisinya.</p>
        </div>

        {contactError ? (
          <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Kontak admin gagal dimuat: {contactError}. Pastikan migrasi database kontak sudah dijalankan.
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-mut">
            Belum ada admin aktif yang terdaftar.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {contacts.map((contact) => {
              const email = displayEmail(contact.email);
              const instagram = contact.instagram ? instagramHref(contact.instagram) : null;
              const whatsapp = contact.whatsapp?.trim() ? whatsappHref(contact.whatsapp) : null;
              const isOwnContact = isAdmin && contact.user_id === currentUserId;
              return (
                <article key={contact.user_id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{contact.full_name}</h3>
                      <p className="mt-0.5 text-xs text-mut">@{contact.username} · Admin</p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-acc/20 bg-acc/10 text-acc">
                      <ContactRound className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-mut transition hover:bg-card-2 hover:text-ink"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-acc" />
                        <span className="truncate">{email}</span>
                      </a>
                    )}
                    {instagram && (
                      <a
                        href={instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-mut transition hover:bg-card-2 hover:text-ink"
                      >
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-current text-[9px] font-bold" aria-hidden="true">IG</span>
                        <span className="truncate">{contact.instagram?.replace(/^@/, '')}</span>
                      </a>
                    )}
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-mut transition hover:bg-card-2 hover:text-ink"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0 text-acc" />
                        <span className="truncate">{contact.whatsapp}</span>
                        <span className="ml-auto text-[10px] font-semibold text-acc">WhatsApp</span>
                      </a>
                    )}
                    {!email && !instagram && !whatsapp && !isOwnContact && (
                      <p className="rounded-lg bg-card-2 px-3 py-2 text-xs text-mut">Admin ini belum menambahkan kontak.</p>
                    )}
                  </div>

                  {isOwnContact && (
                    <form onSubmit={saveWhatsapp} className="mt-4 border-t border-line pt-4">
                      <label htmlFor="admin-whatsapp" className="mb-1.5 block text-xs font-semibold text-mut">
                        Nomor WhatsApp Anda
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="admin-whatsapp"
                          name="whatsapp"
                          type="tel"
                          defaultValue={contact.whatsapp ?? ''}
                          placeholder="+6281234567890"
                          autoComplete="tel"
                          className={`${inputClass} min-w-0`}
                          aria-describedby="whatsapp-hint"
                        />
                        <button
                          type="submit"
                          disabled={savingWhatsapp}
                          className="min-h-11 shrink-0 rounded-xl bg-acc px-3 text-xs font-bold text-acc-ink transition hover:brightness-110 disabled:opacity-50"
                        >
                          {savingWhatsapp ? '...' : 'Simpan'}
                        </button>
                      </div>
                      <p id="whatsapp-hint" className="mt-1.5 text-[10px] text-mut">
                        Gunakan format internasional, misalnya +62.
                      </p>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {contactNotice && <p role="status" className="text-xs text-acc">{contactNotice}</p>}
        {contactErrorMessage && <p role="alert" className="text-xs text-red-400">{contactErrorMessage}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={sendFeedback} className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <div>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl border border-acc/20 bg-acc/10 text-acc">
              <Send className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">Saran dan kritik</h2>
            <p className="mt-1 text-xs leading-relaxed text-mut">
              Masukanmu akan dikirim langsung ke inbox admin. Pesan hanya bisa dibaca oleh admin.
            </p>
          </div>
          <div>
            <label htmlFor="feedback-category" className="mb-1.5 block text-xs font-semibold text-mut">Jenis masukan</label>
            <select
              id="feedback-category"
              name="category"
              value={feedbackType}
              onChange={(event) => setFeedbackType(event.target.value as 'saran' | 'kritik')}
              className={inputClass}
            >
              <option value="saran">Saran</option>
              <option value="kritik">Kritik</option>
            </select>
          </div>
          <div>
            <label htmlFor="feedback-subject" className="mb-1.5 block text-xs font-semibold text-mut">Judul</label>
            <input id="feedback-subject" name="subject" required maxLength={120} className={inputClass} placeholder="Ringkas topik masukanmu" />
          </div>
          <div>
            <label htmlFor="feedback-message" className="mb-1.5 block text-xs font-semibold text-mut">Pesan</label>
            <textarea
              id="feedback-message"
              name="message"
              required
              minLength={10}
              maxLength={3000}
              rows={5}
              className={`${inputClass} resize-y`}
              placeholder="Ceritakan saran atau kritik dengan jelas..."
            />
            <p className="mt-1.5 text-[10px] text-mut">10–3.000 karakter · Nama akunmu disertakan agar admin bisa menindaklanjuti.</p>
          </div>
          {feedbackNotice && <div role="status" className="rounded-lg border border-acc/20 bg-acc/5 p-3 text-xs text-acc">{feedbackNotice}</div>}
          {feedbackErrorMessage && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">{feedbackErrorMessage}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-acc px-4 text-sm font-bold text-acc-ink transition hover:brightness-110 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Mengirim...' : 'Kirim masukan'}
          </button>
        </form>

        {isAdmin && (
          <section aria-labelledby="feedback-inbox-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="feedback-inbox-heading" className="text-lg font-bold">Inbox masukan</h2>
                <p className="mt-1 text-xs text-mut">Maksimal 100 masukan terbaru.</p>
              </div>
              <span className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold text-mut">
                {feedback.length} pesan
              </span>
            </div>
            {feedbackError && (
              <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                Inbox gagal dimuat: {feedbackError}. Pastikan migrasi database kontak sudah dijalankan.
              </div>
            )}
            {feedbackErrorMessage && <div role="alert" className="text-xs text-red-400">{feedbackErrorMessage}</div>}
            {!feedbackError && feedback.length === 0 ? (
              <div className="rounded-2xl border border-line bg-card px-5 py-10 text-center text-sm text-mut">
                Belum ada saran atau kritik masuk.
              </div>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {feedback.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${
                          item.category === 'kritik' ? 'bg-amber-500/10 text-amber-400' : 'bg-acc/10 text-acc'
                        }`}>
                          {item.category === 'kritik' ? 'Kritik' : 'Saran'}
                        </span>
                        <h3 className="mt-2 font-bold">{item.subject}</h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-mut">
                        <Clock3 className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-mut">Dari {item.sender_name}{item.sender_username ? ` (@${item.sender_username})` : ''}</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/90">{item.message}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                        item.status === 'selesai' ? 'bg-acc/10 text-acc' : 'bg-card-2 text-mut'
                      }`}>
                        {feedbackStatusLabel(item.status)}
                      </span>
                      <label className="flex items-center gap-2 text-[10px] text-mut">
                        Status
                        <select
                          value={item.status}
                          disabled={updatingId === item.id}
                          onChange={(event) => void changeStatus(item.id, event.target.value as FeedbackItem['status'])}
                          className="rounded-lg border border-line bg-card-2 px-2 py-1.5 text-xs text-ink disabled:opacity-50"
                          aria-label={`Ubah status: ${item.subject}`}
                        >
                          <option value="baru">Baru</option>
                          <option value="ditinjau">Sedang ditinjau</option>
                          <option value="selesai">Selesai</option>
                        </select>
                        {item.status === 'selesai' && <Check className="h-3.5 w-3.5 text-acc" />}
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
