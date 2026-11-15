const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseKeyValues, findBlock } = require('./files.cjs');

function discoverSteam() {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean).map(p => path.join(p, 'Steam'));
  roots.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  if (process.platform === 'win32') {
    for (const [key, name] of [['HKCU\\Software\\Valve\\Steam', 'SteamPath'], ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath']]) {
      try {
        const output = execFileSync('reg.exe', ['query', key, '/v', name], { encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
        const value = output.match(/REG_SZ\s+(.+)/)?.[1]?.trim();
        if (value) roots.unshift(path.normalize(value));
      } catch {}
    }
  }
  return [...new Set(roots)].filter(p => fs.existsSync(path.join(p, 'steam.exe')));
}
function discoverGame(steamRoots) {
  for (const root of steamRoots) {
    const libraries = [root];
    const file = path.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      const block = findBlock(parseKeyValues(fs.readFileSync(file, 'utf8')), 'libraryfolders');
      for (const entry of block?.entries || []) {
        const dir = entry.entries?.find(e => e.key.toLowerCase() === 'path')?.value || entry.value;
        if (dir) libraries.push(dir);
      }
    } catch {}
    for (const library of libraries) {
      const game = path.join(library, 'steamapps', 'common', 'Left 4 Dead 2');
      if (fs.existsSync(path.join(game, 'left4dead2', 'gameinfo.txt'))) return game;
    }
  }
  return '';
}
function accounts(steamRoot) {
  const root = path.join(steamRoot, 'userdata');
  if (!fs.existsSync(root)) return [];
  const found = [];
  for (const id of fs.readdirSync(root).filter(s => /^\d+$/.test(s))) {
    const file = path.join(root, id, 'config', 'localconfig.vdf');
    try {
      const apps = findBlock(parseKeyValues(fs.readFileSync(file, 'utf8')), 'apps');
      const game = apps?.entries.find(e => e.key === '550' && e.entries);
      if (!game) continue;
      const get = key => game.entries.find(e => e.key.toLowerCase() === key)?.value;
      found.push({ id, file, launchOptions: get('launchoptions') || '', lastPlayed: Number(get('lastplayed')) || 0 });
    } catch {}
  }
  return found.sort((a, b) => b.lastPlayed - a.lastPlayed);
}
function createWorkshop(userData) {
  const file = path.join(userData, 'workshop-cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  async function details(ids) {
    const missing = ids.filter(id => !cache[id]?.fetchedAt || Date.now() - cache[id].fetchedAt > 24 * 60 * 60 * 1000);
    let offline = false;
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      const body = new URLSearchParams({ itemcount: String(batch.length) });
      batch.forEach((id, n) => body.append(`publishedfileids[${n}]`, id));
      try {
        const response = await request('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', body });
        if (!response.ok) throw new Error('Workshop no disponible.');
        const data = await response.json();
        for (const item of data.response?.publishedfiledetails || []) {
          if (item.result !== 1) continue;
          cache[item.publishedfileid] = { ...cache[item.publishedfileid], title: item.title, description: item.description, tags: item.tags?.map(t => t.tag) || [], fetchedAt: Date.now() };
        }
      } catch { offline = true; break; }
    }
    fs.mkdirSync(userData, { recursive: true });
    try { fs.writeFileSync(file, JSON.stringify(cache)); } catch {}
    return { cache, offline };
  }
  async function requirements(id) {
    if (!/^\d+$/.test(id)) throw new Error('ID de Workshop no válido.');
    if (cache[id]?.requirementsAt && Date.now() - cache[id].requirementsAt < 3600000) return { items: cache[id].requirements || [], verified: true };
    try {
      const response = await request(`https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`, { headers: { 'Accept-Language': 'es,en;q=0.8' } });
      if (!response.ok) throw new Error();
      const html = await response.text();
      // Do not label network/login/error pages as "no requirements".
      if (!html.includes('workshopItemTitle')) throw new Error();
      const section = html.match(/id="RequiredItems"[\s\S]*?(?=<div class="(?:rightDetailsBlock|workshopItemDetails)|$)/i)?.[0] || '';
      const items = [...new Set([...section.matchAll(/filedetails\/\?id=(\d+)/g)].map(m => m[1]).filter(v => v !== id))];
      cache[id] = { ...cache[id], requirements: items, requirementsAt: Date.now() };
      fs.writeFileSync(file, JSON.stringify(cache));
      return { items, verified: true };
    } catch { return { items: cache[id]?.requirements || [], verified: false }; }
  }
  async function translate(text) {
    if (typeof text !== 'string' || text.length > 50000) throw new Error('Descripción demasiado larga.');
    const chunks = text.match(/[\s\S]{1,1800}/g) || [];
    const result = [];
    for (const chunk of chunks) {
      const response = await request('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=' + encodeURIComponent(chunk));
      if (!response.ok) throw new Error('No se pudo traducir.');
      const data = await response.json();
      result.push(data[0].map(v => v[0] || '').join(''));
    }
    return result.join('');
  }
  return { details, requirements, translate };
}
module.exports = { discoverSteam, discoverGame, accounts, createWorkshop };
