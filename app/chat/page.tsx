import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import { MessageCircle } from 'lucide-react';

export default async function ChatPage() {
  const user = await requireUser();
  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Chat Kelas</h1>
        <div className="bg-[#2a2a2a]/40 border border-[#2a2a2a] rounded-2xl p-8 text-center">
          <MessageCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Chat realtime akan segera hadir</p>
          <p className="text-sm text-gray-500 mt-2">Fitur ini menggunakan Supabase Realtime</p>
        </div>
      </div>
    </AppLayout>
  );
}
