const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
for (const file of [...walk('app'), ...walk('scripts')].filter(f => /\.(cjs|js)$/.test(f))) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
const files = walk('app');
for (const file of files) if (/localhost|127\.0\.0\.1|fetch\(['"]\/api\/|createServer|\.listen\(/.test(fs.readFileSync(file, 'utf8'))) throw new Error(`Servidor local inesperado: ${file}`);
const pkg = require('../package.json');
if (!fs.existsSync(pkg.main) || !fs.existsSync('app/renderer/index.html')) throw new Error('Faltan archivos de arranque.');
console.log('Sintaxis y aplicación de escritorio: correctas.');
