const { app, BrowserWindow, Menu, dialog, ipcMain, shell, safeStorage, clipboard } = require("electron");
const { spawn } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

// Handler global de excepciones — DEBE registrarse antes que cualquier otro
// require que pueda fallar (auto-updater.cjs, mac-bootstrap.cjs). Asi si algo
// crashea durante el bootstrap, el usuario ve un dialogo con el detalle del
// error y un boton "Copiar detalles" en lugar del dialogo default de Electron
// (que no permite seleccionar el texto). Ese texto lo puede pegar en un
// reporte de bug, mail al admin, etc.
function showFatalErrorDialog(err, source) {
  const stack = (err && err.stack) || (err && err.message) || String(err);
  const versionLine = (() => { try { return app.getVersion(); } catch (_) { return "unknown"; } })();
  const detail = [
    `Prosecnur ${versionLine}`,
    `Plataforma: ${process.platform} ${process.arch}`,
    `Origen: ${source}`,
    "",
    stack,
  ].join("\n");
  try {
    const choice = dialog.showMessageBoxSync({
      type: "error",
      title: "Prosecnur tuvo un problema",
      message: "Algo fallo al iniciar Prosecnur.",
      detail,
      buttons: ["Copiar detalles", "Cerrar"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice === 0) {
      clipboard.writeText(detail);
    }
  } catch (dialogErr) {
    // Si dialog mismo fallo (muy temprano), al menos mandamos al stderr.
    process.stderr.write(`[prosecnur-fatal] ${detail}\n`);
  }
}

process.on("uncaughtException", (err) => {
  showFatalErrorDialog(err, "uncaughtException");
  app.exit(1);
});
process.on("unhandledRejection", (reason) => {
  showFatalErrorDialog(reason instanceof Error ? reason : new Error(String(reason)), "unhandledRejection");
  app.exit(1);
});

const { bootstrapMacRuntime } = require("./mac-bootstrap.cjs");

const APP_NAME = "Prosecnur";
const HOST = "127.0.0.1";
const ELECTRON_DEV = process.env.PROSECNUR_ELECTRON_DEV === "1";
const DEFAULT_VITE_URL = "http://localhost:5173";
const MIN_R_PORT = 1024;
const MAX_R_PORT = 49151;
const SMOKE_CDP_PORT = process.env.PROSECNUR_SMOKE_CDP_PORT;
const AUDIT_MANIFEST_PATH = process.env.PULSO_AUDIT_RUN_MANIFEST || "";
const AUDIT_USER_DATA_DIR =
  process.env.PROSECNUR_USER_DATA_DIR ||
  (AUDIT_MANIFEST_PATH ? path.join(path.dirname(AUDIT_MANIFEST_PATH), "electron-user-data") : "");
const ALLOW_MULTI_INSTANCE =
  process.env.PULSO_ALLOW_MULTI_INSTANCE === "true" ||
  process.env.PULSO_ALLOW_MULTI_INSTANCE === "1" ||
  Boolean(AUDIT_MANIFEST_PATH);

if (AUDIT_USER_DATA_DIR) {
  fs.mkdirSync(AUDIT_USER_DATA_DIR, { recursive: true });
  app.setPath("userData", AUDIT_USER_DATA_DIR);
}

if (SMOKE_CDP_PORT && /^\d+$/.test(SMOKE_CDP_PORT)) {
  app.commandLine.appendSwitch("remote-debugging-port", SMOKE_CDP_PORT);
}

// Token aleatorio por arranque. Lo pasamos al backend R vía env var
// PULSO_SHUTDOWN_TOKEN. El endpoint /api/system/shutdown exige el mismo
// token en el header X-Pulso-Shutdown-Token cuando la env var está
// seteada. Así cerramos el CSRF local: otra pestaña del navegador del
// usuario no puede tumbar el backend adivinando el puerto.
const SHUTDOWN_TOKEN = randomUUID();

function setupAutoUpdaterIfEnabled(options) {
  if (ELECTRON_DEV) return;
  const { setupAutoUpdater } = require("./auto-updater.cjs");
  setupAutoUpdater(options);
}

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
let pendingLaunchProject = null;

function pulsoArgFromArgv(argv = []) {
  const hit = argv.find((arg) => (
    arg && typeof arg === "string" && arg.toLowerCase().endsWith(".pulso")
  ));
  return hit ? path.resolve(hit) : null;
}

function queueProjectOpen(filePath) {
  if (!filePath || !filePath.toLowerCase().endsWith(".pulso")) return;
  pendingLaunchProject = path.resolve(filePath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu:command", `project:openRecent:${pendingLaunchProject}`);
    pendingLaunchProject = null;
  }
}

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

// ===========================================================================
// Recientes — persistidos en userData/recent-projects.json
// ===========================================================================
// Hasta 5 paths absolutos a archivos .pulso. Se rotan al frente al usar
// (LRU). Se filtran los que ya no existen al leerlos. El frontend los
// muestra en el StartModal y en el submenú "Abrir reciente".

const RECENT_LIMIT = 5;

function recentProjectsPath() {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

function readRecentProjects() {
  const p = recentProjectsPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!Array.isArray(raw)) return [];
    // Filtrar los que ya no existan en disco — evita mostrar links muertos.
    return raw
      .filter((entry) => entry && typeof entry.path === "string" && fs.existsSync(entry.path))
      .slice(0, RECENT_LIMIT);
  } catch (_e) {
    return [];
  }
}

function writeRecentProjects(list) {
  try {
    fs.mkdirSync(path.dirname(recentProjectsPath()), { recursive: true });
    fs.writeFileSync(recentProjectsPath(), JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    process.stderr.write(`[prosecnur-desktop] No pude escribir recent-projects: ${e.message}\n`);
  }
}

function pushRecentProject(absPath) {
  if (!absPath || typeof absPath !== "string") return;
  const list = readRecentProjects();
  // Quitar duplicados (case-insensitive en mac, case-sensitive en linux —
  // por simplicidad usamos comparación exacta).
  const filtered = list.filter((e) => e.path !== absPath);
  filtered.unshift({
    path: absPath,
    name: path.basename(absPath, ".pulso"),
    opened_at: new Date().toISOString()
  });
  writeRecentProjects(filtered.slice(0, RECENT_LIMIT));
}

// Quita un .pulso de la lista de recientes. NO toca el archivo en disco —
// solo lo despublica del menú "Recientes" del StartModal.
function removeRecentProject(absPath) {
  if (!absPath || typeof absPath !== "string") return;
  const list = readRecentProjects();
  writeRecentProjects(list.filter((e) => e.path !== absPath));
}

// ===========================================================================
// Publicacion web — settings de Hugging Face en safeStorage
// ===========================================================================

function hfSettingsPath() {
  return path.join(app.getPath("userData"), "hf-settings.json");
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 10) return "••••";
  return `${text.slice(0, 3)}••••${text.slice(-4)}`;
}

function secretFingerprint(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeSecretRecord(record) {
  if (record && typeof record === "object" && typeof record.value === "string") {
    return {
      encrypted: record.encrypted !== false,
      value: record.value
    };
  }
  if (typeof record === "string" && record) {
    return {
      encrypted: false,
      value: Buffer.from(record, "utf8").toString("base64")
    };
  }
  return { encrypted: true, value: "" };
}

function encryptSecret(value) {
  const text = String(value || "");
  if (!text) return { encrypted: true, value: "" };
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(text).toString("base64")
    };
  }
  return {
    encrypted: false,
    value: Buffer.from(text, "utf8").toString("base64")
  };
}

