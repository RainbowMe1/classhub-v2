'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ch-theme', next); } catch (e) {}
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="fixed top-16 right-3 md:top-3 md:right-3 z-30 p-2.5 rounded-full bg-card border border-line text-mut hover:text-ink shadow-lg"
      aria-label="Ganti mode gelap/terang"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
