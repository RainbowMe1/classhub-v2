import { requireUser } from '@/lib/auth/actions';
import { getClassSettings } from '@/lib/auth/settings-actions';
import AppLayout from '@/components/layout/AppLayout';
import AttendancePage from '@/components/AttendancePage';

export default async function AbsenRoute() {
  const user = await requireUser();
  const s = await getClassSettings();
  return (
    <AppLayout profile={user.profile}>
      <AttendancePage schoolName={s && s.school_name ? s.school_name : 'Sekolah'} className={s && s.class_name ? s.class_name : 'Kelas'} />
    </AppLayout>
  );
}
