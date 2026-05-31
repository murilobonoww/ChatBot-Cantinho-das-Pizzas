const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const {
  initLogs,
  loggingReceivedPayload,
  loggingResult,
  mountingEscPosBuffer,
  sendingToPrinters,
  writeLog
} = require("./main.helper");

// Porta 9100 = RAW típico para térmicas de rede (ESC/POS over TCP)
const PORT = 9100;
const PRINTERS = [
  { ip: "192.168.0.210", port: PORT, name: "Delivery" },
];

let mainWindow;

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

async function handlePrintHtml(_event, payload) {

  const result = loggingReceivedPayload(payload);
  if (!result.success) return result;

  const receiptBuf = mountingEscPosBuffer(payload);
  if (!Buffer.isBuffer(receiptBuf)) return receiptBuf;
  const { successCount, errors } = await sendingToPrinters(receiptBuf, PRINTERS);

  return loggingResult(successCount, errors, PRINTERS);
}

async function toggleChatbot(_event, boolTurn) {
  return new Promise((resolve) => {
    const command = boolTurn === true ? 'docker compose up -d' : 'docker compose down';
    const action = boolTurn === true ? 'subir' : 'derrubar';
    
      exec(command, { cwd: path.join(os.homedir(), "cantinho_docker_container"), timeout: 30000 }, (error, stdout, stderr) => {

        if (error) {
          writeLog(`Erro ao ${action} chatbot: ${error.message}`, 'ERROR');
          resolve({ success: false, error: error.message });
          return;
        }

        if (stderr) {
          writeLog(`⚠️ Aviso ao ${action} chatbot: ${stderr}`, 'WARN');
        }

        writeLog(`Sucesso ao ${action} chatbot: ${stdout}`, 'INFO');
        resolve({ success: true });
      })
  })
}

ipcMain.handle("print-html", handlePrintHtml);
ipcMain.handle("toggle-chatbot", toggleChatbot);

app.whenReady().then(createWindow);