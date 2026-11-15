const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Valve KeyValues: retain offsets so updates preserve unrelated apps and comments.
function parseKeyValues(text) {
  const tokens = [];
  const regex = /\/\/[^\r\n]*|"((?:\\.|[^"\\])*)"|([{}])|([^\s{}"]+)/g;
  let match;
  while ((match = regex.exec(text))) {
    if (match[0].startsWith('//')) continue;
    tokens.push({ value: match[1] !== undefined ? match[1].replace(/\\(["\\])/g, '$1') : match[2] || match[3], start: match.index, end: regex.lastIndex, quoted: match[1] !== undefined });
  }
  let i = 0;
  function read(nested) {
    const entries = [];
    while (i < tokens.length) {
      const key = tokens[i++];
      if (key.value === '}' && !key.quoted) {
        if (!nested) throw new Error('Llave de cierre inesperada.');
        return { entries, close: key.start };
      }
      const value = tokens[i++];
      if (!value || (value.value === '}' && !value.quoted)) throw new Error('Configuración KeyValues incompleta.');
      if (value.value === '{' && !value.quoted) {
        const block = read(true);
        entries.push({ key: key.value, start: key.start, end: tokens[i - 1].end, open: value.start, ...block });
      } else {
        entries.push({ key: key.value, value: value.value, start: key.start, end: value.end, valueStart: value.start, valueEnd: value.end });
      }
    }
    if (nested) throw new Error('Falta una llave de cierre.');
    return { entries };
  }
  return read(false).entries;
}
function findBlock(entries, name) {
  for (const entry of entries) {
    if (entry.key.toLowerCase() === name.toLowerCase() && entry.entries) return entry;
    if (entry.entries) { const found = findBlock(entry.entries, name); if (found) return found; }
  }
}
function searchPaths(text) {
  const block = findBlock(parseKeyValues(text), 'SearchPaths');
  if (!block) throw new Error('No se encontró SearchPaths en gameinfo.txt.');
  return block;
}
function safeChild(root, name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:\x00]/.test(name)) throw new Error('Nombre de carpeta no permitido.');
  const target = path.resolve(root, name);
  if (path.dirname(target) !== path.resolve(root)) throw new Error('La ruta sale de la carpeta del juego.');
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('No se modifican enlaces de carpetas.');
  return target;
}
function backupWrite(file, content, backupRoot) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('Contenido de configuración no válido.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    fs.mkdirSync(backupRoot, { recursive: true });
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    fs.copyFileSync(file, path.join(backupRoot, `${id}.bak`));
    fs.writeFileSync(path.join(backupRoot, `${id}.json`), JSON.stringify({ id, file, createdAt: new Date().toISOString() }));
  }
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, content, 'utf8'); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function quote(value) { return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }
function updateLaunchOptions(text, options) {
  if (typeof options !== 'string' || /[\r\n\x00]/.test(options)) throw new Error('Los parámetros deben ocupar una sola línea.');
  const apps = findBlock(parseKeyValues(text), 'apps');
  const game = apps?.entries.find(e => e.key === '550' && e.entries);
  if (!game) throw new Error('Esta cuenta no contiene la configuración de L4D2 (550).');
  const entry = game.entries.find(e => e.key.toLowerCase() === 'launchoptions');
  return entry ? text.slice(0, entry.valueStart) + quote(options) + text.slice(entry.valueEnd) : text.slice(0, game.close) + `\t"LaunchOptions"\t${quote(options)}\n` + text.slice(game.close);
}
function copyVpk(source, targetDir) {
  const fd = fs.openSync(source, 'r');
  const header = Buffer.alloc(12);
  const archives = new Set();
  try {
    if (fs.readSync(fd, header, 0, 12, 0) !== 12 || header.readUInt32LE(0) !== 0x55aa1234 || ![1, 2].includes(header.readUInt32LE(4))) throw new Error('El archivo no es un VPK válido.');
    const headerSize = header.readUInt32LE(4) === 2 ? 28 : 12;
    const treeSize = header.readUInt32LE(8);
    if (treeSize > 64 * 1024 * 1024 || fs.fstatSync(fd).size < headerSize + treeSize) throw new Error('La estructura del VPK está incompleta.');
    const tree = Buffer.alloc(treeSize);
    if (treeSize && fs.readSync(fd, tree, 0, treeSize, headerSize) !== treeSize) throw new Error('No se pudo leer el índice VPK.');
    let offset = 0;
    const word = () => {
      const end = tree.indexOf(0, offset);
      if (end < 0) throw new Error('Índice VPK incompleto.');
      const value = tree.toString('utf8', offset, end); offset = end + 1; return value;
    };
    if (treeSize) while (word()) while (word()) while (word()) {
      if (offset + 18 > treeSize || tree.readUInt16LE(offset + 16) !== 0xffff) throw new Error('Entrada VPK incompleta.');
      const preload = tree.readUInt16LE(offset + 4);
      const archive = tree.readUInt16LE(offset + 6);
      const size = tree.readUInt32LE(offset + 12);
      if (archive !== 0x7fff && size > 0) archives.add(archive);
      offset += 18 + preload;
      if (offset > treeSize) throw new Error('Datos precargados del VPK incompletos.');
    }
  } finally { fs.closeSync(fd); }
  const stem = path.basename(source).replace(/(?:_dir)?\.vpk$/i, '');
  const segments = [...archives].map(index => {
    const suffix = String(index).padStart(3, '0') + '.vpk';
    const file = path.join(path.dirname(source), `${stem}_${suffix}`);
    if (!fs.existsSync(file)) throw new Error(`Falta el segmento ${path.basename(file)} del VPK.`);
    return { file, suffix };
  });
  fs.copyFileSync(source, path.join(targetDir, 'pak01_dir.vpk'));
  for (const segment of segments) fs.copyFileSync(segment.file, path.join(targetDir, `pak01_${segment.suffix}`));
}

module.exports = { parseKeyValues, findBlock, searchPaths, safeChild, backupWrite, updateLaunchOptions, copyVpk };
