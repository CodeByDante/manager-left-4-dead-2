const { contextBridge, ipcRenderer } = require('electron');
const channels = ['status', 'select-game', 'select-steam', 'workshop', 'gameinfo-mods', 'read-config', 'save-config', 'toggle', 'convert', 'remove', 'requirements', 'translate', 'backups', 'restore', 'launch', 'save-launch', 'open-mod', 'open-game', 'open-backups', 'external'];
const api = {};
for (const channel of channels) api[channel] = async data => {
  const result = await ipcRenderer.invoke(channel, data);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};
contextBridge.exposeInMainWorld('desktop', Object.freeze(api));
