import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import AdminProfilesPage from '@/components/AdminProfilesPage';

export default async function AdminProfilesRoute() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <AdminProfilesPage />
    </AppLayout>
  );
}
