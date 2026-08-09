'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function NotifBadge({ userId }: { userId: string }) {
  const supabase = createClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setCount(count ?? 0);
    })();
  }, [userId]);

  if (count === 0) return null;
  return (
    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#a3e635] text-[#0a0a0a] text-[10px] font-bold">
      {count}
    </span>
  );
}
