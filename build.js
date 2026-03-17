const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'public');
const FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'ventes_unified_20k.csv'
];

// Create output directory
if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true });
}

// Copy each static file
FILES.forEach(function (file) {
  const src = path.join(__dirname, file);
  const dest = path.join(OUT, file);
  fs.copyFileSync(src, dest);
  console.log('  ' + file + ' -> public/' + file);
});

console.log('Build complete: ' + FILES.length + ' files copied to public/');

