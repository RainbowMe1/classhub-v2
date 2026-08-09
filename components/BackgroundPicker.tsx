'use client';
import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

const BGS = [
  { id: 'default', label: 'Default', c1: '#a3e635', c2: '#2dd4bf' },
  { id: 'ocean', label: 'Ocean', c1: '#38bdf8', c2: '#2dd4bf' },
  { id: 'sunset', label: 'Sunset', c1: '#fb923c', c2: '#f472b6' },
  { id: 'forest', label: 'Forest', c1: '#4ade80', c2: '#a3e635' },
  { id: 'violet', label: 'Violet', c1: '#a78bfa', c2: '#f472b6' },
];

export default function BackgroundPicker() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('default');

  useEffect(() => {
    setCur(document.documentElement.getAttribute('data-bg') || 'default');
  }, []);

  function pick(id: string) {
    if (id === 'default') document.documentElement.removeAttribute('data-bg');
    else document.documentElement.setAttribute('data-bg', id);
    try { localStorage.setItem('ch-bg', id); } catch (e) {}
    setCur(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      {open && (
        <div className="absolute left-0 bottom-11 bg-card border border-line rounded-2xl p-2 space-y-1 shadow-xl w-40 z-50">
          {BGS.map((b) => (
            <button
              key={b.id}
              onClick={() => pick(b.id)}
              className={'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ' + (cur === b.id ? 'bg-line text-ink' : 'text-mut hover:text-ink')}
            >
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, ' + b.c1 + ', ' + b.c2 + ')' }} />
              {b.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-line text-mut hover:text-ink"
        aria-label="Ganti aksen background"
      >
        <Palette className="h-4 w-4" />
      </button>
    </div>
  );
}
