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
  mainWindow.webContents.openDevTools()
}

ipcMain.handle("print", async () => {
  mainWindow.webContents.print({
    silent: true,
    printBackground: true
  })
})

ipcMain.handle("print-html", async (event, payload) => {
  const { delivery, html } = payload
  const win = new BrowserWindow({ show: false })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const printers = await win.webContents.getPrintersAsync()
  let printer
 
  if (delivery) {
    printer = printers.find(p => p.name.includes("Delivery"))?.name
  }
  else {
    printer = printers.find(p => p.name.includes("Balcão"))?.name
  }
  win.webContents.print({ silent: true, printBackground: true, deviceName: printer })
  win.close()
});

app.whenReady().then(createWindow)