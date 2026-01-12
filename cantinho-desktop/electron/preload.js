const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  print: () => ipcRenderer.invoke("print"),
  printHTML: (html) => ipcRenderer.invoke("print-html", html)
});