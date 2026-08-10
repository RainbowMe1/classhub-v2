'use server';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';

const PROFILE_FIELDS = 'full_name,username,role,avatar_url,avatar_zoom,avatar_x,avatar_y,jabatan';

export async function getFeedPage(cursor: string | null) {
  const user = await requireUser();
  const supabase = await createClient();
  let query = supabase
    .from('posts')
    .select('*, profiles(' + PROFILE_FIELDS + ')')
    .eq('is_hidden', false)
    .eq('profiles.is_banned', false)
    .order('created_at', { ascending: false })
    .limit(5);
  if (cursor) query = query.lt('created_at', cursor);
  const { data: posts, error } = await query;
  if (error) {
    return { posts: [], likeCounts: {}, likedByMe: {}, commentCounts: {}, nextCursor: null };
  }
  const list: any[] = (posts as any[]) ?? [];
  const ids = list.map((p) => p.id);

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  const commentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', ids),
      supabase.from('comments').select('post_id').in('post_id', ids),
    ]);
    for (const x of l.data ?? []) {
      likeCounts[x.target_id] = (likeCounts[x.target_id] ?? 0) + 1;
      if (x.user_id === user.id) likedByMe[x.target_id] = true;
    }
    for (const x of c.data ?? []) {
      commentCounts[x.post_id] = (commentCounts[x.post_id] ?? 0) + 1;
    }
  }
  const lastPost: any = list.length > 0 ? list[list.length - 1] : null;
  return {
    posts: list,
    likeCounts,
    likedByMe,
    commentCounts,
    nextCursor: list.length === 5 && lastPost ? (lastPost.created_at as string) : null,
  };
}
