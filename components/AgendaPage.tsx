'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { addAgenda, deleteAgenda, getAgendas, updateAgenda } from '@/lib/auth/agenda-actions';

export type Agenda = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  category: string;
};

type AgendaForm = {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  category: string;
};

const CATEGORIES = [
  { value: 'umum', label: 'Umum', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'ujian', label: 'Ujian', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { value: 'libur', label: 'Libur', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { value: 'acara', label: 'Acara Kelas', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
];

const EMPTY_FORM: AgendaForm = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  location: '',
  category: 'umum',
};

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isUpcoming(agenda: Agenda, timestamp: number) {
  const now = new Date(timestamp);
  const today = localDateKey(now);
  if (agenda.event_date !== today) return agenda.event_date > today;
  if (!agenda.event_time) return true;
  const [hours, minutes] = agenda.event_time.split(':').map(Number);
  return hours * 60 + minutes >= now.getHours() * 60 + now.getMinutes();
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.';
}

export default function AgendaPage({
  role,
  initialAgendas,
  initialError,
}: {
  role: string;
  initialAgendas: Agenda[];
  initialError: string;
}) {
  const [agendas, setAgendas] = useState<Agenda[]>(initialAgendas);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [noticeIsWarning, setNoticeIsWarning] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editing, setEditing] = useState<Agenda | null>(null);
  const [form, setForm] = useState<AgendaForm>(EMPTY_FORM);

  const isStaff = role === 'admin' || role === 'teacher';

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadAgendas() {
    setLoading(true);
    setError('');
    try {
      const result = await getAgendas();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAgendas((result.data ?? []) as Agenda[]);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, event_date: localDateKey(new Date()) });
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function openEdit(agenda: Agenda) {
    setEditing(agenda);
    setForm({
      title: agenda.title,
      description: agenda.description ?? '',
      event_date: agenda.event_date,
      event_time: agenda.event_time?.slice(0, 5) ?? '',
      location: agenda.location ?? '',
      category: agenda.category,
    });
    setFormOpen(true);
    setError('');
    setNotice('');
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function saveAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const formData = new FormData(event.currentTarget);
    try {
      const result = editing
        ? await updateAgenda(editing.id, formData)
        : await addAgenda(formData);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      closeForm();
      const warning = 'warning' in result ? result.warning : null;
      setNotice(warning || (editing ? 'Agenda berhasil diperbarui.' : 'Agenda baru berhasil ditambahkan.'));
      setNoticeIsWarning(Boolean(warning));
      await loadAgendas();
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function removeAgenda(agenda: Agenda) {
    if (!window.confirm(`Hapus agenda "${agenda.title}"?`)) return;
    setError('');
    setNotice('');
    try {
      const result = await deleteAgenda(agenda.id);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setNotice('Agenda berhasil dihapus.');
      setNoticeIsWarning(false);
      await loadAgendas();
    } catch (deleteError) {
      setError(errorText(deleteError));
    }
  }

  const filteredAgendas = agendas.filter((agenda) => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    const matchesText =
      !query ||
      agenda.title.toLocaleLowerCase('id-ID').includes(query) ||
      (agenda.description ?? '').toLocaleLowerCase('id-ID').includes(query) ||
      (agenda.location ?? '').toLocaleLowerCase('id-ID').includes(query);
    return (
      matchesText &&
      (!categoryFilter || agenda.category === categoryFilter) &&
      (!dateFilter || agenda.event_date === dateFilter)
    );
  });

  const inputClass =
    'w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-acc/50';
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const dayOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: dayOffset + daysInMonth }, (_, index) =>
    index < dayOffset ? null : index - dayOffset + 1,
  );
  const agendaDates = new Set(agendas.map((agenda) => agenda.event_date));
  const monthTitle = month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-mut">
            <CalendarDays className="h-4 w-4 text-acc" />
            Ruang kelas
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda Kelas</h1>
          <p className="mt-1 text-sm text-mut">Semua tanggal penting kelas, tersusun di satu tempat.</p>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-acc px-4 py-2 text-sm font-bold text-acc-ink shadow-sm transition hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Tambah agenda
          </button>
        )}
      </header>

      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            noticeIsWarning
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-acc/30 bg-acc/10 text-acc'
          }`}
        >
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_170px_auto]">
          <label className="relative block">
            <span className="sr-only">Cari agenda</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari agenda atau lokasi..."
              className={`${inputClass} pl-9`}
            />
          </label>
          <label>
            <span className="sr-only">Filter kategori</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
              <option value="">Semua kategori</option>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter tanggal</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex rounded-xl border border-line bg-card-2 p-1">
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-semibold transition ${
                view === 'list' ? 'bg-acc text-acc-ink' : 'text-mut hover:text-ink'
              }`}
            >
              Daftar
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              aria-pressed={view === 'calendar'}
              className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-semibold transition ${
                view === 'calendar' ? 'bg-acc text-acc-ink' : 'text-mut hover:text-ink'
              }`}
            >
              Kalender
            </button>
          </div>
        </div>
        {dateFilter && (
          <button type="button" onClick={() => setDateFilter('')} className="mt-3 text-xs font-semibold text-acc hover:underline">
            Hapus filter tanggal
          </button>
        )}
      </section>

      {view === 'calendar' && (
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Bulan sebelumnya"
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-mut transition hover:border-acc/40 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-bold capitalize">{monthTitle}</h2>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Bulan berikutnya"
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-mut transition hover:border-acc/40 hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-mut sm:text-xs">
                {day}
              </div>
            ))}
            {calendarCells.map((day, index) => {
              const date = day ? localDateKey(new Date(month.getFullYear(), month.getMonth(), day)) : '';
              const hasAgenda = Boolean(date && agendaDates.has(date));
              const isSelected = Boolean(date && date === dateFilter);
              return (
                <button
                  type="button"
                  key={`${date || 'empty'}-${index}`}
                  disabled={!day}
                  onClick={() => setDateFilter(isSelected ? '' : date)}
                  aria-label={day ? `${day} ${monthTitle}${hasAgenda ? ', ada agenda' : ''}` : undefined}
                  aria-pressed={day ? isSelected : undefined}
                  className={`relative min-h-11 rounded-xl border text-sm transition sm:min-h-14 ${
                    !day
                      ? 'border-transparent'
                      : isSelected
                        ? 'border-acc bg-acc/15 font-bold text-acc'
                        : hasAgenda
                          ? 'border-acc/20 bg-acc/5 text-ink hover:border-acc/50'
                          : 'border-line bg-card-2/50 text-mut hover:border-acc/30 hover:text-ink'
                  }`}
                >
                  {day}
                  {hasAgenda && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-acc" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-live="polite">
        {loading ? (
          <div className="rounded-2xl border border-line bg-card py-14 text-center text-sm text-mut">Memuat agenda...</div>
        ) : filteredAgendas.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card px-5 py-14 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-mut" />
            <p className="font-semibold">Agenda tidak ditemukan</p>
            <p className="mt-1 text-sm text-mut">
              {agendas.length ? 'Coba ubah pencarian atau filter yang dipilih.' : 'Belum ada agenda kelas yang ditambahkan.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAgendas.map((agenda) => {
              const upcoming = isUpcoming(agenda, clockNow);
              const category = CATEGORIES.find((item) => item.value === agenda.category) ?? CATEGORIES[0];
              return (
                <article
                  key={agenda.id}
                  className="group flex gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:border-acc/30 hover:shadow-md sm:gap-4 sm:p-5"
                >
                  <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-xl border border-acc/15 bg-acc/5 text-acc">
                    <span className="text-xl font-black leading-none">
                      {new Date(`${agenda.event_date}T12:00:00`).getDate()}
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">
                      {new Date(`${agenda.event_date}T12:00:00`).toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 text-sm font-bold sm:text-base">{agenda.title}</h2>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${category.color}`}>
                        {category.label}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          upcoming ? 'bg-acc/10 text-acc' : 'bg-line text-mut'
                        }`}
                      >
                        {upcoming ? 'Mendatang' : 'Selesai'}
                      </span>
                    </div>
                    <p className="text-xs text-mut">{dateLabel(agenda.event_date)}</p>
                    {agenda.description && <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{agenda.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mut">
                      {agenda.event_time && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {agenda.event_time.slice(0, 5)}
                        </span>
                      )}
                      {agenda.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {agenda.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {isStaff && (
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => openEdit(agenda)}
                        aria-label={`Edit ${agenda.title}`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-mut transition hover:bg-acc/10 hover:text-acc"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeAgenda(agenda)}
                        aria-label={`Hapus ${agenda.title}`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-mut transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isStaff && formOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={closeForm}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="agenda-dialog-title" className="text-lg font-bold">
                  {editing ? 'Edit agenda' : 'Agenda baru'}
                </h2>
                <p className="mt-1 text-xs text-mut">Isi informasi kegiatan kelas.</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Tutup form agenda"
                className="grid h-9 w-9 place-items-center rounded-lg text-mut transition hover:bg-line hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div role="alert" className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}
            <form onSubmit={saveAgenda} className="space-y-4">
              <div>
                <label htmlFor="agenda-title" className="mb-1.5 block text-xs font-semibold text-mut">Judul</label>
                <input id="agenda-title" name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required className={inputClass} />
              </div>
              <div>
                <label htmlFor="agenda-description" className="mb-1.5 block text-xs font-semibold text-mut">Deskripsi</label>
                <textarea id="agenda-description" name="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} rows={3} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="agenda-date" className="mb-1.5 block text-xs font-semibold text-mut">Tanggal</label>
                  <input id="agenda-date" name="event_date" type="date" value={form.event_date} onChange={(event) => setForm({ ...form, event_date: event.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label htmlFor="agenda-time" className="mb-1.5 block text-xs font-semibold text-mut">Waktu</label>
                  <input id="agenda-time" name="event_time" type="time" value={form.event_time} onChange={(event) => setForm({ ...form, event_time: event.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="agenda-location" className="mb-1.5 block text-xs font-semibold text-mut">Lokasi</label>
                  <input id="agenda-location" name="location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={160} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="agenda-category" className="mb-1.5 block text-xs font-semibold text-mut">Kategori</label>
                  <select id="agenda-category" name="category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass}>
                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 border-t border-line pt-4">
                <button type="button" onClick={closeForm} className="min-h-11 flex-1 rounded-xl bg-line px-4 text-sm font-semibold text-ink transition hover:brightness-110">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-acc px-4 text-sm font-bold text-acc-ink transition hover:brightness-110 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Tambah agenda'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