function decryptSecret(record) {
  if (!record || !record.value) return "";
  try {
    const buf = Buffer.from(record.value, "base64");
    if (record.encrypted) return safeStorage.decryptString(buf);
    return buf.toString("utf8");
  } catch (_e) {
    return "";
  }
}

const HF_TOKEN_CACHE = new Map();

function hfTokenCacheKey(entry = {}) {
  const secret = entry.hf_token || {};
  return [
    entry.token_fingerprint || "",
    secret.encrypted === false ? "plain" : "encrypted",
    secret.value || "",
  ].join(":");
}

function cacheHfToken(entry, token) {
  const id = String(entry?.id || "").trim();
  const value = String(token || "").trim();
  if (!id || !value) return;
  HF_TOKEN_CACHE.set(id, {
    key: hfTokenCacheKey(entry),
    token: value,
  });
}

function forgetCachedHfToken(id) {
  const key = String(id || "").trim();
  if (key) HF_TOKEN_CACHE.delete(key);
}

function retainCachedHfTokenIds(ids) {
  const keep = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  for (const id of HF_TOKEN_CACHE.keys()) {
    if (!keep.has(id)) HF_TOKEN_CACHE.delete(id);
  }
}

function cachedHfToken(entry) {
  const id = String(entry?.id || "").trim();
  const key = hfTokenCacheKey(entry);
  const cached = id ? HF_TOKEN_CACHE.get(id) : null;
  if (cached && cached.key === key && cached.token) return cached.token;
  const token = decryptSecret(entry?.hf_token);
  if (id && token) cacheHfToken(entry, token);
  else if (id) forgetCachedHfToken(id);
  return token;
}

function cachedHfTokenMatches(entry, token) {
  const id = String(entry?.id || "").trim();
  const cached = id ? HF_TOKEN_CACHE.get(id) : null;
  return Boolean(cached && cached.key === hfTokenCacheKey(entry) && cached.token === token);
}

function hfTokenMeta(entry) {
  return {
    id: entry.id,
    name: entry.name || entry.hf_username || "Token HF",
    hf_username: entry.hf_username || "",
    masked_token: entry.masked_token || "••••",
    created_at: entry.created_at || null,
    last_used_at: entry.last_used_at || null
  };
}

