'use client';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import CommentsSheet from './CommentsSheet';

export default function CommentButton({ postId, userId, count, postOwnerId, actorName, isStaff }: { postId: string; userId: string; count: number; postOwnerId: string; actorName: string; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
        <MessageCircle className="h-5 w-5" />
        <span>{count}</span>
      </button>
      {open && (
        <CommentsSheet
          postId={postId}
          userId={userId}
          onClose={() => setOpen(false)}
          postOwnerId={postOwnerId}
          actorName={actorName}
          isStaff={isStaff}
        />
      )}
    </>
  );
}
