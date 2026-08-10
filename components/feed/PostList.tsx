'use client';
import { useEffect, useRef, useState } from 'react';
import { getFeedPage } from '@/lib/auth/feed-actions';
import PostCard from './PostCard';
import { Loader2 } from 'lucide-react';

export default function PostList(props: any) {
  const [posts, setPosts] = useState<any[]>(props.initial);
  const [lc, setLc] = useState<Record<string, number>>(props.likeCounts);
  const [lm, setLm] = useState<Record<string, boolean>>(props.likedByMe);
  const [cc, setCc] = useState<Record<string, number>>(props.commentCounts);
  const [cursor, setCursor] = useState<string | null>(
    props.initial.length ? props.initial[props.initial.length - 1].created_at : null
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(props.initial.length < 5);
  const sentRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  async function loadMore() {
    if (busyRef.current || done) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const res = await getFeedPage(cursor);
      setPosts((prev) => {
        const have = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p: any) => !have.has(p.id))];
      });
      setLc((prev) => Object.assign({}, prev, res.likeCounts));
      setLm((prev) => Object.assign({}, prev, res.likedByMe));
      setCc((prev) => Object.assign({}, prev, res.commentCounts));
      setCursor(res.nextCursor);
      if (!res.nextCursor || res.posts.length === 0) setDone(true);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const el = sentRef.current;
    if (!el || done) return;
    const ob = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    ob.observe(el);
    return function () { ob.disconnect(); };
  }, [cursor, done]);

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-mut">
        <p className="text-lg mb-2">Belum ada postingan</p>
        <p className="text-sm">Jadilah yang pertama berbagi cerita!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          userId={props.userId}
          isStaff={props.isStaff}
          isAdmin={props.isAdmin}
          actorName={props.actorName}
          likeCount={lc[post.id] ?? 0}
          liked={!!lm[post.id]}
          commentCount={cc[post.id] ?? 0}
        />
      ))}
      <div ref={sentRef} className="h-1" />
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-mut text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat...
        </div>
      )}
      {done && (
        <div className="text-center py-4 text-mut text-sm">Tidak ada postingan lainnya.</div>
      )}
    </div>
  );
}
