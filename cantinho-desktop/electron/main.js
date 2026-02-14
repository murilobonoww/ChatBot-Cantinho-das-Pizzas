const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
}

ipcMain.handle("print", async () => {
  mainWindow.webContents.print({
    //silent: true,
    printBackground: true
  })
})

ipcMain.handle("print-html", async (event, payload) => {
  const { delivery, html } = payload
  const win = new BrowserWindow({ show: false })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise(resolve => {
    win.webContents.once('did-finish-load', resolve)
  })

  const printers = await win.webContents.getPrintersAsync()
  if(!printers.length){
    console.error('Nenhuma impressora encontrada')
    win.close()
    return
  }

  for (const printer of printers) {
    await new Promise((resolve, reject) => {
      win.webContents.print({ silent: true, printBackground: true, deviceName: printer.name },
        (success, errorType) => {
          if (!success) {
            console.error(`Erro ao printar: `, errorType)
            return reject(errorType)
          }
          resolve()
        }
      )
    })
  }

  win.close()
});

app.whenReady().then(createWindow)