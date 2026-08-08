'use client';
import { useState } from 'react';
import Lightbox from './Lightbox';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]"
            aria-label="Lihat detail"
          >
            {isVideo(url) ? (
              <video src={url} muted preload="metadata" playsInline className="w-full h-40 object-cover" />
            ) : (
              <img src={url} alt="" loading="lazy" className="w-full h-40 object-cover" />
            )}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
