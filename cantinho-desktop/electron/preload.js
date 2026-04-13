const { contextBridge, ipcRenderer } = require("electron");

/** @typedef {import("./print-payload").PrintOrderPayload} PrintOrderPayload */
/** @typedef {import("./print-payload").PrintHtmlResult} PrintHtmlResult */

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