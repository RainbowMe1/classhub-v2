import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { Users } from 'lucide-react';

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
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Anggota Kelas</h1>
        {(members?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-mut">
            <Users className="h-12 w-12 mx-auto mb-4" />
            <p>Belum ada anggota</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {members?.map((m) => (
              <div key={m.id} className="bg-line/40 border border-line rounded-2xl p-4 text-center">
                <div className="h-16 w-16 rounded-full bg-line-2 flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  {m.full_name.charAt(0)}
                </div>
                <div className="font-semibold text-sm truncate">{m.full_name}</div>
                <div className="text-xs text-mut">@{m.username}</div>
                <div className="text-xs text-acc mt-1 uppercase">{m.role}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