function normalizeHfNamespace(value) {
  return String(value || "").trim();
}

function hfAppUrlForDestination(namespace, spaceName) {
  const ns = normalizeHfNamespace(namespace);
  const space = String(spaceName || "").trim();
  if (!ns || !space) return "";
  const appSlug = tolowerSafe(`${ns.replace(/[^A-Za-z0-9]+/g, "-")}-${space}`);
  return `https://${appSlug}.hf.space`;
}

function tolowerSafe(value) {
  return String(value || "").toLowerCase();
}

function normalizeHfDestinationEntry(entry = {}) {
  let namespace = normalizeHfNamespace(entry.namespace || entry.destination_namespace || entry.hf_username);
  let spaceName = String(entry.space_name || entry.spaceName || "").trim();
  const repoIdInput = String(entry.repo_id || entry.repoId || "").trim();
  if ((!namespace || !spaceName) && repoIdInput.includes("/")) {
    const parts = repoIdInput.split("/");
    namespace = namespace || normalizeHfNamespace(parts[0]);
    spaceName = spaceName || String(parts.slice(1).join("/")).trim();
  }
  const repoId = namespace && spaceName ? `${namespace}/${spaceName}` : repoIdInput;
  const appUrl = String(entry.app_url || entry.appUrl || "").trim() || hfAppUrlForDestination(namespace, spaceName);
  const id = typeof entry.id === "string" && entry.id ? entry.id : (repoId || namespace || randomUUID());
  return {
    id,
    namespace,
    space_name: spaceName,
    repo_id: repoId,
    app_url: appUrl,
    label: String(entry.label || entry.name || repoId || namespace || "Destino HF").trim(),
    module: String(entry.module || "").trim(),
    audience: String(entry.audience || "").trim(),
    private: Boolean(entry.private),
    created_at: entry.created_at || null,
    last_used_at: entry.last_used_at || null
  };
}

function hfDestinationMeta(entry) {
  return {
    id: entry.id,
    namespace: entry.namespace || "",
    space_name: entry.space_name || "",
    repo_id: entry.repo_id || "",
    app_url: entry.app_url || "",
    label: entry.label || entry.repo_id || entry.namespace || "Destino HF",
    module: entry.module || "",
    audience: entry.audience || "",
    private: Boolean(entry.private),
    created_at: entry.created_at || null,
    last_used_at: entry.last_used_at || null
  };
}

function normalizeHfTokenEntry(entry = {}) {
  const id = typeof entry.id === "string" && entry.id ? entry.id : randomUUID();
  const hfUsername = typeof entry.hf_username === "string" ? entry.hf_username : "";
  const name = typeof entry.name === "string" && entry.name ? entry.name : (hfUsername || "Token HF");
  const hfToken = normalizeSecretRecord(entry.hf_token || entry.token);
  const maskedToken = typeof entry.masked_token === "string" && entry.masked_token
    ? entry.masked_token
    : (typeof entry.maskedToken === "string" && entry.maskedToken ? entry.maskedToken : "••••");
  const fingerprint = typeof entry.token_fingerprint === "string" && entry.token_fingerprint
    ? entry.token_fingerprint
    : (typeof entry.tokenFingerprint === "string" ? entry.tokenFingerprint : "");
  return {
    id,
    name,
    hf_username: hfUsername,
    hf_token: hfToken,
    masked_token: maskedToken,
    token_fingerprint: fingerprint,
    created_at: entry.created_at || null,
    last_used_at: entry.last_used_at || null
  };
}

