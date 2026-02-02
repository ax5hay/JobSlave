import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;

// Check if running in development mode via electron-vite
const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'JobSlave',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow loading from localhost in dev
    },
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Use electron-vite's environment variable for dev server URL
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else if (isDev) {
    // Fallback to checking common ports
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (isDev) {
      // In development, assume API is running separately
      console.log('Development mode: API should be running separately');
      resolve();
      return;
    }

    // In production, start the API server
    const apiPath = join(__dirname, '../../api/dist/index.js');

    apiProcess = spawn('node', [apiPath], {
      env: { ...process.env, PORT: '3001' },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    apiProcess.stdout?.on('data', (data) => {
      console.log(`[API] ${data}`);
      if (data.toString().includes('JobSlave API running')) {
        resolve();
      }
    });

    apiProcess.stderr?.on('data', (data) => {
      console.error(`[API Error] ${data}`);
    });

    // Resolve after timeout if server message not detected
    setTimeout(resolve, 3000);
  });
}

function stopApiServer(): void {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
}

app.whenReady().then(async () => {
  await startApiServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopApiServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopApiServer();
});
