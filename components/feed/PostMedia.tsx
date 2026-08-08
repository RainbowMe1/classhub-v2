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
          className="w-full mb-3 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="w-full h-auto max-h-[520px]" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="w-full h-auto max-h-[520px] object-contain" />
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