function readHfSettingsRaw() {
  const p = hfSettingsPath();
  if (!fs.existsSync(p)) {
    return {
      hf_username: "",
      default_namespace: "",
      destinations: [],
      tokens: []
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const tokens = (Array.isArray(raw.tokens) ? raw.tokens : [])
      .map(normalizeHfTokenEntry)
      .filter((entry) => entry.hf_token.value);
    const destinations = (Array.isArray(raw.destinations) ? raw.destinations : [])
      .map(normalizeHfDestinationEntry)
      .filter((entry) => entry.namespace || entry.repo_id);
    let migrated = false;
    // Migracion del formato inicial: un unico token en hf_token.
    if (raw.hf_token && !tokens.length) {
      tokens.push(normalizeHfTokenEntry({
        id: randomUUID(),
        name: raw.hf_username || "Token HF",
        hf_username: raw.hf_username || "",
        hf_token: raw.hf_token,
        masked_token: raw.masked_token || "••••",
        token_fingerprint: raw.token_fingerprint || "",
        created_at: raw.updated_at || new Date().toISOString(),
        last_used_at: raw.updated_at || null
      }));
      migrated = true;
    }
    if (migrated) {
      writeHfSettingsRaw({
        hf_username: raw.hf_username || "",
        default_namespace: normalizeHfNamespace(raw.default_namespace || raw.destination_namespace),
        destinations,
        tokens,
        updated_at: raw.updated_at || new Date().toISOString()
      });
    }
    return {
      hf_username: typeof raw.hf_username === "string" ? raw.hf_username : "",
      default_namespace: normalizeHfNamespace(raw.default_namespace || raw.destination_namespace),
      destinations,
      tokens
    };
  } catch (_e) {
    return {
      hf_username: "",
      default_namespace: "",
      destinations: [],
      tokens: []
    };
  }
}

function writeHfSettingsRaw(raw) {
  fs.mkdirSync(path.dirname(hfSettingsPath()), { recursive: true });
  fs.writeFileSync(hfSettingsPath(), JSON.stringify(raw, null, 2), "utf8");
}

function encryptionAvailableForSettings() {
  // En macOS consultar Safe Storage puede tocar el llavero segun el estado del
  // sistema. El listado de tokens solo necesita metadata, no validar el secreto.
  if (process.platform === "darwin") return true;
  return safeStorage.isEncryptionAvailable();
}

function readHfSettings() {
  const raw = readHfSettingsRaw();
  return {
    hf_username: raw.hf_username || "",
    default_namespace: raw.default_namespace || "",
    token_configured: raw.tokens.length > 0,
    encryption_available: encryptionAvailableForSettings(),
    saved_tokens: raw.tokens.map(hfTokenMeta),
    recent_destinations: raw.destinations.map(hfDestinationMeta)
  };
}

function getHfToken(id) {
  const raw = readHfSettingsRaw();
  const entry = raw.tokens.find((t) => t.id === id);
  if (!entry) return null;
  return {
    ...hfTokenMeta(entry),
    hf_token: cachedHfToken(entry)
  };
}

function rememberSuccessfulHfToken(settings = {}) {
  const id = String(settings.id || settings.token_id || settings.tokenId || "").trim();
  const username = String(
    settings.credential_username ||
    settings.token_username ||
    settings.account_username ||
    settings.hf_account ||
    settings.hf_username ||
    ""
  ).trim();
  const token = String(settings.hf_token || "").trim();
  const destinationNamespace = normalizeHfNamespace(settings.destination_namespace || settings.namespace);
  const name = String(settings.name || username || destinationNamespace || "Token HF").trim();
  if (!token) return readHfSettings();
  const raw = readHfSettingsRaw();
  const now = new Date().toISOString();
  const fingerprint = secretFingerprint(token);
  const existing = raw.tokens.find((entry) => entry.id === id) ||
    raw.tokens.find((entry) => entry.hf_username === username && entry.token_fingerprint === fingerprint);
  let cachedEntry = null;
  if (existing) {
    const sameStoredToken =
      (existing.token_fingerprint && existing.token_fingerprint === fingerprint) ||
      cachedHfTokenMatches(existing, token);
    existing.name = name;
    existing.hf_username = username;
    if (!sameStoredToken) existing.hf_token = encryptSecret(token);
    existing.masked_token = maskSecret(token);
    existing.token_fingerprint = fingerprint;
    existing.created_at = existing.created_at || now;
    existing.last_used_at = now;
    raw.tokens = [
      existing,
      ...raw.tokens.filter((entry) => entry.id !== existing.id)
    ];
    cachedEntry = existing;
  } else {
    cachedEntry = {
      id: randomUUID(),
      name,
      hf_username: username,
      hf_token: encryptSecret(token),
      masked_token: maskSecret(token),
      token_fingerprint: fingerprint,
      created_at: now,
      last_used_at: now
    };
    raw.tokens.unshift(cachedEntry);
  }
  cacheHfToken(cachedEntry, token);
  raw.tokens = raw.tokens.slice(0, 10);
  retainCachedHfTokenIds(raw.tokens.map((entry) => entry.id));
  if (username) raw.hf_username = username;
  if (destinationNamespace || settings.repo_id || settings.space_name) {
    rememberHfDestination(settings, raw);
  }
  const payload = {
    hf_username: raw.hf_username,
    default_namespace: raw.default_namespace || "",
    destinations: raw.destinations || [],
    tokens: raw.tokens,
    updated_at: new Date().toISOString()
  };
  writeHfSettingsRaw(payload);
  return readHfSettings();
}

function rememberHfDestination(settings = {}, existingRaw = null) {
  const raw = existingRaw || readHfSettingsRaw();
  const now = new Date().toISOString();
  const destination = normalizeHfDestinationEntry({
    namespace: settings.destination_namespace || settings.namespace || settings.hf_username,
    space_name: settings.space_name,
    repo_id: settings.repo_id,
    app_url: settings.app_url,
    label: settings.label || settings.name,
    module: settings.module,
    audience: settings.audience,
    private: settings.private,
    created_at: now,
    last_used_at: now
  });
  if (!destination.namespace && !destination.repo_id) {
    return existingRaw ? raw : readHfSettings();
  }
  const existing = raw.destinations.find((entry) => (
    (destination.repo_id && entry.repo_id === destination.repo_id) ||
    (destination.namespace && destination.space_name &&
      entry.namespace === destination.namespace && entry.space_name === destination.space_name)
  ));
  if (existing) {
    Object.assign(existing, {
      namespace: destination.namespace || existing.namespace,
      space_name: destination.space_name || existing.space_name,
      repo_id: destination.repo_id || existing.repo_id,
      app_url: destination.app_url || existing.app_url,
      label: destination.label || existing.label,
      module: destination.module || existing.module,
      audience: destination.audience || existing.audience,
      private: destination.private,
      created_at: existing.created_at || now,
      last_used_at: now
    });
    raw.destinations = [
      existing,
      ...raw.destinations.filter((entry) => entry.id !== existing.id)
    ];
  } else {
    raw.destinations.unshift(destination);
  }
  raw.destinations = raw.destinations.slice(0, 20);
  if (destination.namespace) raw.default_namespace = destination.namespace;
  if (!existingRaw) {
    writeHfSettingsRaw({
      hf_username: raw.hf_username || "",
      default_namespace: raw.default_namespace || "",
      destinations: raw.destinations,
      tokens: raw.tokens,
      updated_at: now
    });
  }
  return existingRaw ? raw : readHfSettings();
}

function saveHfDefaultNamespace(settings = {}) {
  const namespace = normalizeHfNamespace(settings.namespace || settings.destination_namespace || settings.hf_username);
  const raw = readHfSettingsRaw();
  raw.default_namespace = namespace;
  writeHfSettingsRaw({
    hf_username: raw.hf_username || "",
    default_namespace: raw.default_namespace || "",
    destinations: raw.destinations,
    tokens: raw.tokens,
    updated_at: new Date().toISOString()
  });
  return readHfSettings();
}

function requestHfJson(pathname, token) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "huggingface.co",
      path: pathname,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": `${APP_NAME}/desktop`,
      },
      timeout: 15000,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch (_e) { parsed = {}; }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status_code: res.statusCode || 0,
          body: parsed,
        });
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("Timeout al contactar Hugging Face."));
    });
    req.on("error", (error) => {
      resolve({ ok: false, status_code: 0, error: error.message, body: {} });
    });
    req.end();
  });
}

