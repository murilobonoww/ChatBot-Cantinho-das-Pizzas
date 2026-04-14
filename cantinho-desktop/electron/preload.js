const { contextBridge, ipcRenderer } = require("electron");

console.log('Preload carregado!')

contextBridge.exposeInMainWorld("api", {
  print: () => ipcRenderer.invoke("print"),
  /**
   * Envia o pedido ao processo principal para impressão ESC/POS.
   * @param {PrintOrderPayload} payload
   * @returns {Promise<PrintHtmlResult>}
   */
  printHTML: (payload) => {
    console.log('Preload invocando printHTML...')
    return ipcRenderer.invoke("print-html", payload)
  }
});