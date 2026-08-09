import type { Metadata } from 'next';
import './globals.css';
import SWRegister from '@/components/SWRegister';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'ClassHub',
  description: 'Aplikasi kelas kamu',
};

const themeScript = "(function(){try{var t=localStorage.getItem('ch-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <SWRegister />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
