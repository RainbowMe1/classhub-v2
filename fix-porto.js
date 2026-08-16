const fs = require('fs');
const p = 'app/portfolio/page.tsx';
let c = fs.readFileSync(p, 'utf8');
const orig = c;

const hasRequire = c.indexOf('requireUser()') !== -1;
const hasOpen = /<AppLayout\b[^>]*>/.test(c);
const hasClose = c.indexOf('</AppLayout>') !== -1;

if (hasRequire && hasOpen && hasClose) {
  // 1) user jadi nullable: guest gak di-redirect, anggota tetap dapat user
  c = c.replace(
    'await requireUser()',
    'await (async () => { try { return await requireUser(); } catch (e) { return null; } })()'
  );
  // 2) amankan semua pemakaian user biar gak crash saat null
  c = c.split('user.profile.role').join("(user && user.profile ? user.profile.role : 'student')");
  c = c.split('user.profile').join('(user ? user.profile : null)');
  c = c.split('user.id').join("(user ? user.id : '')");
  // 3) ganti shell: anggota -> AppLayout, guest -> header publik
  c = c.replace(/<AppLayout\b[^>]*>/, '<AnyShell user={user}>');
  c = c.split('</AppLayout>').join('</AnyShell>');
  // 4) suntik komponen AnyShell
  const shell = `
function AnyShell({ user, children }: any) {
  if (user) return <AppLayout profile={user.profile}>{children}</AppLayout>;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-line">
        <div className="flex items-center justify-between px-4 h-14 max-w-5xl mx-auto">
          <span className="font-black text-grad">Portofolio Kelas</span>
          <div className="flex items-center gap-2">
            <a href="/guest" className="px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold">Mode Tamu</a>
            <a href="/login" className="px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-bold">Masuk</a>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
`;
  const idx = c.lastIndexOf('export default');
  c = c.slice(0, idx) + shell + c.slice(idx);
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] portfolio sekarang PUBLIK: guest bisa lihat, anggota tetap AppLayout');
} else {
  console.log('[!!] POLA TIDAK DIKENALI — paste SELURUH output di bawah ini ke chat:');
  console.log('===== ISI app/portfolio/page.tsx =====');
  console.log(orig);
  console.log('===== AKHIR =====');
}