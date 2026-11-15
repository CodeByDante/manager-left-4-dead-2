const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Manager } = require('./services/manager.cjs');
let window;
const rendererFile = path.join(__dirname, 'renderer', 'index.html');
const rendererUrl = pathToFileURL(rendererFile).href;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const manager = new Manager(app.getPath('userData'), file => shell.trashItem(file));
    let pending = Promise.resolve();
    function handle(channel, fn, mutation = false) {
      ipcMain.handle(channel, async (event, data) => {
        if (event.senderFrame !== window?.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('Origen no permitido.');
        const run = async () => {
          try { return { ok: true, data: await fn(data) }; }
          catch (error) { return { ok: false, error: error.message }; }
        };
        if (!mutation) return run();
        const result = pending.then(run, run);
        pending = result.then(() => {});
        return result;
      });
    }
    handle('status', () => manager.status());
    handle('select-game', async () => {
      const result = await dialog.showOpenDialog(window, { title: 'Carpeta raíz de Left 4 Dead 2', properties: ['openDirectory'] });
      return result.canceled ? null : manager.selectGame(result.filePaths[0]);
    }, true);
    handle('select-steam', async () => {
      const result = await dialog.showOpenDialog(window, { title: 'Carpeta de Steam (steam.exe y userdata)', properties: ['openDirectory'] });
      return result.canceled ? null : manager.selectSteam(result.filePaths[0]);
    }, true);
    handle('workshop', () => manager.workshopMods());
    handle('gameinfo-mods', () => manager.gameinfoMods());
    handle('read-config', kind => manager.readConfig(kind));
    handle('save-config', data => manager.saveConfig(data), true);
    handle('toggle', data => manager.toggle(data), true);
    handle('convert', data => manager.convert(data), true);
    handle('remove', data => manager.remove(data), true);
    handle('requirements', id => manager.workshop.requirements(id));
    handle('translate', text => manager.workshop.translate(text));
    handle('backups', () => manager.listBackups());
    handle('restore', data => manager.restore(data), true);
    handle('launch', data => manager.launch(data));
    handle('save-launch', data => manager.saveLaunch(data), true);
    handle('open-location', async location => {
      const fs = require('node:fs');
      const known = { game: manager.root, workshop: manager.workshopDir, gameinfo: manager.configPath('gameinfo'), autoexec: manager.configPath('autoexec'), addonconfig: manager.configPath('addonconfig') };
      let file;
      if (location && typeof location === 'object') file = known[location.kind];
      else if (typeof location === 'string') {
        const normalized = path.resolve(location);
        const candidates = [...Object.values(known), ...manager.gameinfoMods().map(m => m.folder).filter(Boolean)];
        file = candidates.find(p => path.resolve(p) === normalized);
        if (!file && path.dirname(normalized) === path.resolve(manager.workshopDir)) {
          const filename = path.basename(normalized);
          file = manager.modLocation({ type: 'workshop', filename });
        }
      }
      if (!file || !fs.existsSync(file)) throw new Error('No se encontró esta ubicación en la instalación seleccionada.');
      if (fs.statSync(file).isDirectory()) { const error = await shell.openPath(file); if (error) throw new Error(error); }
      else shell.showItemInFolder(file);
    });
    handle('open-mod', async data => {
      const file = manager.modLocation(data);
      if (data.type === 'workshop') shell.showItemInFolder(file);
      else { const error = await shell.openPath(file); if (error) throw new Error(error); }
    });
    handle('open-game', async () => { const error = await shell.openPath(manager.root); if (error) throw new Error(error); });
    handle('open-backups', async () => { require('node:fs').mkdirSync(manager.backups, { recursive: true }); const error = await shell.openPath(manager.backups); if (error) throw new Error(error); });
    handle('external', async value => {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'steamcommunity.com') throw new Error('Solo se permiten enlaces HTTPS de Steam Workshop.');
      await shell.openExternal(url.href);
    });
    window = new BrowserWindow({ width: 1320, height: 880, minWidth: 960, minHeight: 640, backgroundColor: '#0b0d12', autoHideMenuBar: true, title: 'L4D2 Mod Manager', icon: path.join(__dirname, 'assets', 'logo.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Archivo', submenu: [
        { label: 'Elegir instalación de L4D2…', accelerator: 'Control+O', click: async () => {
          const result = await dialog.showOpenDialog(window, { title: 'Carpeta de Left 4 Dead 2', properties: ['openDirectory'] });
          if (!result.canceled) { try { manager.selectGame(result.filePaths[0]); window.webContents.reload(); } catch (error) { dialog.showErrorBox('Carpeta no válida', error.message); } }
        } },
        { label: 'Actualizar biblioteca', accelerator: 'Control+R', click: () => window.webContents.reload() },
        { type: 'separator' }, { role: 'quit', label: 'Salir' }
      ] },
      { label: 'Herramientas', submenu: [
        { label: 'Abrir copias de seguridad', click: async () => { require('node:fs').mkdirSync(manager.backups, { recursive: true }); await shell.openPath(manager.backups); } },
        { label: 'Restaurar una copia…', accelerator: 'Control+Shift+B', click: async () => {
          const result = await dialog.showOpenDialog(window, { title: 'Selecciona una copia de configuración', defaultPath: manager.backups, properties: ['openFile'], filters: [{ name: 'Copias de seguridad', extensions: ['bak'] }] });
          if (result.canceled) return;
          const id = path.basename(result.filePaths[0], '.bak');
          const item = manager.listBackups().find(b => b.id === id);
          if (!item) return dialog.showErrorBox('Copia no válida', 'Selecciona una copia de esta instalación.');
          const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Cancelar', 'Restaurar'], defaultId: 0, cancelId: 0, message: '¿Restaurar esta configuración?', detail: item.file + '\nSe respaldará la configuración actual. Cierra el juego y Steam antes de continuar.' });
          if (choice.response === 1) { try { manager.restore({ id }); window.webContents.reload(); } catch (error) { dialog.showErrorBox('No se pudo restaurar', error.message); } }
        } }
      ] }
    ]));
    window.loadFile(rendererFile);
    window.on('closed', () => { window = null; });
  }).catch(error => { dialog.showErrorBox('No se pudo iniciar', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
