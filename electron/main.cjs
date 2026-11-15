const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Default Left 4 Dead 2 Path
let l4d2BasePath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Left 4 Dead 2';

function getWorkshopPath() {
  return path.join(l4d2BasePath, 'left4dead2', 'addons', 'workshop');
}

function getGameinfoPath() {
  return path.join(l4d2BasePath, 'left4dead2', 'gameinfo.txt');
}

// Scrape Steam Workshop HTML for Required Items
async function parseRequiredItemsFromSteamHtml(publishedFileId) {
  try {
    const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedFileId}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const reqIdx = html.indexOf('RequiredItems');
    if (reqIdx === -1) return [];

    const snippet = html.substring(reqIdx, reqIdx + 6000);
    const endIdx = snippet.indexOf('<!--') !== -1 ? snippet.indexOf('<!--') : snippet.indexOf('</div>\n</div>');
    const section = endIdx !== -1 ? snippet.substring(0, endIdx) : snippet;

    const regex = /href=["']https?:\/\/steamcommunity\.com\/(?:workshop|sharedfiles)\/filedetails\/\?id=(\d+)["'][^>]*>[\s\S]*?<div class=["']requiredItem["']>\s*([\s\S]*?)\s*<\/div>/gi;
    const items = [];
    const seen = new Set();
    let m;
    while ((m = regex.exec(section)) !== null) {
      const reqId = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      if (reqId && reqId !== String(publishedFileId) && title && !seen.has(reqId)) {
        seen.add(reqId);
        items.push({ id: String(reqId), title });
      }
    }

    if (items.length === 0) {
      const regex2 = /href=["']https?:\/\/steamcommunity\.com\/(?:workshop|sharedfiles)\/filedetails\/\?id=(\d+)["'][^>]*>([^<]+)<\/a>/gi;
      while ((m = regex2.exec(section)) !== null) {
        const reqId = m[1];
        const title = m[2].trim();
        if (reqId && reqId !== String(publishedFileId) && title && title.length > 1 && !seen.has(reqId)) {
          seen.add(reqId);
          items.push({ id: String(reqId), title });
        }
      }
    }

    return items;
  } catch (err) {
    console.error(`Error scraping required items for mod ${publishedFileId}:`, err);
    return [];
  }
}

// Fetch Steam Workshop Title & Description
async function fetchSteamWorkshopDetails(publishedFileIds) {
  if (!publishedFileIds || publishedFileIds.length === 0) return {};

  const cachePath = path.join(app.getPath('userData'), 'workshop_cache.json');
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch(e) {}
  }

  const missingIds = publishedFileIds.filter(id => !cache[id] || !cache[id].title);

  if (missingIds.length > 0) {
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('itemcount', missingIds.length);
      missingIds.forEach((id, idx) => {
        bodyParams.append(`publishedfileids[${idx}]`, id);
      });

      const response = await fetch('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams
      });

      const data = await response.json();
      const details = data?.response?.publishedfiledetails || [];

      details.forEach(item => {
        if (item.publishedfileid) {
          cache[item.publishedfileid] = {
            title: item.title || `Workshop Mod ${item.publishedfileid}`,
            description: item.description || 'Sin descripción en Steam Workshop.',
            subscriptions: item.subscriptions || 0,
            views: item.views || 0,
            tags: item.tags ? item.tags.map(t => t.tag) : [],
            requiredItems: cache[item.publishedfileid]?.requiredItems || []
          };
        }
      });

      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    } catch(err) {
      console.error('Error fetching Steam Workshop details:', err);
    }
  }

  // Scrape HTML for required items if not yet scraped
  for (const id of publishedFileIds) {
    if (!cache[id] || !cache[id].requiredScraped || !cache[id].requiredItems) {
      const scrapedReqs = await parseRequiredItemsFromSteamHtml(id);
      if (!cache[id]) {
        cache[id] = {
          title: `Workshop Mod ${id}`,
          description: '',
          requiredItems: scrapedReqs,
          requiredScraped: true
        };
      } else {
        cache[id].requiredItems = scrapedReqs;
        cache[id].requiredScraped = true;
      }
    }
  }

  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  } catch(e) {}

  return cache;
}

