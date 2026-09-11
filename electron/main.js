const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'Drone Planner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('save-file', async (event, data, defaultName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'flight.flight',
    filters: [{ name: 'Flight Plan', extensions: ['flight', 'json'] }, { name: 'All', extensions: ['*'] }]
  });
  if (filePath) { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); return { success: true }; }
  return { success: false };
});

ipcMain.handle('load-file', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Flight Plan', extensions: ['flight', 'json'] }, { name: 'Python', extensions: ['py'] }, { name: 'All', extensions: ['*'] }],
    properties: ['openFile']
  });
  if (filePaths.length > 0) {
    const data = fs.readFileSync(filePaths[0], 'utf-8');
    const ext = path.extname(filePaths[0]);
    return { success: true, data, ext, path: filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('export-file', async (event, content, defaultName, ext) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'All', extensions: ['*'] }]
  });
  if (filePath) { fs.writeFileSync(filePath, content); return { success: true }; }
  return { success: false };
});
