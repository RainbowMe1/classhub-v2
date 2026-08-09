'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import NotifBadge from '@/components/NotifBadge';

type NavItem = { href: string; label: string; icon: any };

export default function MobileNav({ items, userId }: { items: NavItem[]; userId: string }) {
  const [open, setOpen] = useState(false);
  const notif = items.find((i) => i.href === '/notifications');
  const bar = [items[0], items[1], items[2], notif].filter(Boolean) as NavItem[];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur border-t border-line">
        <div className="flex items-center justify-around h-16">
          {bar.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-mut">
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] flex items-center gap-1">
                {item.label}
                {item.href === '/notifications' && <NotifBadge userId={userId} />}
              </span>
            </Link>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 text-mut" aria-label="Menu">
            <Menu className="h-6 w-6" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-card-2 border-l border-line p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-ink">
                Class<span className="text-acc">Hub</span>
              </span>
              <button onClick={() => setOpen(false)} className="p-2 text-mut" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-soft hover:bg-line"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {item.href === '/notifications' && <NotifBadge userId={userId} />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
