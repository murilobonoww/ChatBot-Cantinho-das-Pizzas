const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const net = require("net");

// ─── Impressoras ────────────────────────────────────────────────────────────
// Porta 9100 é o padrão RAW para impressoras térmicas de rede (ESC/POS over TCP)
const PRINTERS = 
[
  { ip: "192.168.0.210", port: 9100, name: "Delivery" },
  { ip: "192.168.0.211", port: 9100, name: "Balcao" },
];

const PRINTER_TIMEOUT_MS = 6000;
const PRINTER_COLS = 48; // 80mm = 48 colunas em fonte normal

// ─── Logs ────────────────────────────────────────────────────────────────────
let mainWindow;

function writeLog(message, level = "INFO") {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 23);
  console.log(`[${timestamp}] [${level.padEnd(5)}] ${message}`);
}

function logSection(title) {
  const bar = "─".repeat(60);
  writeLog(bar);
  writeLog(`  ${title}`);
  writeLog(bar);
}

/** Traduz erros de rede para português com dica de diagnóstico */
function diagnoseNetError(err, ip, port) {
  const code = err.code || "";
  const map = {
    ECONNREFUSED: `ECONNREFUSED — Impressora em ${ip}:${port} recusou a conexão.\n` +
      `               Verifique: impressora ligada? Porta RAW ${port} ativa?\n` +
      `               Teste no terminal: telnet ${ip} ${port}\n` +
      `               Se a porta for diferente, ajuste PRINTERS em main.js`,
    ETIMEDOUT: `ETIMEDOUT    — Timeout ao conectar em ${ip}:${port}.\n` +
      `               Verifique: IP correto? Firewall bloqueando? Impressora na mesma rede?`,
    EHOSTUNREACH: `EHOSTUNREACH — Host ${ip} inacessível. Verifique a rota de rede.`,
    ENETUNREACH: `ENETUNREACH  — Rede inacessível. Cabo desconectado ou Wi-Fi desligado?`,
    ENOTFOUND: `ENOTFOUND    — Hostname não encontrado: ${ip}. Use o IP numérico.`,
    EPIPE: `EPIPE        — Conexão perdida durante a escrita. Impressora desligou?`,
  };
  return map[code] || `${code || "ERRO"} — ${err.message}`;
}

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

// ─── ESC/POS helpers ─────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Mapeia caracteres acentuados do PT-BR para CP850 (código aceito pela
 * maioria das térmicas Elgin / GoojPrt / OEM).
 * Apenas os caracteres mais comuns do cardápio.
 */
const PT_TO_CP850 = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
  "â": 0x83, "ê": 0x88, "î": 0x8c, "ô": 0x93, "û": 0x96,
  "ã": 0xc6, "õ": 0xe4,
  "ç": 0x87,
  "à": 0x85,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9,
  "Â": 0xb6, "Ê": 0xd2, "Ô": 0xe2,
  "Ã": 0xc7, "Õ": 0xe5,
  "Ç": 0x80,
  "À": 0x85,
};

function encodeCP850(text) {
  const out = [];
  for (const ch of text) {
    if (PT_TO_CP850[ch] !== undefined) {
      out.push(PT_TO_CP850[ch]);
    } else {
      const code = ch.charCodeAt(0);
      out.push(code < 0x100 ? code : 0x3f); // '?' para chars fora do range
    }
  }
  return Buffer.from(out);
}

function center(text, cols = PRINTER_COLS) {
  const pad = Math.max(0, Math.floor((cols - text.length) / 2));
  return " ".repeat(pad) + text;
}

function separator(cols = PRINTER_COLS) {
  return "=".repeat(cols);
}

function lineItem(qty, name, cols = PRINTER_COLS) {
  const qtyStr = `${qty}x`;
  const maxName = cols - qtyStr.length - 1;
  const truncName = name.length > maxName ? name.slice(0, maxName) : name;
  return `${qtyStr} ${truncName}`;
}

/**
 * Monta o buffer ESC/POS completo para o cupom.
 * Retorna um Buffer pronto para enviar via TCP.
 */
