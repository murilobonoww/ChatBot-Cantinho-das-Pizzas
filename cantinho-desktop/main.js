const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

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

  mainWindow.loadURL("https://cantinho-das-pizzas.vercel.app");
}

ipcMain.handle("print", async () => {
  mainWindow.webContents.print({
    silent: true,
    printBackground: true
  });
});


app.whenReady().then(createWindow);