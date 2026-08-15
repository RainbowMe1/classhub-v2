import { requireUser } from '@/lib/auth/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import AppLayout from '@/components/layout/AppLayout';
import AIChat from '@/components/ai/AIChat';

export default async function AIPage() {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('api_key, model').limit(1).maybeSingle();
  return (
    <AppLayout profile={user.profile}>
      <AIChat
        isAdmin={user.profile.role === 'admin'}
        configured={!!data?.api_key}
        model={data?.model || 'gemini-3.6-flash'}
      />
    </AppLayout>
  );
}
