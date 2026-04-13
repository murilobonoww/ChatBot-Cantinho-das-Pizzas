const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const {
  PRINTER_TIMEOUT_MS,
  writeLog,
  logSection,
  diagnoseNetError,
  buildEscPos,
  sendRawTcp,
} = require("./main.helper");

// ─── Configuração ────────────────────────────────────────────────────────────
// Porta 9100 = RAW típico para térmicas de rede (ESC/POS over TCP)
const PRINTERS = [
  { ip: "192.168.0.210", port: 9100, name: "Delivery" },
  // ! CLIENTE quer impressão apenas no delivery por enquanto
  // { ip: "192.168.0.211", port: 9100, name: "Balcao" },
];

let mainWindow;

// ─── Janela ───────────────────────────────────────────────────────────────────
function createWindow() {
  logSection("CANTINHO DESKTOP — INICIANDO");
  writeLog(`Versão Electron : ${process.versions.electron}`);
  writeLog(`Node.js         : ${process.versions.node}`);
  writeLog(`Plataforma      : ${process.platform} ${process.arch}`);
  writeLog(`Impressoras configuradas:`);
  for (const p of PRINTERS) {
    writeLog(`  [${p.name}]  ${p.ip}:${p.port}  timeout=${PRINTER_TIMEOUT_MS}ms`);
  }

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
  logSection(`IMPRESSÃO — Pedido #${payload.orderId}`);

  writeLog(`[STEP 1/4] Validando payload recebido...`);
  writeLog(`  orderId       : ${payload.orderId ?? "(ausente)"}`);
  writeLog(`  itens         : ${Array.isArray(payload.items) ? payload.items.length : "(ausente)"}`);
  writeLog(`  total         : ${payload.total ?? "(ausente)"}`);
  writeLog(`  pagamento     : ${payload.paymentMethod ?? "(não informado)"}`);
  writeLog(`  endereço      : ${payload.deliveryAddress ?? "(não informado)"}`);

  if (Array.isArray(payload.items)) {
    payload.items.forEach((item, i) => {
      writeLog(`  item[${i}]       : ${item.quantity ?? 1}x ${item.name ?? "?"}`);
    });
  }

  writeLog(`[STEP 2/4] Montando buffer ESC/POS...`);
  let receiptBuf;
  try {
    receiptBuf = buildEscPos(payload);
    writeLog(`  Buffer montado: ${receiptBuf.length} bytes  (hex primeiros 16: ${receiptBuf.slice(0, 16).toString("hex")})`);
  } catch (err) {
    writeLog(`  ERRO ao montar buffer: ${err.message}`, "ERROR");
    writeLog(err.stack, "ERROR");
    return { success: false, error: `Erro ao montar cupom: ${err.message}` };
  }

  writeLog(`[STEP 3/4] Enviando para ${PRINTERS.length} impressora(s)...`);
  let successCount = 0;
  const errors = [];

  for (const printer of PRINTERS) {
    writeLog(`--- ${printer.name} (${printer.ip}:${printer.port}) ---`);
    try {
      await sendRawTcp(printer.ip, printer.port, receiptBuf, printer.name);
      writeLog(`  SUCESSO: ${printer.name} imprimiu o cupom`);
      successCount++;
    } catch (err) {
      const diag = diagnoseNetError(err, printer.ip, printer.port);
      writeLog(`  FALHA em ${printer.name}:`, "ERROR");
      writeLog(`  ${diag}`, "ERROR");
      errors.push(`${printer.name}: ${err.message}`);
    }
  }

  writeLog(`[STEP 4/4] Resultado final:`);
  if (successCount > 0) {
    writeLog(`  STATUS  : SUCESSO (${successCount}/${PRINTERS.length} impressoras)`);
    if (errors.length > 0) {
      writeLog(`  FALHAS  : ${errors.join(" | ")}`, "WARN");
    }
    return {
      success: true,
      message: `Impresso em ${successCount}/${PRINTERS.length} impressora(s)`,
    };
  }

  writeLog(`  STATUS  : FALHA TOTAL`, "ERROR");
  writeLog(`  FALHAS  : ${errors.join(" | ")}`, "ERROR");
  writeLog(`  DICA    : Veja o diagnóstico acima.`, "ERROR");
  return { success: false, error: errors.join(" | ") };
}

ipcMain.handle("print-html", handlePrintHtml);

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);
