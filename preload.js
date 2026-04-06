const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('livisapi', {
  sendVersion: () => {},
  getVersion: async (callback) => {
    try {
      const data = await ipcRenderer.invoke('get-app-version');
      if (callback) callback(data);
    } catch {}
  },
});