function buildEscPos(payload) {
  const buf = [];

  function cmd(...bytes) {
    for (const b of bytes) buf.push(b);
  }

  function text(str) {
    const encoded = encodeCP850(str);
    for (const b of encoded) buf.push(b);
    buf.push(LF);
  }

  // Inicializa impressora
  cmd(ESC, 0x40); // ESC @ - Initialize

  // Seleciona code page CP850 (Multilingual Latin 1 — cobre PT-BR)
  cmd(ESC, 0x74, 0x02); // ESC t 2

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  cmd(ESC, 0x61, 0x01); // Centralizar
  cmd(ESC, 0x45, 0x01); // Bold ON
  cmd(GS, 0x21, 0x11); // Fonte double (2x largura, 2x altura)
  text("CANTINHO");
  text("DAS PIZZAS");
  cmd(GS, 0x21, 0x00); // Fonte normal
  cmd(ESC, 0x45, 0x00); // Bold OFF

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  text(separator());
  cmd(ESC, 0x45, 0x01);
  text(center(`Pedido #${payload.orderId}`));
  cmd(ESC, 0x45, 0x00);
  text(center(`${dateStr}  ${timeStr}`));

  // ── Itens ────────────────────────────────────────────────────────────
  text(separator());
  cmd(ESC, 0x61, 0x00); // Alinhar esquerda

  if (payload.items && Array.isArray(payload.items)) {
    for (const item of payload.items) {
      const qty = item.quantity || 1;
      const name = item.name || "Item";
      text(lineItem(qty, name));

      if (item.observation) {
        text(`  Obs: ${item.observation}`);
      }
    }
  }

  // ── Totais ────────────────────────────────────────────────────────────
  cmd(ESC, 0x61, 0x01); // Centralizar
  text(separator());
  cmd(ESC, 0x45, 0x01);

  const total = parseFloat(payload.total ?? 0)
  const totalStr = isNaN(total) ? '--' : total.toFixed(2).replace('.', ',')
  text(center(`Total: R$ ${totalStr}`));
  cmd(ESC, 0x45, 0x00);

  if (payload.paymentMethod) {
    text(center(`Pagamento: ${payload.paymentMethod}`));
  }

  if (payload.deliveryAddress) {
    cmd(ESC, 0x61, 0x00);
    text(separator());
    text(`Entrega: ${payload.deliveryAddress}`);
  }

  // ── Rodapé ───────────────────────────────────────────────────────────
  cmd(ESC, 0x61, 0x01);
  text(separator());
  text(center("Obrigado pela preferencia!"));

  // Feed + corte parcial
  cmd(LF, LF, LF);
  cmd(GS, 0x56, 0x42, 0x00); // GS V B 0 — partial cut

  return Buffer.from(buf);
}

// ─── Comunicação TCP com a impressora ────────────────────────────────────────
/**
 * Envia `data` (Buffer) para `ip:port` via TCP raw (porta 9100).
 * Cada fase da conexão é logada individualmente para facilitar diagnóstico.
 */
function sendRawTcp(ip, port, data, name, timeoutMs = PRINTER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;
    const t0 = Date.now();

    function elapsed() { return `+${Date.now() - t0}ms`; }

    function finish(err) {
      if (done) return;
      done = true;
      socket.destroy();
      err ? reject(err) : resolve();
    }

    socket.setTimeout(timeoutMs);

    writeLog(`  [TCP] ${name} — abrindo conexão para ${ip}:${port}...`);
    socket.connect(port, ip, () => {
      writeLog(`  [TCP] ${name} — CONECTADO (${elapsed()})`);
      writeLog(`  [TCP] ${name} — enviando ${data.length} bytes...`);

      socket.write(data, (writeErr) => {
        if (writeErr) {
          writeLog(`  [TCP] ${name} — ERRO ao escrever: ${writeErr.message}`, "ERROR");
          return finish(writeErr);
        }
        writeLog(`  [TCP] ${name} — dados enviados (${elapsed()}), aguardando impressão...`);
        setTimeout(() => {
          writeLog(`  [TCP] ${name} — encerrando socket`);
          socket.end();
        }, 800);
      });
    });

    socket.on("close", (hadError) => {
      writeLog(`  [TCP] ${name} — socket fechado ${hadError ? "(com erro)" : "(normal)"} (${elapsed()})`);
      finish(null);
    });

    socket.on("timeout", () => {
      writeLog(`  [TCP] ${name} — TIMEOUT após ${timeoutMs}ms sem resposta`, "WARN");
      finish(new Error(`Timeout (${timeoutMs}ms) — impressora não respondeu`));
    });

    socket.on("error", (err) => {
      writeLog(`  [TCP] ${name} — ERRO de socket: ${err.message} [${err.code}]`, "ERROR");
      finish(err);
    });
  });
}

// ─── IPC: print-html ─────────────────────────────────────────────────────────
ipcMain.handle("print-html", async (_event, payload) => {
  logSection(`IMPRESSÃO — Pedido #${payload.orderId}`);

  // ── 1. Validar payload ────────────────────────────────────────────────────
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

  // ── 2. Montar buffer ESC/POS ──────────────────────────────────────────────
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

  // ── 3. Enviar para cada impressora ────────────────────────────────────────
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

  // ── 4. Resultado final ────────────────────────────────────────────────────
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
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);