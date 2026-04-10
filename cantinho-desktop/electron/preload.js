const { contextBridge, ipcRenderer } = require("electron");

console.log('Preload carregado!')

contextBridge.exposeInMainWorld("api", {
  print: () => ipcRenderer.invoke("print"),
  printHTML: (payload) =>{
    console.log('Preload invocando printHTML...')
    return ipcRenderer.invoke("print-html", payload)
  }
});