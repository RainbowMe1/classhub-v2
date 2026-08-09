'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Heart } from 'lucide-react';

export default function LikeButton({ postId, userId, initialCount, initialLiked, ownerId, actorName }: { postId: string; userId: string; initialCount: number; initialLiked: boolean; ownerId: string; actorName: string }) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase.from('likes').delete().eq('user_id', userId).eq('target_type', 'post').eq('target_id', postId);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      await supabase.from('likes').insert({ user_id: userId, target_type: 'post', target_id: postId });
      if (ownerId !== userId) {
        await supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'like',
          title: actorName + ' menyukai postinganmu',
          actor_id: userId,
          target_type: 'post',
          target_id: postId,
        });
      }
    }
  }

  return (
    <button onClick={toggle} className={'flex items-center gap-2 text-sm transition ' + (liked ? 'text-red-400' : 'text-mut hover:text-red-400')}>
      <Heart className={'h-5 w-5 ' + (liked ? 'fill-red-400 heart-pop' : '')} />
      <span>{count}</span>
    </button>
  );
}
