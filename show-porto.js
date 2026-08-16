const fs = require('fs');
const p = 'app/portfolio/page.tsx';
if (fs.existsSync(p)) {
  console.log('===== ISI app/portfolio/page.tsx =====');
  console.log(fs.readFileSync(p, 'utf8'));
  console.log('===== AKHIR =====');
} else {
  console.log('FILE TIDAK ADA: ' + p);
}