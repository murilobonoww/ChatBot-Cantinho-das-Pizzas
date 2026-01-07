const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  print: () => ipcRenderer.invoke("print")
});