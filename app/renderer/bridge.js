// Compatibility with the original interface. All operations use Electron IPC.
(() => {
  const desktop = window.desktop;
  let workshop = [];
  let selectedAccount = '';
  const size = n => n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + ' GB' : (n / 1024 ** 2).toFixed(2) + ' MB';
  window.api = {
    getStatus: async () => {
      const state = await desktop.status();
      return { ...state, l4d2BasePath: state.gamePath, exists: state.detected };
    },
    getWorkshopMods: async () => {
      const result = await desktop.workshop();
      workshop = result.mods;
      return { ...result, mods: workshop.map(m => ({ ...m, description: m.description || '', fullPath: m.fullPath, isEnabled: m.enabled, thumbnailUrl: m.thumbnail, sizeBytes: m.size, sizeFormatted: size(m.size) })) };
    },
    getGameinfoMods: async () => {
      const [mods, config] = await Promise.all([desktop['gameinfo-mods'](), desktop['read-config']('gameinfo')]);
      const mapped = mods.map(m => {
        const source = workshop.find(w => w.id === m.id);
        return { ...m, folderPath: m.folder, workshopId: m.id, existsOnDisk: m.exists, desc: source?.description || '', tags: source?.tags || [], previewUrl: source?.thumbnail || '', size: source ? size(source.size) : '-' };
      });
      return { rawContent: config.content, gameinfoPath: config.file, convertedMods: mapped.filter(m => m.kind === 'workshop'), customMods: mapped.filter(m => m.kind !== 'workshop') };
    },
    toggleModStatus: data => desktop.toggle(data),
    openFileLocation: location => desktop['open-location'](location),
    openExternalUrl: url => desktop.external(url),
    translateText: text => desktop.translate(text),
    saveGameinfoTxt: content => desktop['save-config']({ kind: 'gameinfo', content }),
    getAutoexecCfg: async () => { const r = await desktop['read-config']('autoexec'); return { rawContent: r.content, autoexecPath: r.file }; },
    saveAutoexecCfg: content => desktop['save-config']({ kind: 'autoexec', content }),
    getAddonconfigCfg: async () => { const r = await desktop['read-config']('addonconfig'); return { rawContent: r.content, addonconfigPath: r.file }; },
    saveAddonconfigCfg: content => desktop['save-config']({ kind: 'addonconfig', content }),
    getLaunchOptions: async () => { const r = await desktop.launch(); selectedAccount = r.id || ''; return { ...r, vdfPath: r.file }; },
    saveLaunchOptions: content => desktop['save-launch']({ accountId: selectedAccount, content }),
    convertWorkshopModToVersus: data => desktop.convert({ id: data.id, filename: data.filename }),
    deleteGameinfoMod: data => desktop.remove(data)
  };
})();
