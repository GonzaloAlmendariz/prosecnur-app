const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const APP_NAME = "Prosecnur";
const HOST = "127.0.0.1";
const MIN_R_PORT = 1024;
const MAX_R_PORT = 49151;

// Token aleatorio por arranque. Lo pasamos al backend R vía env var
// PULSO_SHUTDOWN_TOKEN. El endpoint /api/system/shutdown exige el mismo
// token en el header X-Pulso-Shutdown-Token cuando la env var está
// seteada. Así cerramos el CSRF local: otra pestaña del navegador del
// usuario no puede tumbar el backend adivinando el puerto.
const SHUTDOWN_TOKEN = randomUUID();

let mainWindow = null;
let backend = null;
let backendStopping = false;
let backendPort = null;
// Flag que marca cuando matamos el proceso adrede (por ej. durante
// reintentos por bind error) para que el watchdog del exit handler no
// muestre dialog de error en esos casos esperados.
let expectingBackendRestart = false;
// Stream a archivo de los logs del subproceso R. Se inicializa en
// app.whenReady (necesitamos app.getPath('logs')). Null si falló.
let logStream = null;
// Path a la carpeta de logs. Expuesto al menú y al dialog de errores
// para que el usuario pueda abrirla rápido cuando algo falla.
let logsDir = null;

function initLogs() {
  try {
    logsDir = app.getPath("logs");
    fs.mkdirSync(logsDir, { recursive: true });
    logStream = fs.createWriteStream(
      path.join(logsDir, "prosecnur-r.log"),
      { flags: "a" }
    );
    logStream.write(
      `\n===== Prosecnur arrancó ${new Date().toISOString()} =====\n`
    );
  } catch (error) {
    process.stderr.write(`[prosecnur-desktop] No pude abrir log file: ${error.message}\n`);
    logStream = null;
  }
}

function writeLog(line) {
  if (logStream) {
    try { logStream.write(line); } catch (_e) { /* noop */ }
  }
}

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

// Intervalo que actualiza el mensaje de loading cada pocos segundos.
// Lo usamos para cambiar el texto según cuánto tarda el arranque y así
// darle feedback al usuario cuando el primer boot con paquetes R
// nuevos se demora 30-60s. Se limpia cuando el renderer carga la
// app real o cuando pasamos a error.
let loadingInterval = null;
let loadingStartedAt = 0;

// Mensajes progresivos. Se eligen según los segundos transcurridos.
// El primer arranque con paquetes R puede tardar 30-60s sin que haya
// nada roto; el texto acompaña esa realidad en vez de angustiar.
function loadingMessageFor(elapsedMs) {
  const s = Math.floor(elapsedMs / 1000);
  if (s < 5)  return { title: "Abriendo Prosecnur", hint: "Estamos iniciando el motor local de R." };
  if (s < 15) return { title: "Abriendo Prosecnur", hint: `Cargando paquetes del motor R. (${s}s)` };
  if (s < 30) return { title: "Abriendo Prosecnur", hint: `Aún cargando. La primera vez puede tardar. (${s}s)` };
  if (s < 60) return { title: "Abriendo Prosecnur", hint: `El primer arranque con paquetes nuevos toma ~1 min. Seguimos. (${s}s)` };
  return { title: "Abriendo Prosecnur", hint: `Está tardando más de lo esperado (${s}s). Si no responde en unos minutos, revisa el menú Ayuda → Abrir carpeta de logs.` };
}

function renderLoadingPage(elapsedMs) {
  const { title, hint } = loadingMessageFor(elapsedMs);
  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(hint)}</p>
  `;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlPage(APP_NAME, body))}`);
  }
}

function showLoading() {
  stopLoadingUpdates();
  loadingStartedAt = Date.now();
  renderLoadingPage(0);
  // Update del texto cada 5s. No usamos 1s para no refrescar el DOM
  // constantemente (cada loadURL reemplaza la página entera — es caro
  // si lo hacemos cada segundo).
  loadingInterval = setInterval(() => {
    renderLoadingPage(Date.now() - loadingStartedAt);
  }, 5000);
}

function stopLoadingUpdates() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  loadingStartedAt = 0;
}

