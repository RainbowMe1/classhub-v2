'use client';
import { memo } from 'react';
import Avatar from '@/components/Avatar';
import AdminTag from '@/components/AdminTag';
import PostMedia from './PostMedia';
import LikeButton from './LikeButton';
import CommentButton from './CommentButton';

function PostCard({ post, userId, actorName, likeCount, liked, commentCount }: any) {
  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar data={post.profiles} className="h-10 w-10" />
        <div className="flex-1">
          <div className="font-semibold flex items-center gap-2">
            {post.profiles?.full_name}
            <AdminTag role={post.profiles?.role} />
          </div>
          <div className="text-xs text-mut">@{post.profiles?.username}</div>
        </div>
      </div>
      {post.content && <p className="mb-3 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>}
      {post.media_urls && post.media_urls.length > 0 && <PostMedia urls={post.media_urls} />}
      <div className="flex items-center gap-4 pt-3 border-t border-line">
        <LikeButton
          postId={post.id}
          userId={userId}
          initialCount={likeCount}
          initialLiked={liked}
          ownerId={post.user_id}
          actorName={actorName}
        />
        <CommentButton
          postId={post.id}
          userId={userId}
          count={commentCount}
          postOwnerId={post.user_id}
          actorName={actorName}
          isStaff={false}
        />
      </div>
    </div>
  );
}

export default memo(PostCard);