async function checkHfToken(settings = {}) {
  const id = String(settings.id || settings.token_id || settings.tokenId || "").trim();
  const explicitToken = String(settings.hf_token || "").trim();
  let token = explicitToken;
  if (!token && id) {
    const saved = getHfToken(id);
    token = String(saved?.hf_token || "").trim();
  }
  if (!token) {
    return { ok: false, status_code: 0, error: "Pega un token HF o selecciona uno guardado." };
  }
  const result = await requestHfJson("/api/whoami-v2", token);
  if (!result.ok) {
    const error = result.error || result.body?.error || result.body?.message || "Hugging Face no aceptó el token.";
    return { ok: false, status_code: result.status_code, error: String(error) };
  }
  const body = result.body || {};
  const name = body.name || body.fullname || body.email || "";
  const orgs = Array.isArray(body.orgs) ? body.orgs.length : 0;
  return {
    ok: true,
    status_code: result.status_code,
    name: String(name || ""),
    org_count: orgs,
  };
}

function forgetHfToken(settings = {}) {
  const id = String(settings.id || settings.token_id || settings.tokenId || "").trim();
  const raw = readHfSettingsRaw();
  if (id) forgetCachedHfToken(id);
  else HF_TOKEN_CACHE.clear();
  raw.tokens = id ? raw.tokens.filter((entry) => entry.id !== id) : [];
  const first = raw.tokens[0];
  writeHfSettingsRaw({
    hf_username: first?.hf_username || raw.hf_username || "",
    default_namespace: raw.default_namespace || "",
    destinations: raw.destinations || [],
    tokens: raw.tokens,
    updated_at: new Date().toISOString()
  });
  return readHfSettings();
}

function forgetHfDestination(settings = {}) {
  const id = String(settings.id || "").trim();
  const raw = readHfSettingsRaw();
  raw.destinations = id ? raw.destinations.filter((entry) => entry.id !== id) : [];
  if (!raw.destinations.some((entry) => entry.namespace === raw.default_namespace)) {
    raw.default_namespace = raw.destinations[0]?.namespace || raw.default_namespace || "";
  }
  writeHfSettingsRaw({
    hf_username: raw.hf_username || "",
    default_namespace: raw.default_namespace || "",
    destinations: raw.destinations,
    tokens: raw.tokens,
    updated_at: new Date().toISOString()
  });
  return readHfSettings();
}

// ===========================================================================
// IPC handlers — invocados desde preload.cjs
// ===========================================================================

