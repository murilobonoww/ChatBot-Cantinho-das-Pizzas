const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const {
  initLogs,
  loggingReceivedPayload,
  loggingResult,
  mountingEscPosBuffer,
  sendingToPrinters,
  writeLog
} = require("./main.helper");

// ─── Configuração ────────────────────────────────────────────────────────────
// Porta 9100 = RAW típico para térmicas de rede (ESC/POS over TCP)
const PORT = 9100;
const PRINTERS = [
  { ip: "192.168.0.210", port: PORT, name: "Delivery" },
  // ! CLIENTE quer impressão apenas no delivery por enquanto
  // { ip: "192.168.0.211", port: PORT, name: "Balcao" },
];

let mainWindow;

// ─── Janela ───────────────────────────────────────────────────────────────────
function createWindow() {

  initLogs(PRINTERS);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow
    .loadFile(path.join(__dirname, "../dist/index.html"))
    .then(() => writeLog("✅ Janela principal carregada"))
    .catch((err) => writeLog(`❌ Erro ao carregar janela: ${err.message}`, "ERROR"));
}

// ─── IPC: print-html ─────────────────────────────────────────────────────────
async function handlePrintHtml(_event, payload) {

  const result = loggingReceivedPayload(payload);
  if(!result.success) return result;

  const receiptBuf = mountingEscPosBuffer(payload);
  if(!Buffer.isBuffer(receiptBuf)) return receiptBuf;
  const { successCount, errors } = await sendingToPrinters(receiptBuf, PRINTERS);

  return loggingResult(successCount, errors, PRINTERS);
}

ipcMain.handle("print-html", handlePrintHtml);

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);