import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import ChatRoom from '@/components/chat/ChatRoom';

export default async function ChatPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: messages }, { data: profs }] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('id, user_id, content, media_url, media_type, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('user_id, full_name'),
  ]);

  const names: Record<string, string> = {};
  for (const p of profs ?? []) names[p.user_id] = p.full_name;
  const initial = (messages ?? []).reverse();

  return (
    <AppLayout profile={user.profile}>
      <ChatRoom userId={user.id} initial={initial} names={names} />
    </AppLayout>
  );
}