function registerIpcHandlers() {
  function dialogDefaultPath(args = {}, fallbackDir = app.getPath("documents"), filename = "") {
    const raw = args.defaultPath && typeof args.defaultPath === "string"
      ? args.defaultPath
      : fallbackDir;
    const base = raw && path.extname(raw) ? path.dirname(raw) : raw;
    return filename ? path.join(base || fallbackDir, filename) : (base || fallbackDir);
  }

  ipcMain.handle("project:openDialog", async (_event, args = {}) => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: "Abrir proyecto Prosecnur",
      defaultPath: dialogDefaultPath(args),
      filters: [
        { name: "Proyecto Prosecnur", extensions: ["pulso"] },
        { name: "Todos", extensions: ["*"] }
      ],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("project:saveDialog", async (_event, args) => {
    const defaultName = (args && args.defaultName) || "MiProyecto";
    const filename = defaultName.endsWith(".pulso") ? defaultName : `${defaultName}.pulso`;
    const defaultPath = dialogDefaultPath(args || {}, app.getPath("documents"), filename);
    const result = await dialog.showSaveDialog(mainWindow || undefined, {
      title: "Guardar proyecto Prosecnur",
      defaultPath,
      filters: [{ name: "Proyecto Prosecnur", extensions: ["pulso"] }]
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle("project:saveEntregableDialog", async (_event, args = {}) => {
    const defaultName = args.defaultName || "entregable";
    const filters = args.filters || [{ name: "Todos", extensions: ["*"] }];
    const defaultPath = args.defaultPath || dialogDefaultPath(args, app.getPath("documents"), defaultName);
    const result = await dialog.showSaveDialog(mainWindow || undefined, {
      title: "Guardar entregable",
      defaultPath,
      filters
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle("project:getRecent", () => readRecentProjects());

  ipcMain.handle("project:getLaunchProject", () => {
    const p = pendingLaunchProject;
    pendingLaunchProject = null;
    return p;
  });

  ipcMain.handle("project:pushRecent", (_event, args = {}) => {
    if (args.path) pushRecentProject(args.path);
    return readRecentProjects();
  });

  ipcMain.handle("project:removeRecent", (_event, args = {}) => {
    if (args.path) removeRecentProject(args.path);
    return readRecentProjects();
  });

  ipcMain.handle("hf:getSettings", () => readHfSettings());

  ipcMain.handle("hf:getToken", (_event, args = {}) => getHfToken(args.id));

  ipcMain.handle("hf:rememberSuccessfulToken", (_event, args = {}) => rememberSuccessfulHfToken(args));

  ipcMain.handle("hf:checkToken", (_event, args = {}) => checkHfToken(args));

  ipcMain.handle("hf:forgetToken", (_event, args = {}) => forgetHfToken(args));

  ipcMain.handle("hf:rememberDestination", (_event, args = {}) => rememberHfDestination(args));

  ipcMain.handle("hf:saveDefaultNamespace", (_event, args = {}) => saveHfDefaultNamespace(args));

  ipcMain.handle("hf:forgetDestination", (_event, args = {}) => forgetHfDestination(args));
}

// Helper para enviar comandos del menú al renderer. Se usa desde
// `createMenu` cuando el user clickea Archivo → Nuevo / Abrir / Guardar.
function sendMenuCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu:command", command);
  }
}

// Construye el submenú "Abrir reciente" del menú Archivo. Si no hay
// recientes, queda con un placeholder "(vacío)" deshabilitado.
function buildRecentSubmenu() {
  const list = readRecentProjects();
  if (!list.length) {
    return [{ label: "(vacío)", enabled: false }];
  }
  return list.map((entry) => ({
    label: `${entry.name}  —  ${entry.path}`,
    click: () => {
      // Mandamos comando + path para que el renderer abra ese específico.
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("menu:command", `project:openRecent:${entry.path}`);
      }
    }
  }));
}

function appRoot() {
  if (process.env.PULSO_APP_ROOT) return process.env.PULSO_APP_ROOT;
  // En .app empaquetado por electron-builder los Internals viven junto al
  // app/ dentro de Contents/Resources/. process.resourcesPath apunta ahi.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "Internals");
  }
  // Dev: __dirname = <repo>/desktop, queremos <repo>.
  return path.resolve(__dirname, "..");
}

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_error) {
      // Ignore unreadable candidates; they are optional discovery paths.
    }
  }
  return "";
}

function configurePptxPreviewRenderer(root) {
  const moduleRel = path.join("@oai", "artifact-tool", "dist", "artifact_tool.mjs");
  const artifactModule = firstExistingPath([
    process.env.PROSECNUR_ARTIFACT_TOOL_MODULE,
    path.join(root, "node_modules", moduleRel),
    path.join(root, "desktop", "node_modules", moduleRel),
    path.join(root, "frontend", "node_modules", moduleRel),
    path.join(__dirname, "node_modules", moduleRel),
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", moduleRel)
  ]);

  if (artifactModule && !process.env.PROSECNUR_ARTIFACT_TOOL_MODULE) {
    process.env.PROSECNUR_ARTIFACT_TOOL_MODULE = artifactModule;
  }
  if (artifactModule && !process.env.PROSECNUR_ENABLE_ARTIFACT_RENDERER) {
    process.env.PROSECNUR_ENABLE_ARTIFACT_RENDERER = "1";
  }

  // Electron can run as Node for a specific child process when
  // ELECTRON_RUN_AS_NODE is set for that spawn. Do not set it globally here:
  // if it leaks into Chromium helper processes, Electron may crash with
  // "bad option" for renderer flags.
  if (artifactModule && !process.env.PROSECNUR_NODE) {
    process.env.PROSECNUR_NODE = process.execPath;
    process.env.PROSECNUR_NODE_RUN_AS_NODE = "1";
  }

  writeLog(
    `[pptx-preview] artifact-tool=${artifactModule || "not-found"}; ` +
    `node=${process.env.PROSECNUR_NODE || "system"}; desktop_automation=false\n`
  );
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
      await loadRenderer(port);
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
  const version = encodeURIComponent(app.getVersion());
  return `http://${HOST}:${port}/?appVersion=${version}`;
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]";
}

function devRendererUrlObject() {
  const raw = process.env.PROSECNUR_VITE_URL || DEFAULT_VITE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch (_error) {
    throw new Error(`PROSECNUR_VITE_URL invalida: ${raw}`);
  }
  if (url.protocol !== "http:") {
    throw new Error(`PROSECNUR_VITE_URL debe usar http:// en desarrollo: ${raw}`);
  }
  if (!isLoopbackHostname(url.hostname)) {
    throw new Error(`PROSECNUR_VITE_URL debe apuntar a localhost/127.0.0.1: ${raw}`);
  }
  return url;
}

function rendererUrl(port) {
  if (!ELECTRON_DEV) return appUrl(port);
  const url = devRendererUrlObject();
  url.searchParams.set("appVersion", app.getVersion());
  return url.toString();
}

function rendererOrigins() {
  const origins = new Set();
  if (backendPort) origins.add(`http://${HOST}:${backendPort}`);
  if (ELECTRON_DEV) origins.add(devRendererUrlObject().origin);
  return Array.from(origins);
}

function wsOriginFor(httpOrigin) {
  return httpOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

async function clearRendererCaches() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { session } = mainWindow.webContents;
  try {
    await session.clearCache();
    await session.clearStorageData({
      storages: ["cachestorage", "serviceworkers"]
    });
  } catch (error) {
    writeLog(`[prosecnur-desktop] No pude limpiar cache del renderer: ${error.message}\n`);
  }
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

async function waitForDevRenderer(timeoutMs = 30000) {
  if (!ELECTRON_DEV) return;
  const url = devRendererUrlObject().toString();
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await requestJson(url, { method: "GET", timeout: 1200 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw new Error(
    `Vite no respondió en ${url}. Abre o espera el servidor Vite antes de usar PROSECNUR_ELECTRON_DEV=1. ` +
    `Último error: ${lastError ? lastError.message : "sin respuesta"}`
  );
}

async function loadRenderer(port) {
  await waitForDevRenderer();
  await clearRendererCaches();
  await mainWindow.loadURL(rendererUrl(port));
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
  const backendEnv = { ...process.env };
  delete backendEnv.ELECTRON_RUN_AS_NODE;
  const proc = spawn(rscript, [launchScript], {
    cwd: root,
    env: {
      ...backendEnv,
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
  configurePptxPreviewRenderer(root);
  const launchScript = path.join(root, "launcher", "launch.R");
  const rscript = process.env.PULSO_RSCRIPT || "Rscript";
  const requestedPort = Number(process.env.PULSO_PORT || (ELECTRON_DEV ? "8787" : "0"));
  const triedPorts = new Set();

  if (ELECTRON_DEV) {
    if (!Number.isInteger(requestedPort) ||
        requestedPort < MIN_R_PORT ||
        requestedPort > MAX_R_PORT) {
      throw new Error(
        `PULSO_PORT debe ser un puerto local valido en modo Electron+Vite. Recibido: ${process.env.PULSO_PORT || "(vacio)"}`
      );
    }
    if (!(await canUsePort(requestedPort))) {
      throw new Error(
        `PULSO_PORT=${requestedPort} ya esta ocupado. En modo Electron+Vite no se cambia de puerto automaticamente ` +
        `porque Vite proxya /api a ese puerto. Cierra el proceso que lo usa o elige otro PULSO_PORT.`
      );
    }
  }

  // Hasta 3 intentos: si el spawn falla por bind (TOCTOU entre canUsePort
  // y el listen real de R), buscamos otro puerto y reintentamos. Si es
  // un error de otro tipo, propaga en el primer intento.
  const MAX_ATTEMPTS = ELECTRON_DEV ? 1 : 3;
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

    if (ELECTRON_DEV) {
      throw new Error(
        `PULSO_PORT=${port} no pudo usarse. En modo Electron+Vite no se reintenta con otro puerto.`
      );
    }

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
          label: "Nuevo proyecto…",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuCommand("project:new")
        },
        {
          label: "Abrir proyecto…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuCommand("project:open")
        },
        {
          label: "Abrir reciente",
          submenu: buildRecentSubmenu()
        },
        { type: "separator" },
        {
          label: "Guardar",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuCommand("project:save")
        },
        {
          label: "Guardar como…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuCommand("project:saveAs")
        },
        {
          label: "Cerrar proyecto",
          click: () => sendMenuCommand("project:close")
        },
        { type: "separator" },
        {
          label: "Abrir en navegador",
          click: () => {
            if (backendPort) shell.openExternal(rendererUrl(backendPort));
          }
        },
        { type: "separator" },
        { role: "quit", label: "Salir" }
      ]
    },
    {
      label: "Edición",
      submenu: [
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "pasteAndMatchStyle", label: "Pegar y adaptar estilo" },
        { role: "delete", label: "Borrar" },
        { role: "selectAll", label: "Seleccionar todo" }
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
  // 1) Bloquear navegación a orígenes distintos al renderer permitido.
  //    En producción es el backend local; en desarrollo visual puede ser Vite.
  win.webContents.on("will-navigate", (event, url) => {
    let target;
    try {
      target = new URL(url);
    } catch (_error) {
      event.preventDefault();
      return;
    }
    if (target.protocol === "data:" || rendererOrigins().includes(target.origin)) {
      return;
    }
    if (target.protocol === "http:" || target.protocol === "https:") {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }
    event.preventDefault();
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
    const httpSources = rendererOrigins();
    const wsSources = httpSources.map(wsOriginFor);
    const sourceList = httpSources.join(" ");
    const connectList = [...httpSources, ...wsSources].join(" ");
    const csp = [
      `default-src 'self'${sourceList ? ` ${sourceList}` : ""}`,
      // 'unsafe-inline' y 'unsafe-eval' son concesiones al bundle de
      // Vite/React + plotly.js que los requiere. Si en algún momento
      // migramos a CSP estricta (hash-based), acá se endurece.
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'${sourceList ? ` ${sourceList}` : ""}`,
      `style-src 'self' 'unsafe-inline'${sourceList ? ` ${sourceList}` : ""}`,
      `img-src 'self' data: blob:${sourceList ? ` ${sourceList}` : ""}`,
      `font-src 'self' data:${sourceList ? ` ${sourceList}` : ""}`,
      `connect-src 'self'${connectList ? ` ${connectList}` : ""}`,
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
      webSecurity: true,
      // Bridge mínimo entre renderer y main: dialogs nativos, recientes y
      // eventos de menú. Ver desktop/preload.cjs para la superficie.
      preload: path.join(__dirname, "preload.cjs")
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
    await loadRenderer(port);
  } catch (error) {
    stopLoadingUpdates();
    // Dialog con botones Reintentar / Ver logs / Salir en vez del
    // showError estático que dejaba al usuario sin salida.
    showBackendError(error.message || String(error));
  }
}

const gotLock = ALLOW_MULTI_INSTANCE || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  pendingLaunchProject = pulsoArgFromArgv(process.argv);

  app.on("second-instance", (_event, argv) => {
    const filePath = pulsoArgFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (filePath) queueProjectOpen(filePath);
  });

  app.whenReady().then(async () => {
    app.setName(APP_NAME);
    initLogs();
    // En .dmg empaquetado para mac, instalar R framework y paquetes la primera
    // vez antes de levantar el backend. En Windows el Setup.exe ya hizo todo
    // esto durante la instalacion, asi que no hay nada que hacer en runtime.
    try {
      const macSetup = await bootstrapMacRuntime({ logger: writeLog, appRoot: appRoot() });
      if (macSetup.rscriptPath) {
        process.env.PULSO_RSCRIPT = macSetup.rscriptPath;
      }
      if (macSetup.libraryDir) {
        process.env.R_LIBS_USER = macSetup.libraryDir;
      }
    } catch (err) {
      writeLog(`[bootstrap] fallo: ${err && err.message ? err.message : err}\n`);
      app.quit();
      return;
    }
    // IPC handlers (project:openDialog, saveDialog, getRecent, etc.) deben
    // registrarse antes de que el renderer cargue el preload, sino los
    // primeros invokes fallan con "No handler registered". whenReady es
    // el primer hook seguro.
    registerIpcHandlers();
    // CSP instalada antes del loadURL del renderer.
    installCsp();
    createMenu();
    createWindow();
    setupAutoUpdaterIfEnabled({ logger: writeLog });
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
