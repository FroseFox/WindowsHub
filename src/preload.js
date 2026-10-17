const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['sys:state', 'media:state', 'ui:toggle', 'ui:game', 'feat:event', 'notif'];

contextBridge.exposeInMainWorld('hub', {
  on: (ch, cb) => { if (CHANNELS.includes(ch)) ipcRenderer.on(ch, (_e, data) => cb(data)); },
  ready: () => ipcRenderer.send('ui:ready'),
  setInteractive: (on) => ipcRenderer.send('ui:interactive', !!on),
  panelOpen: (open) => ipcRenderer.send('ui:panel', !!open),
  sys: (type, value) => ipcRenderer.invoke('sys:action', { type, value }),
  volume: (v) => ipcRenderer.send('sys:volume', v),
  media: (cmd, arg) => ipcRenderer.invoke('media:action', { cmd, arg }),
  openSettings: (key) => ipcRenderer.send('ui:settings', key),
  rect: (r) => ipcRenderer.send('ui:rect', r),
  focus: (on) => ipcRenderer.send('ui:focus', !!on),
  feat: (name, args) => ipcRenderer.invoke('feat:call', { name, args }),
  list: (cmd, args) => ipcRenderer.invoke('list:run', { cmd, args }),
});
