// const { app, BrowserWindow, ipcMain, shell } = require("electron");
// const path = require("path");
// const fs = require("fs");
// const PosPrinter = require('electron-pos-printer').PosPrinter;

// // app.commandLine.appendSwitch("disable-gpu")
// let mainWindow;

// // Setup de logs
// const logsDir = path.join(app.getPath('userData'), 'logs');
// if (!fs.existsSync(logsDir)) {
//   fs.mkdirSync(logsDir, { recursive: true });
//   if (process.platform === 'win32') {
//     shell.openPath(logsDir).catch(() => {});
//   }
// }

// const logFile = path.join(logsDir, `print-${new Date().toISOString().split('T')[0]}.log`);

// function writeLog(message) {
//   const timestamp = new Date().toISOString();
//   const logMessage = `[${timestamp}] ${message}`;
//   console.log(message);
//   fs.appendFileSync(logFile, logMessage + '\n', 'utf8');
// }

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//       contextIsolation: true,
//       nodeIntegration: false,
//       sandbox: false
//     }
//   });

//   mainWindow.loadFile(path.join(__dirname, "../dist/index.html")).then(() => {
//     writeLog('✅ Janela principal carregada');
//   }).catch((err) => {
//     writeLog(`❌ Erro ao carregar janela: ${err.message}`);
//   })
// }

// ipcMain.handle("print-html", async (event, payload) => {
//   writeLog(`🖨️ Iniciando impressão para pedido: ${payload.orderId}`);

//   try {
//     // Construir conteúdo do recibo
//     let receiptContent = [];
//     receiptContent.push({
//       type: 'text',
//       value: 'CANTINHO DAS PIZZAS',
//       style: `font-weight:bold; text-align:center;`
//     });
//     receiptContent.push({
//       type: 'text',
//       value: '------------------------',
//       style: 'text-align:center;'
//     });
//     receiptContent.push({
//       type: 'text',
//       value: `Pedido #${payload.orderId}`,
//       style: 'text-align:center;'
//     });
//     receiptContent.push({
//       type: 'text',
//       value: '------------------------',
//       style: 'text-align:center;'
//     });

//     // Adicionar itens
//     if (payload.items && Array.isArray(payload.items)) {
//       for (const item of payload.items) {
//         const quantity = item.quantity || 1;
//         const name = item.name || 'Item';
//         receiptContent.push({
//           type: 'text',
//           value: `${quantity}x ${name}`,
//           style: 'text-align:center;'
//         });
//       }
//     }

//     receiptContent.push({
//       type: 'text',
//       value: '------------------------',
//       style: 'text-align:center;'
//     });
//     receiptContent.push({
//       type: 'text',
//       value: `Total: R$ ${payload.total || 'erro ao calcular'}`,
//       style: 'text-align:center;'
//     });

//     // Impressoras
//     const printers = [
//       { address: '192.168.0.210', name: 'Delivery' },
//       { address: '192.168.0.211', name: 'Balcao' }
//     ];

//     let impressoEmAlguem = false;

//     for (const printer of printers) {
//       try {
//         writeLog(`➡️ Tentando imprimir em ${printer.name} (${printer.address})`);

//         await PosPrinter.print({
//           data: receiptContent,
//           printerName: printer.name,
//           printerAddress: printer.address,
//           width: 48,
//           margin: '0 0 0 0'
//         });

//         writeLog(`✓ Impressão concluída em ${printer.name}`);
//         impressoEmAlguem = true;
//       } catch (err) {
//         writeLog(`✗ Falha em ${printer.name}: ${err.message}`);
//       }
//     }

//     if (impressoEmAlguem) {
//       writeLog(`📊 Resultado: SUCESSO`);
//       return { success: true, message: 'Impressão concluída com sucesso' };
//     } else {
//       writeLog(`📊 Resultado: FALHA - Nenhuma impressora disponível`);
//       return { success: false, error: 'Nenhuma impressora disponível' };
//     }

//   } catch (err) {
//     writeLog(`Erro: ${err.message}`);
//     return { success: false, error: err.message };
//   }
// });

// app.whenReady().then(createWindow)



const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// app.commandLine.appendSwitch("disable-gpu")

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  console.log("__dirname:", __dirname)

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html")).then(() => {
    console.log('Janela carregada!')
  }).catch((err) => console.error('Erro ao carregar janela: ', err))
}

ipcMain.handle("print-html", async (event, payload) => {
  const { html } = payload;

  const win = new BrowserWindow({
    show: false,
    width: 576,
    webPreferences: { sandbox: false }
  });

  try {
    // 1. Attach listener BEFORE loading
    const loadPromise = new Promise((resolve) => {
      win.webContents.once("did-finish-load", resolve);
    });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await loadPromise;

    // 2. Wait for fonts/layout
    await win.webContents.executeJavaScript(`document.fonts.ready`);

    // 3. Final paint buffer
    await new Promise((resolve) => setTimeout(resolve, 100));

    // DEBUG: save PDF preview before printing
    const pdf = await win.webContents.printToPDF({ pageSize: { width: 80000, height: 297000 } });
    require("fs").writeFileSync(require("path").join(require("os").tmpdir(), "receipt_preview.pdf"), pdf);
    console.log("Preview saved to:", require("os").tmpdir());

    // 4. Find printer
    const printers = await win.webContents.getPrintersAsync();
    const elginPrinters = printers.filter(p => p.name.toUpperCase().includes("ELGIN"));
    const deliveryPrinter = printers.filter(p => p.name.toUpperCase().includes("DELIVERY"));

    if (!elginPrinters.length) {
      console.error("No ELGIN printer found. Available:", printers.map(p => p.name));
      return { success: false, error: "No ELGIN printer found" };
    }

    console.log("Printing on:", elginPrinters[0].name);

    // 5. Print
    await new Promise((resolve, reject) => {
      win.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: elginPrinters[0].name,
        margins: { marginType: "none" },
        pageSize: { width: 80000, height: 297000 },
      }, (success, err) => {
        if (!success) return reject(new Error(err));
        resolve();
      });
    });

    // 6. Tentativa EXTRA (DELIVERY) — não quebra se falhar
    if (deliveryPrinter.length) {
      console.log("Tentando imprimir na DELIVERY:", deliveryPrinter[0].name);

      await new Promise((resolve) => {
        win.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: deliveryPrinter[0].name,
          margins: { marginType: "none" },
          pageSize: { width: 80000, height: 297000 },
        }, (success, err) => {
          if (!success) {
            console.warn("Falha ao imprimir na DELIVERY:", err);
          } else {
            console.log("Print DELIVERY done!");
          } resolve()
        });
      })
    } else {
      console.log("Nenhuma impressora DELIVERY encontrada.");
    }

    return { success: true };

  } catch (err) {
    console.error("Error on printing:", err);
    return { success: false, error: err.message };
  } finally {
    win.close();
  }
});

app.whenReady().then(createWindow)