'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';

export async function saveSubscription(endpoint: string, p256dh: string, auth: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, p256dh, auth },
    { onConflict: 'endpoint' }
  );
  if (error) return { error: error.message };
  return { success: true };
}

export async function removeSubscription(endpoint: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);
  if (error) return { error: error.message };
  return { success: true };
}
