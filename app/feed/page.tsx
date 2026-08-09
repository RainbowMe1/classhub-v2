import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import LikeButton from '@/components/feed/LikeButton';
import CommentButton from '@/components/feed/CommentButton';
import PostMedia from '@/components/feed/PostMedia';
import StoryBar from '@/components/feed/StoryBar';
import PostModMenu from '@/components/feed/PostModMenu';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';
  const isAdmin = user.profile.role === 'admin';
  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(*)')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p: any) => p.id);
  let likes: any[] = [];
  let commentRows: any[] = [];
  if (postIds.length > 0) {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('target_id, user_id').eq('target_type', 'post').in('target_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
    ]);
    likes = l.data ?? [];
    commentRows = c.data ?? [];
  }

  const likeCounts: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const l of likes) {
    likeCounts[l.target_id] = (likeCounts[l.target_id] ?? 0) + 1;
    if (l.user_id === user.id) likedByMe[l.target_id] = true;
  }
  const commentCounts: Record<string, number> = {};
  for (const c of commentRows) {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  }

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <StoryBar userId={user.id} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feed</h1>
          <Link
            href="/feed/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-medium hover:bg-acc-strong transition"
          >
            <PlusCircle className="h-4 w-4" />
            Posting
          </Link>
        </div>

        {(posts?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-mut">
            <p className="text-lg mb-2">Belum ada postingan</p>
            <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(posts ?? []).map((post: any) => (
              <div key={post.id} className="bg-card border border-line rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-line-2 flex items-center justify-center text-sm font-semibold">
                    {post.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{post.profiles?.full_name}</div>
                    <div className="text-xs text-mut">@{post.profiles?.username}</div>
                  </div>
                  {isStaff && <PostModMenu postId={post.id} canDelete={isAdmin} />}
                </div>
                {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
                {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
                <div className="flex items-center gap-4 pt-3 border-t border-line">
                  <LikeButton
                    postId={post.id}
                    userId={user.id}
                    initialCount={likeCounts[post.id] ?? 0}
                    initialLiked={!!likedByMe[post.id]}
                    ownerId={post.user_id}
                    actorName={user.profile.full_name}
                  />
                  <CommentButton
                    postId={post.id}
                    userId={user.id}
                    count={commentCounts[post.id] ?? 0}
                    postOwnerId={post.user_id}
                    actorName={user.profile.full_name}
                    isStaff={isStaff}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
