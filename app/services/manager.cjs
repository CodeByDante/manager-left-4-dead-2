const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseKeyValues, searchPaths, safeChild, backupWrite, updateLaunchOptions, copyVpk } = require('./files.cjs');
const { discoverSteam, discoverGame, accounts, createWorkshop } = require('./steam.cjs');
const CORE = new Set(['update', 'left4dead2_dlc1', 'left4dead2_dlc2', 'left4dead2_dlc3', '|gameinfo_path|.', 'hl2']);
class Manager {
  constructor(userData, trash) {
    this.userData = userData;
    this.trash = trash;
    this.backups = path.join(userData, 'backups');
    this.settingsFile = path.join(userData, 'settings.json');
    try { this.settings = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')); } catch { this.settings = {}; }
    const roots = discoverSteam();
    this.settings.steamPath ||= roots[0] || '';
    this.settings.gamePath ||= discoverGame(roots);
    this.workshop = createWorkshop(userData);
  }
  persist() { fs.mkdirSync(this.userData, { recursive: true }); fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2)); }
  get root() {
    const root = this.settings.gamePath;
    if (!root || !fs.existsSync(path.join(root, 'left4dead2', 'gameinfo.txt'))) throw new Error('Selecciona la carpeta de Left 4 Dead 2.');
    return root;
  }
  get workshopDir() { return path.join(this.root, 'left4dead2', 'addons', 'workshop'); }
  configPath(kind) {
    const files = { gameinfo: ['left4dead2', 'gameinfo.txt'], autoexec: ['left4dead2', 'cfg', 'autoexec.cfg'], addonconfig: ['left4dead2', 'cfg', 'addonconfig.cfg'] };
    if (!files[kind]) throw new Error('Configuración no válida.');
    return path.join(this.root, ...files[kind]);
  }
  status() { return { ...this.settings, detected: !!this.settings.gamePath && fs.existsSync(path.join(this.settings.gamePath, 'left4dead2', 'gameinfo.txt')), accounts: this.settings.steamPath ? accounts(this.settings.steamPath).map(({ file, ...rest }) => rest) : [] }; }
  selectGame(root) {
    if (!fs.existsSync(path.join(root, 'left4dead2', 'gameinfo.txt'))) throw new Error('Selecciona la carpeta raíz que contiene left4dead2/gameinfo.txt.');
    this.settings.gamePath = fs.realpathSync(root); this.persist(); return this.status();
  }
  selectSteam(root) {
    if (!fs.existsSync(path.join(root, 'steam.exe')) || !fs.existsSync(path.join(root, 'userdata'))) throw new Error('Selecciona la carpeta de Steam que contiene steam.exe y userdata.');
    this.settings.steamPath = fs.realpathSync(root); delete this.settings.accountId; this.persist(); return this.status();
  }
  readConfig(kind) { const file = this.configPath(kind); return { file, content: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' }; }
  saveConfig({ kind, content }) {
    const file = this.configPath(kind);
    if (kind === 'gameinfo') { searchPaths(content); if (!content.trim()) throw new Error('gameinfo.txt no puede quedar vacío.'); }
    backupWrite(file, content, this.backups); return { success: true };
  }
  gameinfoMods() {
    const { content } = this.readConfig('gameinfo');
    const mods = [];
    for (const entry of searchPaths(content).entries) {
      if (!/^(Game|Mod)$/i.test(entry.key) || entry.value === undefined || CORE.has(entry.value.toLowerCase())) continue;
      let folder = null;
      try {
        for (const base of [this.root, path.join(this.root, 'left4dead2')]) {
          const candidate = safeChild(base, entry.value);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) { folder = candidate; break; }
        }
      } catch {}
      let metadata;
      try { metadata = JSON.parse(fs.readFileSync(path.join(folder, 'mod_info.json'), 'utf8')); } catch {}
      mods.push({ name: entry.value, title: metadata?.title || entry.value, id: String(metadata?.id || ''), kind: metadata?.kind || (metadata?.id ? 'workshop' : 'manual'), managed: metadata?.managedBy === 'l4d2-mod-manager', folder, exists: !!folder });
    }
    return mods;
  }
  async workshopMods() {
    const dir = this.workshopDir;
    if (!fs.existsSync(dir)) return { mods: [], offline: false };
    const files = fs.readdirSync(dir).filter(f => /^\d+(?:_dir)?\.vpk(?:\.disabled)?$/i.test(f));
    const ids = files.map(f => f.match(/^\d+/)[0]);
    const { cache, offline } = await this.workshop.details(ids);
    const converted = new Set(this.gameinfoMods().map(m => m.id).filter(Boolean));
    const mods = files.map(filename => {
      const id = filename.match(/^\d+/)[0];
      const file = path.join(dir, filename);
      return { id, filename, fullPath: file, ...cache[id], title: cache[id]?.title || `Mod ${id}`, description: cache[id]?.description || '', size: fs.statSync(file).size, enabled: !filename.endsWith('.disabled'), converted: converted.has(id), thumbnail: this.thumbnail(path.join(dir, `${id}.jpg`)) };
    });
    return { mods, offline };
  }
  thumbnail(file) {
    try { if (fs.statSync(file).size <= 5 * 1024 * 1024) return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`; } catch {}
    return '';
  }
  modLocation({ type, filename, name }) {
    if (type === 'workshop') {
      if (!/^\d+(?:_dir)?\.vpk(?:\.disabled)?$/i.test(filename)) throw new Error('Archivo de Workshop no válido.');
      const file = safeChild(this.workshopDir, filename);
      if (!fs.existsSync(file)) throw new Error('El archivo ya no existe.');
      return file;
    }
    if (type !== 'mounted') throw new Error('Tipo de mod no válido.');
    const item = this.gameinfoMods().find(m => m.name === name);
    if (!item?.folder) throw new Error('La carpeta de este mod no se encontró en la instalación.');
    return item.folder;
  }
  toggle({ filename }) {
    if (!/^\d+(?:_dir)?\.vpk(?:\.disabled)?$/i.test(filename)) throw new Error('Archivo Workshop no válido.');
    const source = safeChild(this.workshopDir, filename);
    const target = source.endsWith('.disabled') ? source.slice(0, -9) : source + '.disabled';
    if (fs.existsSync(target)) throw new Error('Ya existe un archivo con el estado de destino.');
    fs.renameSync(source, target); return { success: true };
  }
  convert({ id, filename }) {
    if (!/^\d+$/.test(id) || !new RegExp(`^${id}(?:_dir)?\\.vpk$`, 'i').test(filename)) throw new Error('Activa el VPK de origen antes de prepararlo.');
    const source = safeChild(this.workshopDir, filename);
    const gameinfo = this.readConfig('gameinfo');
    const block = searchPaths(gameinfo.content);
    const folderName = `Workshop_${id}`;
    const target = safeChild(this.root, folderName);
    if (fs.existsSync(target)) throw new Error('Este mod ya tiene una carpeta preparada. Retíralo antes de volver a prepararlo.');
    const stage = safeChild(this.root, `.l4d2-${crypto.randomUUID()}`);
    fs.mkdirSync(stage);
    let moved = false;
    try {
      copyVpk(source, stage);
      const cacheFile = path.join(this.userData, 'workshop-cache.json');
      let title = `Mod ${id}`;
      try { title = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))[id]?.title || title; } catch {}
      fs.writeFileSync(path.join(stage, 'mod_info.json'), JSON.stringify({ id, title, folderName, managedBy: 'l4d2-mod-manager', convertedAt: new Date().toISOString() }, null, 2));
      fs.renameSync(stage, target); moved = true;
      if (!block.entries.some(e => /^(Game|Mod)$/i.test(e.key) && e.value?.toLowerCase() === folderName.toLowerCase())) {
        const newline = gameinfo.content.includes('\r\n') ? '\r\n' : '\n';
        const updated = gameinfo.content.slice(0, block.open + 1) + `${newline}\t\t\tGame\t${folderName}` + gameinfo.content.slice(block.open + 1);
        backupWrite(gameinfo.file, updated, this.backups);
      }
      return { success: true, folderName };
    } catch (error) {
      // Only remove the new staging/output directory owned by this operation.
      fs.rmSync(moved ? target : stage, { recursive: true, force: true });
      throw error;
    }
  }
  async remove({ name }) {
    if (typeof name !== 'string' || CORE.has(name.toLowerCase())) throw new Error('No se pueden retirar archivos base del juego.');
    const item = this.gameinfoMods().find(m => m.name === name);
    if (!item) throw new Error('El mod ya no figura en gameinfo.txt.');
    const { file, content } = this.readConfig('gameinfo');
    const entries = searchPaths(content).entries.filter(e => /^(Game|Mod)$/i.test(e.key) && e.value === name).sort((a, b) => b.start - a.start);
    let updated = content;
    for (const entry of entries) updated = updated.slice(0, entry.start) + updated.slice(entry.end);
    backupWrite(file, updated, this.backups);
    if (item.managed && item.folder) {
      try { await this.trash(item.folder); }
      catch (error) {
        backupWrite(file, content, this.backups);
        throw new Error(`Windows no permitió enviar la carpeta a la Papelera. Se restauró su registro. ${error.message}`);
      }
    }
    return { success: true, trashed: item.managed && !!item.folder };
  }
  listBackups() {
    if (!fs.existsSync(this.backups)) return [];
    return fs.readdirSync(this.backups).filter(f => f.endsWith('.json')).flatMap(f => {
      try { return [JSON.parse(fs.readFileSync(path.join(this.backups, f), 'utf8'))]; } catch { return []; }
    }).filter(b => this.allowedBackup(b.file)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  allowedBackup(file) {
    try { return ['gameinfo', 'autoexec', 'addonconfig'].some(k => file === this.configPath(k)) || accounts(this.settings.steamPath || '').some(a => a.file === file); } catch { return false; }
  }
  restore({ id }) {
    const item = this.listBackups().find(b => b.id === id);
    if (!item) throw new Error('No se encontró la copia para esta instalación.');
    const content = fs.readFileSync(path.join(this.backups, `${item.id}.bak`), 'utf8');
    backupWrite(item.file, content, this.backups); return { success: true };
  }
  launch({ accountId } = {}) {
    const list = accounts(this.settings.steamPath || '');
    const selected = list.find(a => a.id === (accountId || this.settings.accountId)) || list[0];
    return selected ? { ...selected, accounts: list.map(a => ({ id: a.id, lastPlayed: a.lastPlayed })) } : { launchOptions: '', accounts: [] };
  }
  saveLaunch({ accountId, content }) {
    const account = accounts(this.settings.steamPath || '').find(a => a.id === accountId);
    if (!account) throw new Error('Selecciona la carpeta y cuenta de Steam.');
    const text = fs.readFileSync(account.file, 'utf8');
    backupWrite(account.file, updateLaunchOptions(text, content), this.backups);
    this.settings.accountId = account.id; this.persist(); return { success: true };
  }
}
module.exports = { Manager };
