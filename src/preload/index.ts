import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { KiteApi } from '../shared/types';

const api: KiteApi = {
  config: {
    get: () => ipcRenderer.invoke(IPC.configGet),
    getEditableApps: () => ipcRenderer.invoke(IPC.configGetEditableApps),
    update: (update) => ipcRenderer.invoke(IPC.configUpdate, update),
  },
  apps: {
    launch: (appId) => ipcRenderer.invoke(IPC.appLaunch, appId),
  },
  web: {
    open: (url) => ipcRenderer.invoke(IPC.webOpen, url),
    closeAll: () => ipcRenderer.invoke(IPC.webCloseAll),
  },
  files: {
    roots: () => ipcRenderer.invoke(IPC.filesRoots),
    list: (root, path) => ipcRenderer.invoke(IPC.filesList, root, path),
    read: (root, path) => ipcRenderer.invoke(IPC.filesRead, root, path),
    open: () => ipcRenderer.invoke(IPC.filesOpen),
    close: () => ipcRenderer.invoke(IPC.filesClose),
  },
  wifi: {
    scan: () => ipcRenderer.invoke(IPC.wifiScan),
    connect: (ssid, password) =>
      ipcRenderer.invoke(IPC.wifiConnect, ssid, password),
    disconnect: () => ipcRenderer.invoke(IPC.wifiDisconnect),
    status: () => ipcRenderer.invoke(IPC.wifiStatus),
  },
  volume: {
    get: () => ipcRenderer.invoke(IPC.volumeGet),
    set: (level) => ipcRenderer.invoke(IPC.volumeSet, level),
    mute: (muted) => ipcRenderer.invoke(IPC.volumeMute, muted),
  },
  keyboard: {
    send: (input) => ipcRenderer.invoke(IPC.keyboardSend, input),
    hide: () => ipcRenderer.invoke(IPC.keyboardHide),
    resize: (height) => ipcRenderer.invoke(IPC.keyboardResize, height),
  },
  parent: {
    status: () => ipcRenderer.invoke(IPC.parentStatus),
    setPin: (pin) => ipcRenderer.invoke(IPC.parentSetPin, pin),
    unlock: (pin) => ipcRenderer.invoke(IPC.parentUnlock, pin),
    lock: () => ipcRenderer.invoke(IPC.parentLock),
  },
  update: {
    status: () => ipcRenderer.invoke(IPC.updateStatus),
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    openRelease: () => ipcRenderer.invoke(IPC.updateOpenRelease),
  },
  sync: {
    status: () => ipcRenderer.invoke(IPC.syncStatus),
    apply: (endpoint) => ipcRenderer.invoke(IPC.syncApply, endpoint),
  },
  system: {
    version: () => ipcRenderer.invoke(IPC.systemVersion),
    home: () => ipcRenderer.invoke(IPC.systemHome),
    quit: () => ipcRenderer.invoke(IPC.systemQuit),
    power: (action) => ipcRenderer.invoke(IPC.systemPower, action),
    battery: () => ipcRenderer.invoke(IPC.systemBattery),
  },
  taskbar: {
    list: () => ipcRenderer.invoke(IPC.taskbarList),
    activate: (id) => ipcRenderer.invoke(IPC.taskbarActivate, id),
    home: () => ipcRenderer.invoke(IPC.taskbarHome),
  },
};

contextBridge.exposeInMainWorld('api', api);