function showError(message) {
  const body = `
    <h1>No se pudo abrir Prosecnur</h1>
    <p>${escapeHtml(message)}</p>
  `;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlPage(APP_NAME, body))}`);
}

// Dialog nativo con botones Reintentar / Ver logs / Salir. Reemplaza
// al showError estático cuando R crashea después del arranque o cuando
// el startup falla de verdad (después de los reintentos por bind).
// Recursivo: "Ver logs" abre la carpeta y vuelve al dialog para que el
// usuario decida qué hacer.
async function showBackendError(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showError(message);
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "error",
    title: APP_NAME,
    message: "Se detuvo el motor local de R",
    detail:
      `${message}\n\n` +
      (logsDir ? `Logs en: ${logsDir}` : "(no se pudo inicializar el archivo de logs)"),
    buttons: ["Reintentar", "Ver logs", "Salir"],
    defaultId: 0,
    cancelId: 2
  });
  if (response === 0) {
    // Reintentar: asegurar backend muerto, mostrar loading, rearrancar.
    if (backend) {
      backendStopping = true;
      try { backend.kill(); } catch (_e) { /* noop */ }
      backend = null;
      backendStopping = false;
    }
    showLoading();
    try {
      const port = await startBackend();
      await mainWindow.loadURL(appUrl(port));
    } catch (error) {
      showBackendError(error.message || String(error));
    }
  } else if (response === 1) {
    if (logsDir) {
      shell.openPath(logsDir);
    }
    // Volver al dialog para que el usuario decida después de revisar.
    showBackendError(message);
  } else {
    app.quit();
  }
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

// 90s porque el primer arranque con paquetes R recién instalados
// puede tardar 30-60s solo en cargar namespaces (readxl, dplyr, plumber,
// callr, haven, etc.). 45s era insuficiente en equipos lentos o tras
// actualizar R. El mensaje progresivo del loading acompaña esa espera.
async function waitForBackend(port, timeoutMs = 90000) {
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

// Patterns que R/plumber/httpuv imprimen cuando falla al bindear el
// puerto. Los usamos para detectar el caso TOCTOU (alguien robó el
// puerto entre findFreePort y el spawn) y reintentar automáticamente
// con otro puerto en vez de tirar un error definitivo al usuario.
const PORT_BIND_ERROR_PATTERNS = [
  /eaddrinuse/i,
  /address already in use/i,
  /failed to create server/i,
  /httpuv.*bind/i
];

function lookedLikePortBindError(stderrSoFar) {
  return PORT_BIND_ERROR_PATTERNS.some((rx) => rx.test(stderrSoFar));
}

// Un solo intento de arranque. Si detecta error de bind en stderr antes
// del healthcheck, mata el proceso y devuelve { bound: false } para que
// startBackend reintente con otro puerto. Si todo va bien, devuelve
// { bound: true, port }.
async function spawnBackendOnce(rscript, launchScript, root, port) {
  const proc = spawn(rscript, [launchScript], {
    cwd: root,
    env: {
      ...process.env,
      PULSO_HOST: HOST,
      PULSO_PORT: String(port),
      PULSO_OPEN_BROWSER: "false",
      PULSO_SHUTDOWN_TOKEN: SHUTDOWN_TOKEN
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderrBuf = "";
  proc.stdout.on("data", (chunk) => {
    const s = `[prosecnur-r] ${chunk}`;
    process.stdout.write(s);
    writeLog(s);
  });
  proc.stderr.on("data", (chunk) => {
    const s = `[prosecnur-r] ${chunk}`;
    process.stderr.write(s);
    writeLog(s);
    stderrBuf += chunk.toString("utf8");
  });

  backend = proc;
  backendPort = port;

  proc.on("exit", (code, signal) => {
    // Ignoramos exits esperados: shutdown del usuario (backendStopping) y
    // reintentos por bind error (expectingBackendRestart). Solo disparamos
    // la UI de error si fue un crash real post-startup.
    if (backendStopping || expectingBackendRestart) return;
    if (code === 0) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    showBackendError(
      `El motor local de R se cerró inesperadamente (código ${code ?? "n/a"}, señal ${signal ?? "n/a"}).`
    );
  });

  try {
    await waitForBackend(port);
    return { bound: true, port };
  } catch (error) {
    // Si el stderr acumulado menciona EADDRINUSE u otro patrón de bind,
    // el puerto fue robado (TOCTOU) o está ocupado. Señalamos retry.
    if (lookedLikePortBindError(stderrBuf)) {
      try { proc.kill(); } catch (_e) { /* noop */ }
      backend = null;
      backendPort = null;
      return { bound: false, port, reason: "port_in_use" };
    }
    // Otro tipo de error (ej. R no instalado, paquetes faltantes):
    // dejamos que startBackend lo propague sin reintento.
    throw error;
  }
}

async function startBackend() {
  const root = appRoot();
  const launchScript = path.join(root, "launcher", "launch.R");
  const rscript = process.env.PULSO_RSCRIPT || "Rscript";
  const requestedPort = Number(process.env.PULSO_PORT || 0);
  const triedPorts = new Set();

  // Hasta 3 intentos: si el spawn falla por bind (TOCTOU entre canUsePort
  // y el listen real de R), buscamos otro puerto y reintentamos. Si es
  // un error de otro tipo, propaga en el primer intento.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let port;
    if (attempt === 1 && requestedPort >= MIN_R_PORT && requestedPort <= MAX_R_PORT) {
      port = requestedPort;
    } else {
      // findFreePort ya intenta preferred → random; si el preferred
      // ya lo usamos, saltará al random automáticamente.
      port = await findFreePort();
      while (triedPorts.has(port)) port = await findFreePort();
    }
    triedPorts.add(port);

    const result = await spawnBackendOnce(rscript, launchScript, root, port);
    if (result.bound) return result.port;

    // bind falló por puerto ocupado. Si quedan intentos, loguear y seguir.
    if (attempt < MAX_ATTEMPTS) {
      expectingBackendRestart = true;
      try {
        process.stderr.write(
          `[prosecnur-desktop] puerto ${port} robado entre check y spawn. Reintentando (${attempt}/${MAX_ATTEMPTS - 1}).\n`
        );
      } finally {
        // El exit handler del proc anterior ya corrió; nuevas spawns
        // deben procesar sus exits normalmente.
        expectingBackendRestart = false;
      }
    } else {
      throw new Error(
        `No se pudo reservar un puerto libre tras ${MAX_ATTEMPTS} intentos. Último: ${port}.`
      );
    }
  }
  // Inalcanzable, pero por completitud del flow-analysis:
  throw new Error("startBackend: estado inesperado.");
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
        timeout: 1500,
        headers: { "X-Pulso-Shutdown-Token": SHUTDOWN_TOKEN }
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
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Abrir carpeta de logs",
          click: () => {
            if (logsDir) shell.openPath(logsDir);
          }
        },
        {
          label: "Diagnóstico del motor R",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: APP_NAME,
              message: "Estado del motor",
              detail: [
                `Puerto: ${backendPort ?? "no asignado"}`,
                `Proceso R: ${backend && !backend.killed ? "corriendo" : "detenido"}`,
                `Logs: ${logsDir ?? "(no inicializados)"}`
              ].join("\n"),
              buttons: ["OK"]
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Higiene de navegación para el renderer. Sin estos guards, si el
// backend R sirve HTML con un <a target="_blank"> o el user clickea
// un link externo, Electron abre una BrowserWindow nueva sin los
// webPreferences hardened del main, lo cual es una puerta que
// preferimos cerrar de una vez.
function hardenWindowNavigation(win) {
  // 1) Bloquear navegación a orígenes distintos al backend local.
  //    La URL que carga el renderer es http://127.0.0.1:<port>/ —
  //    cualquier otra URL la delegamos al navegador externo del SO.
  win.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const expected = `${HOST}:${String(backendPort ?? "")}`;
    if (target.host !== expected) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 2) Intercepta window.open / target="_blank": siempre abrir en el
  //    navegador externo del SO, nunca en una BrowserWindow hija.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// CSP defensiva: limita al renderer a conectarse solo a sí mismo (el
// backend R local) y a usar recursos locales. Sin esto, un XSS
// hipotético podría filtrar data a un servidor externo. `connect-src`
// incluye ws://localhost por si agregamos websockets más adelante.
function installCsp() {
  const { session } = require("electron");
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const expectedHost = `${HOST}:${String(backendPort ?? "")}`;
    const csp = [
      `default-src 'self' http://${expectedHost}`,
      // 'unsafe-inline' y 'unsafe-eval' son concesiones al bundle de
      // Vite/React + plotly.js que los requiere. Si en algún momento
      // migramos a CSP estricta (hash-based), acá se endurece.
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://${expectedHost}`,
      `style-src 'self' 'unsafe-inline' http://${expectedHost}`,
      `img-src 'self' data: blob: http://${expectedHost}`,
      `font-src 'self' data: http://${expectedHost}`,
      `connect-src 'self' http://${expectedHost} ws://${expectedHost}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ");
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });
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
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  hardenWindowNavigation(mainWindow);
  showLoading();

  try {
    const port = await startBackend();
    // Paramos el update del loading ANTES del loadURL final. Si quedara
    // corriendo, el setInterval sobrescribiría la app real con la
    // pantalla de loading 5s después.
    stopLoadingUpdates();
    await mainWindow.loadURL(appUrl(port));
  } catch (error) {
    stopLoadingUpdates();
    // Dialog con botones Reintentar / Ver logs / Salir en vez del
    // showError estático que dejaba al usuario sin salida.
    showBackendError(error.message || String(error));
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
    // Initialize logs first so los primeros mensajes del backend queden
    // capturados en archivo (además de stdout del main).
    initLogs();
    // CSP debe instalarse antes del primer loadURL del renderer.
    // Depende de `backendPort` (variable global) que se setea durante
    // startBackend(). Los callbacks de onHeadersReceived leen el port
    // dinámicamente — suficiente mientras no haya request del renderer
    // antes de que R arranque, garantizado por el showLoading() que
    // usa data: URL (no intercepta data:).
    installCsp();
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
