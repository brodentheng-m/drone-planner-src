const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data, name) => ipcRenderer.invoke('save-file', data, name),
  loadFile: () => ipcRenderer.invoke('load-file'),
  exportFile: (content, name, ext) => ipcRenderer.invoke('export-file', content, name, ext)
});
