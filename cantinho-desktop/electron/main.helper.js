const net = require("net");

/** Largura do cupom em colunas (80mm, fonte normal). */
const PRINTER_COLS = 48;

/** Timeout TCP padrão ao falar com impressoras de rede (porta RAW). */
const PRINTER_TIMEOUT_MS = 6000;

// ─── Logs ────────────────────────────────────────────────────────────────────
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

function initLogs(PRINTERS) {
  logSection("CANTINHO DESKTOP — INICIANDO");
  writeLog(`Versão Electron : ${process.versions.electron}`);
  writeLog(`Node.js         : ${process.versions.node}`);
  writeLog(`Plataforma      : ${process.platform} ${process.arch}`);
  writeLog(`Impressoras configuradas:`);
  for (const p of PRINTERS) {
    writeLog(`  [${p.name}]  ${p.ip}:${p.port}  timeout=${PRINTER_TIMEOUT_MS}ms`);
  }
}

function loggingReceivedPayload(payload) {

  if(!payload || !payload.orderId || !payload.items || !payload.total || !payload.pagamento || !payload.endereco_entrega) {
    writeLog("❌ Payload ausente", "ERROR");
    return { success: false, error: "Payload ausente ou inválido" };
  }

  writeLog(`[STEP 1/4] Validando payload recebido...`);
  writeLog(`  orderId       : ${payload.orderId ?? "(ausente)"}`);
  writeLog(`  itens         : ${Array.isArray(payload.items) ? payload.items.length : "(ausente)"}`);
  writeLog(`  total         : ${payload.total ?? "(ausente)"}`);
  writeLog(`  pagamento     : ${payload.pagamento ?? "(não informado)"}`);
  writeLog(`  endereço      : ${payload.endereco_entrega ?? "(não informado)"}`);

  return { success: true }
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

function loggingResult(successCount, errors, PRINTERS) {
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







// ─── ESC/POS ─────────────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Mapeia caracteres acentuados do PT-BR para CP850 (código aceito pela
 * maioria das térmicas Elgin / GoojPrt / OEM).
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
      out.push(code < 0x100 ? code : 0x3f);
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
 * @param {Object} payload — mesmo contrato do IPC print-html (pedido + itens + totais)
 * @returns {Buffer}
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

  cmd(ESC, 0x40);
  cmd(ESC, 0x74, 0x02);

  cmd(ESC, 0x61, 0x01);
  cmd(ESC, 0x45, 0x01);
  cmd(GS, 0x21, 0x11);
  text("CANTINHO");
  text("DAS PIZZAS");
  cmd(GS, 0x21, 0x00);
  cmd(ESC, 0x45, 0x00);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  text(separator());
  cmd(ESC, 0x45, 0x01);
  text(center(`Pedido #${payload.orderId}`));
  cmd(ESC, 0x45, 0x00);
  text(center(`Data Emissao: ${dateStr}  ${timeStr}`));
  text(separator());
  text(`Cliente: ${payload.cliente || "N/A"}`);
  text(`Endereco:`);
  text(`${payload.endereco_entrega?.toUpperCase() || "--"}`);
  text(`Pagamento: ${payload.pagamento ?? "--"}`);

  text(separator());
  cmd(ESC, 0x61, 0x00);

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

  cmd(ESC, 0x61, 0x01);

  text(separator());

  text(center(`Subtotal: R$ ${payload.subtotal?.toFixed(2).replace(".", ",") || "--"}`));
  const taxa_entrega = parseFloat(payload.taxa_entrega);
  const taxa_entregaStr = isNaN(taxa_entrega) ? "--" : taxa_entrega.toFixed(2).replace(".", ",");
  text(center(`Entrega: R$ ${taxa_entregaStr}`));

  cmd(ESC, 0x45, 0x01);
  const total = parseFloat(payload.total ?? 0);
  const totalStr = isNaN(total) ? "--" : total.toFixed(2).replace(".", ",");
  text(center(`Total: R$ ${totalStr}`));
  cmd(ESC, 0x45, 0x00);

  // if (payload.pagamento) {
  //   text(center(`Pagamento: ${payload.pagamento}`));
  // }

  // if (payload.endereco_entrega) {
  //   cmd(ESC, 0x61, 0x00);
  //   text(separator());
  //   text(`Endereco: ${payload.endereco_entrega}`);
  // }

  cmd(ESC, 0x61, 0x01);
  text(separator());
  text(center("Obrigado pela preferencia!"));

  cmd(LF, LF, LF);
  cmd(GS, 0x56, 0x42, 0x00);

  return Buffer.from(buf);
}

/**
 * Envia `data` (Buffer) para `ip:port` via TCP raw (ex.: porta 9100).
 */
function sendRawTcp(ip, port, data, name, timeoutMs = PRINTER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;
    const t0 = Date.now();

    function elapsed() {
      return `+${Date.now() - t0}ms`;
    }

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

function mountingEscPosBuffer(payload) {
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
  return receiptBuf;
}

async function sendingToPrinters(receiptBuf, PRINTERS) {
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

  return { successCount, errors };
}

module.exports = {
  PRINTER_COLS,
  PRINTER_TIMEOUT_MS,
  writeLog,
  logSection,
  diagnoseNetError,
  buildEscPos,
  sendRawTcp,
  initLogs,
  loggingReceivedPayload,
  mountingEscPosBuffer,
  sendingToPrinters,
  loggingResult
};
