import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import AgendaPage, { type Agenda } from '@/components/AgendaPage';
import { getAgendas } from '@/lib/auth/agenda-actions';

export default async function AgendaRoute() {
  const user = await requireUser();
  const agendaResult = await getAgendas();
  return (
    <AppLayout profile={user.profile}>
      <AgendaPage
        role={user.profile.role}
        initialAgendas={(agendaResult.data ?? []) as Agenda[]}
        initialError={agendaResult.error ?? ''}
      />
    </AppLayout>
  );
}
