import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';

export default async function MembersPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_banned', false)
    .order('full_name');

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Anggota Kelas</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(members ?? []).map((m: any) => (
            <div key={m.user_id} className="anim-fade-up bg-card border border-line rounded-2xl p-4 text-center">
              <Avatar data={m} className="h-16 w-16 mx-auto text-xl" />
              <div className="font-semibold text-sm mt-2 truncate flex items-center justify-center gap-2">
                {m.full_name}
                <AdminTag role={m.role} />
              </div>
              <div className="text-xs text-mut">@{m.username}</div>
              {m.role !== 'admin' && <div className="text-[10px] uppercase text-acc mt-1">{m.role}</div>}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
