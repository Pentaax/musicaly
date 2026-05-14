const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Janela
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // YouTube
  searchSongs: (query) => ipcRenderer.invoke('search-songs', query),
  getStreamUrl: (track) => ipcRenderer.invoke('get-stream-url', track),
  getLyrics: (data) => ipcRenderer.invoke('get-lyrics', data),

  // Storage
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key) => ipcRenderer.invoke('store-delete', key),
});
