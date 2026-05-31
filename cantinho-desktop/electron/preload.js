const { contextBridge, ipcRenderer } = require("electron");

console.log('Preload carregado!')

contextBridge.exposeInMainWorld("api", {
  printHTML: (payload) => ipcRenderer.invoke("print-html", payload),
  toggleChatbot: (turn) => ipcRenderer.invoke("toggle-chatbot", turn)
});