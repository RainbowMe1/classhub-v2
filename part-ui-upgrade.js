const fs = require('fs');

// ===== GELOMBANG 1A: FONT PAIRING (Poppins heading + Inter body) =====
const cssPath = 'app/globals.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (css.indexOf('UI-UPGRADE: FONTS') === -1) {
  css += `
/* UI-UPGRADE: FONTS */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}

h1, h2, h3, .font-black {
  font-family: 'Poppins', 'Inter', sans-serif;
  letter-spacing: -0.02em;
}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('[OK] Font pairing Poppins+Inter diterapkan');
} else {
  console.log('[SKIP] fonts udah ada');
}

// ===== GELOMBANG 1C: GLASSMORPHISM ENHANCEMENT =====
css = fs.readFileSync(cssPath, 'utf8');
if (css.indexOf('UI-UPGRADE: GLASS') === -1) {
  css += `
/* UI-UPGRADE: GLASS */
.glass {
  background: color-mix(in srgb, var(--t-card, #161616) 72%, transparent) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('[OK] Glassmorphism enhanced (blur 20px + saturate + layered shadow)');
} else {
  console.log('[SKIP] glass udah ada');
}

// ===== PERSIAPAN GELOMBANG 2: PRINT DASHBOARD BUAT BENTO REWRITE =====
const dashPath = 'app/dashboard/page.tsx';
if (fs.existsSync(dashPath)) {
  const d = fs.readFileSync(dashPath, 'utf8');
  fs.writeFileSync('dashboard-print.txt', d, 'utf8');
  console.log('===== ISI app/dashboard/page.tsx (copy ini buat bento) =====');
  console.log(d);
  console.log('===== AKHIR =====');
} else {
  console.log('[!!] dashboard tidak ditemukan');
}