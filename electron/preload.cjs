const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getWorkshopMods: () => ipcRenderer.invoke('get-workshop-mods'),
  getGameinfoMods: () => ipcRenderer.invoke('get-gameinfo-mods'),
  toggleModStatus: (data) => ipcRenderer.invoke('toggle-mod-status', data),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  translateText: (text) => ipcRenderer.invoke('translate-text', text),
  saveGameinfoTxt: (content) => ipcRenderer.invoke('save-gameinfo-txt', content),
  getAutoexecCfg: () => ipcRenderer.invoke('get-autoexec-cfg'),
  saveAutoexecCfg: (content) => ipcRenderer.invoke('save-autoexec-cfg', content),
  getAddonconfigCfg: () => ipcRenderer.invoke('get-addonconfig-cfg'),
  saveAddonconfigCfg: (content) => ipcRenderer.invoke('save-addonconfig-cfg', content),
  getLaunchOptions: () => ipcRenderer.invoke('get-launch-options'),
  saveLaunchOptions: (content) => ipcRenderer.invoke('save-launch-options', content),
  convertWorkshopModToVersus: (modData) => ipcRenderer.invoke('convert-workshop-mod-to-versus', modData),
  deleteGameinfoMod: (data) => ipcRenderer.invoke('delete-gameinfo-mod', data)
});

