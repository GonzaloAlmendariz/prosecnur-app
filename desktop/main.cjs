const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const APP_NAME = "Prosecnur";
const HOST = "127.0.0.1";
const MIN_R_PORT = 1024;
const MAX_R_PORT = 49151;

let mainWindow = null;
let backend = null;
let backendStopping = false;
let backendPort = null;

function appRoot() {
  return process.env.PULSO_APP_ROOT || path.resolve(__dirname, "..");
}

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #18211f;
      background: #f7f4ee;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
    }
    main {
      width: min(520px, calc(100vw - 48px));
      padding: 28px;
      border: 1px solid #d9d2c4;
      border-radius: 8px;
      background: #fffdf8;
      box-shadow: 0 18px 55px rgba(45, 38, 24, 0.12);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: #5f665f;
      line-height: 1.5;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
      color: #39433f;
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function showLoading() {
  const body = `
    <h1>Abriendo Prosecnur</h1>
    <p>Estamos iniciando el motor local de R. Esto puede tomar unos segundos.</p>
  `;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlPage(APP_NAME, body))}`);
}

function showError(message) {
  const body = `
    <h1>No se pudo abrir Prosecnur</h1>
    <p>${escapeHtml(message)}</p>
  `;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlPage(APP_NAME, body))}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canUsePort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, HOST, () => server.close(() => resolve(true)));
  });
}

async function findFreePort() {
  const preferred = [8787, 8788, 8789, 8790, 8791, 8792, 8793, 8794, 8795, 8796, 8797, 8798, 8799];
  for (const port of preferred) {
    if (await canUsePort(port)) return port;
  }

  for (let i = 0; i < 80; i += 1) {
    const port = Math.floor(MIN_R_PORT + Math.random() * (MAX_R_PORT - MIN_R_PORT + 1));
    if (await canUsePort(port)) return port;
  }

  throw new Error(`No se encontró un puerto libre entre ${MIN_R_PORT} y ${MAX_R_PORT}.`);
}

function healthUrl(port) {
  return `http://${HOST}:${port}/api/system/health`;
}

function appUrl(port) {
  return `http://${HOST}:${port}/`;
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 5000, ...requestOptions } = options;
    const req = http.request(url, requestOptions, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Timeout llamando ${url}`));
    });
    req.end();
  });
}

async function waitForBackend(port, timeoutMs = 45000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await requestJson(healthUrl(port), { method: "GET", timeout: 1200 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`El backend no respondió a tiempo. Último error: ${lastError ? lastError.message : "sin respuesta"}`);
}

async function startBackend() {
  const root = appRoot();
  const launchScript = path.join(root, "launcher", "launch.R");
  const rscript = process.env.PULSO_RSCRIPT || "Rscript";
  const requestedPort = Number(process.env.PULSO_PORT || 0);
  const port = requestedPort >= MIN_R_PORT && requestedPort <= MAX_R_PORT
    ? requestedPort
    : await findFreePort();

  backendPort = port;
  backend = spawn(rscript, [launchScript], {
    cwd: root,
    env: {
      ...process.env,
      PULSO_HOST: HOST,
      PULSO_PORT: String(port),
      PULSO_OPEN_BROWSER: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  backend.stdout.on("data", (chunk) => process.stdout.write(`[prosecnur-r] ${chunk}`));
  backend.stderr.on("data", (chunk) => process.stderr.write(`[prosecnur-r] ${chunk}`));

  backend.on("exit", (code, signal) => {
    if (!backendStopping && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      showError(`El motor local de R se cerró inesperadamente. Código: ${code ?? "n/a"}. Señal: ${signal ?? "n/a"}.`);
    }
  });

  await waitForBackend(port);
  return port;
}

async function stopBackend() {
  if (!backend || backendStopping) return;

  backendStopping = true;
  const proc = backend;
  backend = null;

  if (backendPort) {
    try {
      await requestJson(`http://${HOST}:${backendPort}/api/system/shutdown`, {
        method: "POST",
        timeout: 1500
      });
    } catch (_error) {
      // Si el shutdown HTTP falla, igual matamos el proceso abajo.
    }
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!proc.killed) proc.kill("SIGTERM");
      resolve();
    }, 3500);

    proc.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createMenu() {
  const template = [
    ...(process.platform === "darwin" ? [{
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : []),
    {
      label: "Archivo",
      submenu: [
        {
          label: "Abrir en navegador",
          click: () => {
            if (backendPort) shell.openExternal(appUrl(backendPort));
          }
        },
        { type: "separator" },
        { role: "quit", label: "Salir" }
      ]
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recargar" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo" },
        { type: "separator" },
        { role: "resetZoom", label: "Tamaño real" },
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1040,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: "#f7f4ee",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  showLoading();

  try {
    const port = await startBackend();
    await mainWindow.loadURL(appUrl(port));
  } catch (error) {
    showError(error.message || String(error));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName(APP_NAME);
    createMenu();
    createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", (event) => {
    if (backend && !backendStopping) {
      event.preventDefault();
      stopBackend().finally(() => app.quit());
    }
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopBackend().finally(() => {
        process.exit(0);
      });
    });
  }
}
