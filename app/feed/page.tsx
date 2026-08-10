import { requireUser } from '@/lib/auth/actions';
import { getFeedPage } from '@/lib/auth/feed-actions';
import AppLayout from '@/components/layout/AppLayout';
import StoryBar from '@/components/feed/StoryBar';
import PostList from '@/components/feed/PostList';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function FeedPage() {
  const user = await requireUser();
  const isStaff = user.profile.role !== 'student';
  const isAdmin = user.profile.role === 'admin';
  const first = await getFeedPage(null);

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

        <PostList
          initial={first.posts}
          likeCounts={first.likeCounts}
          likedByMe={first.likedByMe}
          commentCounts={first.commentCounts}
          userId={user.id}
          isStaff={isStaff}
          isAdmin={isAdmin}
          actorName={user.profile.full_name}
        />
      </div>
    </AppLayout>
  );
}