// Handlers
ipcMain.handle('get-status', async () => {
  return {
    l4d2BasePath,
    exists: fs.existsSync(l4d2BasePath),
    workshopExists: fs.existsSync(getWorkshopPath()),
    gameinfoExists: fs.existsSync(getGameinfoPath()),
    workshopPath: getWorkshopPath(),
    gameinfoPath: getGameinfoPath()
  };
});

ipcMain.handle('get-workshop-mods', async () => {
  try {
    const workshopDir = getWorkshopPath();
    if (!fs.existsSync(workshopDir)) {
      return { mods: [], error: 'Directorio workshop no encontrado.' };
    }

    const files = fs.readdirSync(workshopDir);
    const vpkFiles = files.filter(f => f.endsWith('.vpk') || f.endsWith('.vpk.disabled'));

    const ids = vpkFiles.map(file => file.replace(/\.vpk(\.disabled)?$/, ''));
    const steamDetails = await fetchSteamWorkshopDetails(ids);

    // Collect all installed IDs (Workshop VPKs + Gameinfo Converted Mods)
    const convertedIds = new Set();
    try {
      if (fs.existsSync(l4d2BasePath)) {
        const subdirs = fs.readdirSync(l4d2BasePath, { withFileTypes: true });
        subdirs.forEach(dirent => {
          if (dirent.isDirectory()) {
            const metaFile = path.join(l4d2BasePath, dirent.name, 'mod_info.json');
            if (fs.existsSync(metaFile)) {
              try {
                const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
                if (meta.id) convertedIds.add(String(meta.id));
              } catch(e){}
            }
            const match = dirent.name.match(/_(\d+)$/);
            if (match) convertedIds.add(match[1]);
          }
        });
      }
    } catch(e){}

    const installedIdsSet = new Set([...ids.map(String), ...Array.from(convertedIds)]);

    const mods = vpkFiles.map(file => {
      const isDisabled = file.endsWith('.disabled');
      const id = file.replace(/\.vpk(\.disabled)?$/, '');
      const fullVpkPath = path.join(workshopDir, file);
      const jpgPath = path.join(workshopDir, `${id}.jpg`);
      const hasJpg = files.includes(`${id}.jpg`);
      
      let stats = null;
      try {
        stats = fs.statSync(fullVpkPath);
      } catch (e) {}

      const info = steamDetails[id] || {};
      const rawReqs = info.requiredItems || [];

      const requiredItems = rawReqs.map(req => {
        return {
          id: String(req.id),
          title: req.title || `Requisito ${req.id}`,
          isInstalled: installedIdsSet.has(String(req.id))
        };
      });

      return {
        id,
        filename: file,
        fullPath: fullVpkPath,
        isEnabled: !isDisabled,
        title: info.title || `Mod ${id}`,
        description: info.description || 'Sin descripción disponible.',
        tags: info.tags || [],
        subscriptions: info.subscriptions || 0,
        hasThumbnail: hasJpg,
        thumbnailUrl: hasJpg ? `file:///${jpgPath.replace(/\\/g, '/')}` : null,
        sizeBytes: stats ? stats.size : 0,
        sizeFormatted: stats ? (stats.size / (1024 * 1024)).toFixed(2) + ' MB' : 'Desconocido',
        modifiedAt: stats ? stats.mtime : null,
        requiredItems: requiredItems
      };
    });

    return { mods, count: mods.length };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('toggle-mod-status', async (event, { filename, isEnabled }) => {
  try {
    const workshopDir = getWorkshopPath();
    const oldPath = path.join(workshopDir, filename);
    let newFilename;

    if (isEnabled) {
      // Disable mod
      newFilename = filename.replace(/\.vpk$/, '.vpk.disabled');
    } else {
      // Enable mod
      newFilename = filename.replace(/\.vpk\.disabled$/, '.vpk');
    }

    const newPath = path.join(workshopDir, newFilename);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      return { success: true, newFilename, isEnabled: !isEnabled };
    }
    return { success: false, error: 'El archivo no fue encontrado.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-file-location', async (event, filePath) => {
  if (!filePath) return false;
  try {
    const normalizedPath = path.normalize(filePath);
    if (fs.existsSync(normalizedPath)) {
      const stat = fs.statSync(normalizedPath);
      if (stat.isDirectory()) {
        const { exec } = require('child_process');
        exec(`explorer.exe "${normalizedPath}"`);
      } else {
        shell.showItemInFolder(normalizedPath);
      }
      return true;
    }

    const folderName = path.basename(normalizedPath);
    const l4d2SubPath = path.normalize(path.join(l4d2BasePath, 'left4dead2', folderName));
    if (fs.existsSync(l4d2SubPath)) {
      const { exec } = require('child_process');
      exec(`explorer.exe "${l4d2SubPath}"`);
      return true;
    }

    if (l4d2BasePath && fs.existsSync(l4d2BasePath)) {
      const { exec } = require('child_process');
      exec(`explorer.exe "${l4d2BasePath}"`);
      return true;
    }
  } catch (err) {
    console.error('Error opening file location:', err);
  }
  return false;
});

ipcMain.handle('open-external-url', async (event, url) => {
  if (url) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

const translationCache = {};
ipcMain.handle('translate-text', async (event, text) => {
  if (!text || typeof text !== 'string') return text;
  if (translationCache[text]) return translationCache[text];

  try {
    const paragraphs = text.split(/\n{2,}/);
    const translatedParagraphs = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        translatedParagraphs.push('');
        continue;
      }
      const apiUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=' + encodeURIComponent(paragraph.trim());
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data && Array.isArray(data[0])) {
        const translatedPart = data[0]
          .filter(x => Array.isArray(x) && typeof x[0] === 'string')
          .map(x => x[0])
          .join('');
        translatedParagraphs.push(translatedPart || paragraph);
      } else {
        translatedParagraphs.push(paragraph);
      }
    }

    const result = translatedParagraphs.join('\n\n');
    translationCache[text] = result;
    return result;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
});

function sanitizeFolderName(title, id) {
  let clean = (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents and diacritics
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/[^a-zA-Z0-9]/g, '_')   // Replace non-alphanumeric chars with _
    .replace(/_+/g, '_')             // Collapse consecutive underscores
    .replace(/^_+|_+$/g, '');        // Trim leading and trailing underscores

  if (!clean || clean.length < 2) {
    clean = 'Mod';
  }

  // Truncate clean title to max 45 chars for Windows MAX_PATH safety
  if (clean.length > 45) {
    clean = clean.substring(0, 45).replace(/_+$/g, '');
  }

  return `${clean}_${id}`;
}

ipcMain.handle('convert-workshop-mod-to-versus', async (event, modData) => {
  try {
    const { id, title, filename, fullPath } = modData;
    if (!fullPath || !fs.existsSync(fullPath)) {
      return { success: false, error: 'El archivo VPK de origen no existe.' };
    }

    const folderName = sanitizeFolderName(title, id);
    const targetDir = path.join(l4d2BasePath, folderName);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // COPY VPK file (do NOT move) and rename to pak01_dir.vpk
    const targetVpkPath = path.join(targetDir, 'pak01_dir.vpk');
    fs.copyFileSync(fullPath, targetVpkPath);

    // Copy thumbnail if available
    const workshopDir = getWorkshopPath();
    const sourceJpg = path.join(workshopDir, `${id}.jpg`);
    if (fs.existsSync(sourceJpg)) {
      fs.copyFileSync(sourceJpg, path.join(targetDir, 'preview.jpg'));
    }

    // Save metadata
    const metaPath = path.join(targetDir, 'mod_info.json');
    fs.writeFileSync(metaPath, JSON.stringify({
      id,
      title: title || `Mod ${id}`,
      filename,
      folderName,
      convertedAt: new Date().toISOString()
    }, null, 2));

    // Register in gameinfo.txt SearchPaths
    const gameinfoPath = getGameinfoPath();
    if (fs.existsSync(gameinfoPath)) {
      let content = fs.readFileSync(gameinfoPath, 'utf-8');
      const regex = new RegExp(`^\\s*(Game|Mod)\\s+["']?${folderName}["']?`, 'mi');
      if (!regex.test(content)) {
        const searchPathsIdx = content.search(/SearchPaths\s*\{/i);
        if (searchPathsIdx !== -1) {
          const coreMatch = content.match(/(\s*Game\s+["']?update["']?)/i);
          if (coreMatch && coreMatch.index > searchPathsIdx) {
            const insertPos = coreMatch.index;
            const newLine = `\n\t\t\tGame\t\t\t\t${folderName}`;
            content = content.slice(0, insertPos) + newLine + content.slice(insertPos);
          } else {
            const braceIdx = content.indexOf('{', searchPathsIdx);
            const newLine = `\n\t\t\tGame\t\t\t\t${folderName}`;
            content = content.slice(0, braceIdx + 1) + newLine + content.slice(braceIdx + 1);
          }
          fs.writeFileSync(gameinfoPath, content, 'utf-8');
        }
      }
    }

    return { success: true, folderName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-gameinfo-mod', async (event, { name }) => {
  try {
    if (!name) return { success: false, error: 'Nombre no especificado.' };

    const gameinfoPath = getGameinfoPath();
    if (fs.existsSync(gameinfoPath)) {
      let content = fs.readFileSync(gameinfoPath, 'utf-8');
      const lines = content.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        const match = trimmed.match(/^(Game|Mod)\s+(.+)$/i);
        if (match) {
          let target = match[2].trim().replace(/^"|"$/g, '');
          if (target.includes('//')) target = target.split('//')[0].trim().replace(/^"|"$/g, '');
          return target.toLowerCase() !== name.toLowerCase();
        }
        return true;
      });
      fs.writeFileSync(gameinfoPath, filteredLines.join('\n'), 'utf-8');
    }

    const pathInBase = path.join(l4d2BasePath, name);
    const pathInSub = path.join(l4d2BasePath, 'left4dead2', name);
    
    if (fs.existsSync(pathInBase)) {
      try { await shell.trashItem(pathInBase); } catch(e){ try { fs.rmSync(pathInBase, { recursive: true, force: true }); } catch(e2){} }
    }
    if (fs.existsSync(pathInSub)) {
      try { await shell.trashItem(pathInSub); } catch(e){ try { fs.rmSync(pathInSub, { recursive: true, force: true }); } catch(e2){} }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-gameinfo-mods', async () => {
  try {
    const filePath = getGameinfoPath();
    if (!fs.existsSync(filePath)) {
      return { customMods: [], convertedMods: [], corePaths: [], error: 'gameinfo.txt no encontrado.' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const searchPathsMatch = content.match(/SearchPaths\s*\{([\s\S]*?)\}/i);
    
    if (!searchPathsMatch) {
      return { customMods: [], convertedMods: [], corePaths: [], rawContent: content };
    }

    const lines = searchPathsMatch[1].split('\n');

    const knownCoreNames = [
      'update',
      'left4dead2_dlc3',
      'left4dead2_dlc2',
      'left4dead2_dlc1',
      '|gameinfo_path|.',
      'hl2'
    ];

    const customMods = [];
    const convertedMods = [];
    const corePaths = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;

      const match = trimmed.match(/^(Game|Mod)\s+(.+)$/i);
      if (match) {
        const type = match[1];
        let target = match[2].trim().replace(/^"|"$/g, '');
        
        if (target.includes('//')) {
          target = target.split('//')[0].trim().replace(/^"|"$/g, '');
        }

        const isCore = knownCoreNames.some(c => target.toLowerCase() === c.toLowerCase());
        const pathInBase = path.join(l4d2BasePath, target);
        const pathInSub = path.join(l4d2BasePath, 'left4dead2', target);
        const existsOnDisk = fs.existsSync(pathInBase) || fs.existsSync(pathInSub);
        const folderPath = fs.existsSync(pathInBase) ? pathInBase : (fs.existsSync(pathInSub) ? pathInSub : null);

        let metadata = null;
        if (folderPath) {
          const metaFile = path.join(folderPath, 'mod_info.json');
          if (fs.existsSync(metaFile)) {
            try {
              metadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
            } catch (e) {}
          }
        }

        const hasPreviewJpg = folderPath ? fs.existsSync(path.join(folderPath, 'preview.jpg')) : false;
        const previewUrl = hasPreviewJpg ? `file:///${path.join(folderPath, 'preview.jpg').replace(/\\/g, '/')}` : null;

        const isConverted = !!metadata || /_\d+$/.test(target);

        const modItem = {
          lineIndex: index,
          type,
          name: target,
          isCore,
          isConverted,
          existsOnDisk,
          folderPath,
          title: metadata?.title || target,
          workshopId: metadata?.id || (target.match(/_(\d+)$/)?.[1] || null),
          previewUrl
        };

        if (isCore) {
          corePaths.push(modItem);
        } else if (isConverted) {
          convertedMods.push(modItem);
        } else {
          customMods.push(modItem);
        }
      }
    });

    return {
      gameinfoPath: filePath,
      convertedMods,
      customMods,
      corePaths,
      rawContent: content
    };
  } catch (err) {
    return { error: err.message };
  }
});

function getAutoexecPath() {
  return path.join(l4d2BasePath, 'left4dead2', 'cfg', 'autoexec.cfg');
}

ipcMain.handle('get-autoexec-cfg', async () => {
  try {
    const filePath = getAutoexecPath();
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }
    return { autoexecPath: filePath, rawContent: content };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-autoexec-cfg', async (event, newContent) => {
  try {
    const filePath = getAutoexecPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function getAddonconfigPath() {
  return path.join(l4d2BasePath, 'left4dead2', 'cfg', 'addonconfig.cfg');
}

ipcMain.handle('get-addonconfig-cfg', async () => {
  try {
    const filePath = getAddonconfigPath();
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }
    return { addonconfigPath: filePath, rawContent: content };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-addonconfig-cfg', async (event, newContent) => {
  try {
    const filePath = getAddonconfigPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function findL4D2LaunchOptions() {
  const userdataDir = 'C:\\Program Files (x86)\\Steam\\userdata';
  if (!fs.existsSync(userdataDir)) return { launchOptions: '', vdfPath: '' };

  const userFolders = fs.readdirSync(userdataDir);
  let bestAccount = null;
  let highestTimestamp = 0;

  for (const folder of userFolders) {
    const vdfPath = path.join(userdataDir, folder, 'config', 'localconfig.vdf');
    if (fs.existsSync(vdfPath)) {
      try {
        const content = fs.readFileSync(vdfPath, 'utf-8');
        let pos = 0;
        while ((pos = content.indexOf('"550"', pos)) !== -1) {
          const block = content.substring(pos, pos + 2500);
          const lastPlayedMatch = block.match(/"LastPlayed"\s+"(\d+)"/);
          const launchMatch = block.match(/"LaunchOptions"\s+"([^"]*)"/);

          if (lastPlayedMatch) {
            const timestamp = parseInt(lastPlayedMatch[1], 10);
            if (timestamp >= highestTimestamp) {
              highestTimestamp = timestamp;
              bestAccount = {
                launchOptions: launchMatch ? launchMatch[1] : '',
                vdfPath,
                timestamp,
                pos
              };
            }
          }
          pos += 5;
        }
      } catch (e) {}
    }
  }

  return bestAccount || { launchOptions: '', vdfPath: '' };
}

function saveL4D2LaunchOptions(newOptions) {
  const data = findL4D2LaunchOptions();
  if (!data || !data.vdfPath || !fs.existsSync(data.vdfPath)) {
    return { success: false, error: 'No se encontró la configuración activa de Steam para L4D2.' };
  }

  try {
    let content = fs.readFileSync(data.vdfPath, 'utf-8');
    const targetBlock = content.substring(data.pos, data.pos + 2500);
    const launchMatch = targetBlock.match(/"LaunchOptions"\s+"([^"]*)"/);
    const cleanOptions = newOptions.replace(/"/g, '');

    if (launchMatch) {
      const oldString = launchMatch[0];
      const newString = `"LaunchOptions"\t\t"${cleanOptions}"`;
      const matchIdx = targetBlock.indexOf(oldString);
      const absoluteIdx = data.pos + matchIdx;

      content = content.substring(0, absoluteIdx) + newString + content.substring(absoluteIdx + oldString.length);
    } else {
      const braceIdx = content.indexOf('{', data.pos);
      if (braceIdx !== -1) {
        const absoluteBrace = data.pos + braceIdx;
        const newString = `\n\t\t\t\t\t\t"LaunchOptions"\t\t"${cleanOptions}"`;
        content = content.substring(0, absoluteBrace + 1) + newString + content.substring(absoluteBrace + 1);
      }
    }

    fs.writeFileSync(data.vdfPath, content, 'utf-8');
    return { success: true, vdfPath: data.vdfPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

ipcMain.handle('get-launch-options', async () => {
  try {
    const data = findL4D2LaunchOptions();
    return { launchOptions: data.launchOptions, vdfPath: data.vdfPath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-launch-options', async (event, newContent) => {
  try {
    return saveL4D2LaunchOptions(newContent);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Left 4 Dead 2 Mod Manager',
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const rootIndexPath = path.join(__dirname, '../index.html');
  if (fs.existsSync(rootIndexPath)) {
    mainWindow.loadFile(rootIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
