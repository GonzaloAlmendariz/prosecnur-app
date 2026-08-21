#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const requireFromFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

const DEFAULT_TIMEOUT_MS = Number(process.env.UI_QA_TIMEOUT_MS || "30000");
const DEFAULT_PREFETCH_TIMEOUT_MS = Number(process.env.UI_QA_PREFETCH_TIMEOUT_MS || "90000");
const DEFAULT_CLICK_TIMEOUT_MS = Number(process.env.UI_QA_CLICK_TIMEOUT_MS || "30000");
const HEAVY_MONITOREO_SCOPES = new Set(["advance_summary", "queries_summary", "phone_summary", "validation_summary"]);
// Las CINCO secciones de Procesamiento. `/graficos` faltaba, y por eso la
// matriz por defecto nunca lo miró: el módulo llegó a tener 33.000 líneas de
// CSS y cero grupos geométricos declarados sin que ningún comprobador se
// quejara. Estar fuera de esta lista es la forma silenciosa de quedar verde
// por ausencia; si mañana nace una sección nueva, va aquí el mismo día.
const PROCESSING_ROUTES = ["/carga", "/validacion", "/codificacion", "/analitica", "/graficos"];
const LAYOUT_VIEWPORTS = [
  { width: 1710, height: 1107 },
  { width: 1440, height: 1000 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];
const DEFAULT_VIEWPORT = { width: 1366, height: 768 };
const VALID_PRESETS = new Set(["auto", "large", "portable", "portable-compact", "compact", "short"]);

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const out = {
    url: "",
    api: "auto",
    apiUrl: "",
    project: process.env.PULSO || "",
    out: process.env.UI_QA_OUT || path.join("tmp", "visual-qa", "quick", timestampSlug()),
    routes: [],
    viewports: [],
    layoutPreset: process.env.UI_QA_LAYOUT_PRESET || "auto",
    waitSelector: ".pulso-page-frame, [data-audit-ready], .pulso-shell",
    postClickWaitSelector: "",
    waitAfterClickSelector: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    frontendPort: Number(process.env.UI_QA_FRONTEND_PORT || process.env.VITE_DEV_PORT || "5174"),
    apiPort: Number(process.env.UI_QA_API_PORT || process.env.PULSO_PORT || "8788"),
    matrix: false,
    headed: false,
    keepServers: false,
    failOnIssues: false,
    fullPage: false,
    focusedWarmup: process.env.UI_QA_FULL_WARMUP === "1" ? false : true,
    prefetchRouteData: process.env.UI_QA_PREFETCH_ROUTE_DATA === "1",
    geometryGroups: [],
    geometryTolerance: Number(process.env.UI_QA_GEOMETRY_TOLERANCE || "2"),
    requireGeometry: false,
    barrerPopovers: process.env.UI_QA_SIN_POPOVERS === "1" ? false : true,
    clickTabs: [],
    sembrar: [],
    direcciones: [],
    name: "quick",
    routeProvided: false,
    viewportProvided: false,
    urlProvided: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--url") {
      out.url = next();
      out.urlProvided = true;
    } else if (arg === "--api") {
      out.api = next();
    } else if (arg === "--api-url") {
      out.apiUrl = next();
    } else if (arg === "--project") {
      out.project = next();
    } else if (arg === "--out") {
      out.out = next();
    } else if (arg === "--route") {
      out.routes.push(normalizeRoute(next()));
      out.routeProvided = true;
    } else if (arg === "--viewport") {
      out.viewports.push(parseViewport(next()));
      out.viewportProvided = true;
    } else if (arg === "--layout-preset" || arg === "--preset") {
      out.layoutPreset = next();
    } else if (arg === "--wait-selector") {
      out.waitSelector = next();
    } else if (arg === "--post-click-wait-selector") {
      out.postClickWaitSelector = next();
    } else if (arg === "--wait-after-click-selector") {
      out.waitAfterClickSelector = next();
    } else if (arg === "--timeout-ms") {
      out.timeoutMs = Number(next());
    } else if (arg === "--frontend-port") {
      out.frontendPort = Number(next());
    } else if (arg === "--api-port") {
      out.apiPort = Number(next());
    } else if (arg === "--click-tab") {
      out.clickTabs.push(next());
    } else if (arg === "--sembrar") {
      out.sembrar.push(next());
    } else if (arg === "--ir") {
      out.direcciones.push(next());
    } else if (arg === "--name") {
      out.name = next();
    } else if (arg === "--matrix") {
      out.matrix = true;
    } else if (arg === "--headed") {
      out.headed = true;
    } else if (arg === "--keep-servers") {
      out.keepServers = true;
    } else if (arg === "--fail-on-issues") {
      out.failOnIssues = true;
    } else if (arg === "--full-page") {
      out.fullPage = true;
    } else if (arg === "--focused-warmup") {
      out.focusedWarmup = true;
    } else if (arg === "--full-warmup") {
      out.focusedWarmup = false;
    } else if (arg === "--prefetch-route-data") {
      out.prefetchRouteData = true;
    } else if (arg === "--geometry-group") {
      out.geometryGroups.push(parseGeometryGroup(next()));
    } else if (arg === "--geometry-tolerance") {
      out.geometryTolerance = Number(next());
    } else if (arg === "--require-geometry") {
      out.requireGeometry = true;
    } else if (arg === "--sin-popovers") {
      out.barrerPopovers = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  if (out.matrix && !out.routeProvided) out.routes = [...PROCESSING_ROUTES];
  if (out.matrix && !out.viewportProvided) out.viewports = [...LAYOUT_VIEWPORTS];
  if (out.routes.length === 0) out.routes = ["/carga"];
  if (out.viewports.length === 0) out.viewports = [DEFAULT_VIEWPORT];
  out.routes = dedupe(out.routes);
  out.viewports = dedupeViewports(out.viewports);

  if (!VALID_PRESETS.has(out.layoutPreset)) {
    throw new Error(`Preset inválido: ${out.layoutPreset}. Usa: ${Array.from(VALID_PRESETS).join(", ")}.`);
  }
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) {
    throw new Error(`Timeout inválido: ${out.timeoutMs}`);
  }
  if (!Number.isFinite(out.geometryTolerance) || out.geometryTolerance < 0) {
    throw new Error(`Tolerancia geométrica inválida: ${out.geometryTolerance}`);
  }
  if (out.geometryGroups.length > 0) out.requireGeometry = true;
  if (!Number.isFinite(out.frontendPort) || out.frontendPort <= 0) {
    throw new Error(`Puerto frontend inválido: ${out.frontendPort}`);
  }
  if (!Number.isFinite(out.apiPort) || out.apiPort <= 0) {
    throw new Error(`Puerto API inválido: ${out.apiPort}`);
  }
  if (!["auto", "stub", "real"].includes(out.api)) {
    throw new Error(`--api inválido: ${out.api}. Usa auto, stub o real.`);
  }
  if (out.api === "stub" && out.project) {
    throw new Error("--project requiere --api real o --api auto; no puede usar API simulada.");
  }
  if (out.project) out.project = path.resolve(out.project);
  if (out.api === "auto") out.api = out.project ? "real" : "stub";
  if (out.url) out.url = normalizeBaseUrl(out.url);
  return out;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/ui-quick-check.mjs --route /validacion --viewport 1366x768 --layout-preset portable-compact
  node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --route /analitica --viewport 1024x600 --layout-preset short
  node scripts/ui-quick-check.mjs --project /ruta/proyecto.pulso --matrix --fail-on-issues

Qué hace:
  - Sin --project: arranca solo Vite en un puerto libre y simula lo mínimo de /api.
  - Con --project: arranca API real + Vite en puertos libres, precarga el .pulso y captura la ruta.
  - Si pasas --url: usa un frontend existente; con --project abre el .pulso por API y siembra el sid en Playwright.

Opciones:
  --route PATH              Ruta a capturar. Puede repetirse.
  --ir CLAVE                Navega a una dirección canónica (modulo/modo/seccion/pestana).
                            Preferente sobre --click-tab. Puede repetirse.
  --viewport WIDTHxHEIGHT   Viewport a capturar. Puede repetirse.
  --matrix                  Usa /carga, /validacion, /codificacion, /analitica y la matriz desktop.
  --layout-preset NAME      auto, large, portable, portable-compact, compact o short.
  --project PATH            Proyecto .pulso real para reproducir problemas con datos específicos.
  --api auto|stub|real      Default auto: stub sin proyecto, real con proyecto.
  --out DIR                 Carpeta de reporte. Default: tmp/visual-qa/quick/<timestamp>.
  --click-tab TEXT          Hace click en una pestaña/control antes de capturar. Puede repetirse.
  --sembrar TEXT            Pulsa un control que CONSTRUYE estado y tolera que ya no
                            esté (la sesión es una sola para toda la matriz, así que
                            solo existe en la primera captura). Ej: "Cargar fuente"
                            en Dashboard. Puede repetirse.
                            OJO: el puente de readiness dice que la vista montó, no
                            que su contenido asíncrono terminó de pintarse. Si la
                            superficie sembrada trae gráficos, acompáñalo de
                            --post-click-wait-selector ".js-plotly-plot" o la captura
                            sale con los títulos y sin las figuras.
                            --wait-selector NO sirve: se evalúa ANTES de sembrar.
  --wait-after-click-selector CSS
                              Selector opcional a esperar después de cada click.
  --post-click-wait-selector CSS
                              Selector que debe existir después de los clicks.
  --headed                  Abre navegador visible de Playwright.
  --keep-servers            Deja los servidores levantados al terminar.
  --fail-on-issues          Sale con código 1 si hay overflow/clipping/errores detectados.
  --full-page               Además de la captura del viewport, guarda captura full page.
  --focused-warmup          Carga solo warmups asociados a las rutas capturadas (default).
  --full-warmup             Usa el warmup global completo de la app.
  --prefetch-route-data     Hace prefetch best-effort del reporte de la ruta antes de abrirla.
  --geometry-group CONTRACT::CSS
                            Audita hijos visibles de un grupo. CONTRACT: equal o intrinsic.
                            Puede repetirse; también descubre [data-qa-geometry-group].
  --geometry-tolerance PX  Diferencia máxima entre marcos equivalentes. Default: 2.
  --require-geometry       Exige cobertura: falla sin mediciones o ante colecciones
                           hermanas visibles sin contrato geométrico declarado.
  --sin-popovers           Apaga el barrido de superficies que solo existen tras un
                           click. Por defecto está ENCENDIDO: el runner abre cada
                           disparador visible que declare [aria-haspopup] o
                           [aria-expanded], mide su desborde con el mismo detector
                           de la vista en reposo y lo devuelve a su estado. Sin él,
                           un popover nunca llega a medirse: la vista quieta sale
                           verde y el desborde vive en el menú que nadie abrió.

El reporte marca scrollJails cuando un contenedor de layout tiene contenido
vertical inaccesible por falta de scroll propio o ancestro scrollable. La
auditoría geométrica separa marco, contenido, capacidad interior y hueco
exterior; visualIssues=0 no sustituye esa evidencia. Los inputs visibles y
vacíos también miden su placeholder con la tipografía computada: si el texto no
cabe en el ancho útil, el reporte emite placeholder-clipped.
`);
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Viewport inválido: ${value}. Usa WIDTHxHEIGHT, por ejemplo 1366x768.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseGeometryGroup(value) {
  const raw = String(value || "").trim();
  const separator = raw.indexOf("::");
  const contract = separator >= 0 ? raw.slice(0, separator).trim() : "equal";
  const selector = separator >= 0 ? raw.slice(separator + 2).trim() : raw;
  if (!new Set(["equal", "intrinsic"]).has(contract)) {
    throw new Error(`Contrato geométrico inválido: ${contract}. Usa equal o intrinsic.`);
  }
  if (!selector) throw new Error("--geometry-group requiere un selector CSS.");
  return { contract, selector };
}

function normalizeRoute(value) {
  const route = String(value || "").trim();
  if (!route) return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  return url.toString();
}

function dedupe(items) {
  return Array.from(new Set(items));
}

function dedupeViewports(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.width}x${item.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function viewportName(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function safeSlug(value) {
  return String(value)
    .replace(/^\//, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "root";
}

async function fileExists(value) {
  try {
    await fsp.access(value, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findFreePort(preferred, attempts = 80) {
  for (let port = preferred; port < preferred + attempts; port += 1) {
    if (await isFreePort(port)) return port;
  }
  throw new Error(`No encontré puerto libre desde ${preferred}.`);
}

function isFreePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function spawnLogged(command, args, { cwd, env, logPath, name }) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stream = fs.createWriteStream(logPath, { flags: "a" });
  const recent = [];
  const record = (chunk) => {
    const text = chunk.toString();
    stream.write(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      recent.push(line);
      if (recent.length > 40) recent.shift();
    }
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  child.on("exit", (code, signal) => {
    stream.write(`\n[${name}] exit code=${code ?? ""} signal=${signal ?? ""}\n`);
    stream.end();
  });
  child.recentLog = recent;
  child.logPath = logPath;
  child.processName = name;
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolve();
    }, 2500);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForHttp(url, { timeoutMs, label, expectJson = false }) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        if (!expectJson) return res;
        await res.clone().json();
        return res;
      }
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timeout esperando ${label}: ${url} (${lastError})`);
}

async function apiRequest(base, endpoint, { method = "GET", session = "", body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = new URL(endpoint, base.endsWith("/") ? base : `${base}/`);
  const headers = {};
  if (session) headers["X-Pulso-Session"] = session;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    json,
    text,
  };
}

function stringOrEmpty(value) {
  return typeof value === "string" && value.length > 0 ? value : "";
}

export async function startStack(opts, logDir) {
  const started = {
    frontend: null,
    api: null,
    frontendPort: null,
    apiPort: null,
    url: opts.url || "",
    apiUrl: opts.apiUrl || "",
    session: "",
    projectStatus: null,
  };

  if (opts.urlProvided) {
    console.log(`[ui-quick-check] usando frontend existente: ${opts.url}`);
    started.url = opts.url;
    started.apiUrl = opts.apiUrl || new URL(opts.url).origin;
    if (opts.project) {
      console.log(`[ui-quick-check] abriendo proyecto en API existente: ${opts.project}`);
      const setup = await openProjectIntoApi(started.apiUrl, opts.project, opts.timeoutMs);
      started.session = setup.session;
      started.projectStatus = setup.projectStatus;
    }
    return started;
  }

  if (opts.api === "real") {
    started.apiPort = await findFreePort(opts.apiPort);
    started.apiUrl = `http://127.0.0.1:${started.apiPort}`;
    console.log(`[ui-quick-check] iniciando API real en ${started.apiUrl}`);
    started.api = spawnLogged("Rscript", ["launcher/launch.R"], {
      cwd: REPO_ROOT,
      name: "api",
      logPath: path.join(logDir, "api.log"),
      env: {
        ...process.env,
        PULSO_HOST: "127.0.0.1",
        PULSO_PORT: String(started.apiPort),
        PULSO_OPEN_BROWSER: "false",
        PULSO_BOOTSTRAP_PROJECT: opts.project || "",
      },
    });
    await waitForHttp(`${started.apiUrl}/api/system/health`, {
      timeoutMs: opts.timeoutMs,
      label: "API Prosecnur",
      expectJson: true,
    });
    if (opts.project) {
      console.log(`[ui-quick-check] cargando proyecto: ${opts.project}`);
      const setup = await takeBootstrapSession(started.apiUrl, opts.timeoutMs);
      started.session = setup.session;
      started.projectStatus = setup.projectStatus;
    }
  }

  started.frontendPort = await findFreePort(opts.frontendPort);
  started.url = `http://127.0.0.1:${started.frontendPort}/`;
  console.log(`[ui-quick-check] iniciando Vite en ${started.url}`);
  const viteBin = path.join(FRONTEND_DIR, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
  const hasViteBin = await fileExists(viteBin);
  const viteCommand = hasViteBin ? viteBin : "npm";
  const viteArgs = hasViteBin
    ? ["--host", "127.0.0.1", "--port", String(started.frontendPort), "--strictPort", "--clearScreen", "false"]
    : ["exec", "--", "vite", "--host", "127.0.0.1", "--port", String(started.frontendPort), "--strictPort", "--clearScreen", "false"];
  started.frontend = spawnLogged(viteCommand, viteArgs, {
    cwd: FRONTEND_DIR,
    name: "vite",
    logPath: path.join(logDir, "vite.log"),
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_DEV_PORT: String(started.frontendPort),
      PULSO_PORT: String(started.apiPort || opts.apiPort),
      VITE_API_PROXY_TARGET: started.apiUrl || process.env.VITE_API_PROXY_TARGET || "",
    },
  });
  await waitForHttp(started.url, {
    timeoutMs: opts.timeoutMs,
    label: "Vite",
  });
  console.log("[ui-quick-check] stack listo");
  return started;
}

export async function stopStack(stack) {
  await stopProcess(stack?.frontend);
  await stopProcess(stack?.api);
}

async function takeBootstrapSession(apiUrl, timeoutMs) {
  const bootstrap = await apiRequest(apiUrl, "/api/system/bootstrap", { timeoutMs });
  const session = stringOrEmpty(bootstrap.json?.sid);
  if (!session) {
    throw new Error("La API arrancó con proyecto, pero /api/system/bootstrap no devolvió sid.");
  }
  const projectStatus = await apiRequest(apiUrl, "/api/project/status", { session, timeoutMs }).catch((error) => ({
    ok: false,
    error: String(error?.message || error),
  }));
  return { session, projectStatus };
}

async function openProjectIntoApi(apiUrl, project, timeoutMs) {
  await waitForHttp(`${apiUrl}/api/system/health`, {
    timeoutMs,
    label: "API existente",
    expectJson: true,
  });
  let session = "";
  const bootstrap = await apiRequest(apiUrl, "/api/system/bootstrap", { timeoutMs }).catch(() => null);
  session = stringOrEmpty(bootstrap?.json?.sid);
  if (!session) {
    const created = await apiRequest(apiUrl, "/api/session?fresh=1", { method: "POST", timeoutMs });
    session = stringOrEmpty(created.headers["x-pulso-session"]) || stringOrEmpty(created.json?.session_id);
  }
  const opened = await apiRequest(apiUrl, "/api/project/open", {
    method: "POST",
    session,
    body: { path: project, in_place: true },
    timeoutMs,
  });
  if (!opened.ok) {
    throw new Error(`No se pudo abrir el .pulso en la API existente: HTTP ${opened.status} ${opened.text || ""}`);
  }
  session = stringOrEmpty(opened.headers["x-pulso-session"]) || stringOrEmpty(opened.json?.session_id) || session;
  const projectStatus = await apiRequest(apiUrl, "/api/project/status", { session, timeoutMs }).catch((error) => ({
    ok: false,
    error: String(error?.message || error),
  }));
  return { session, projectStatus };
}

async function installStubApi(context) {
  let calcMuestraState = stubCalcMuestraState();
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname;
    if (!endpoint.startsWith("/api/")) {
      return route.continue();
    }
    const fulfillJson = (json, status = 200, headers = {}) => route.fulfill({
      status,
      contentType: "application/json",
      headers,
      body: JSON.stringify(json),
    });
    const requestJson = async () => {
      const raw = request.postData() || "{}";
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    };

    if (endpoint === "/api/system/health") {
      return fulfillJson({ ok: true, version: "ui-quick-check", prosecnur_version: "stub", time: new Date().toISOString() });
    }
    if (endpoint === "/api/system/bootstrap") {
      return fulfillJson({ sid: null });
    }
    if (endpoint === "/api/session" || endpoint === "/api/session/") {
      return fulfillJson({ session_id: "ui-quick-check", reused: false }, 200, { "X-Pulso-Session": "ui-quick-check" });
    }
    if (endpoint === "/api/session/state") {
      return fulfillJson(stubSessionState());
    }
    if (endpoint === "/api/project/status") {
      return fulfillJson({ has_project: false, path: null, name: null, dirty: false, last_saved_at: null });
    }
    if (endpoint === "/api/estudio") {
      return fulfillJson({ has_estudio: false, nombre: null, bases: [], active_base: null, processing_mode: null });
    }
    if (endpoint === "/api/calc-muestra/state") {
      return fulfillJson(calcMuestraState);
    }
    if (endpoint === "/api/calc-muestra/iniciar-estudio") {
      const body = await requestJson();
      calcMuestraState = stubCalcMuestraState(body.tipo || "estudio_propio", body.variante || "vacio");
      return fulfillJson({ ok: true, estudio: calcMuestraState.estudio, state: calcMuestraState, demo_warning: null });
    }
    if (endpoint === "/api/calc-muestra/estudio") {
      const body = await requestJson();
      calcMuestraState = {
        ...calcMuestraState,
        estudio: normalizeStubCalcMuestraStudy(body.estudio || body || calcMuestraState.estudio),
        reporte: { disponible: false },
      };
      return fulfillJson({ ok: true, estudio: calcMuestraState.estudio });
    }
    if (endpoint === "/api/calc-muestra/calcular") {
      calcMuestraState = {
        ...calcMuestraState,
        estudio: stubCalcMuestraCalculatedStudy(calcMuestraState.estudio),
        reporte: { disponible: false },
      };
      return fulfillJson({ ok: true, estudio: calcMuestraState.estudio });
    }
    if (endpoint === "/api/codificacion/source") {
      return fulfillJson({ source: null, available: [] });
    }
    return fulfillJson({
      error: {
        code: "UI_QA_STUB",
        message: `Endpoint simulado no implementado en ui-quick-check: ${endpoint}`,
      },
    }, 404);
  });
}

function stubCalcMuestraState(tipo = "estudio_propio", variante = "vacio") {
  const macro = tipo === "hsvg_universitario" ? "encuesta_estudiantes" : tipo;
  const estudio = normalizeStubCalcMuestraStudy({
    id: "ui-quick-check-calc-muestra",
    titulo: macro === "encuesta_estudiantes" ? "Encuesta a estudiantes" : "Estudio sin titulo",
    macro_familia: macro,
    componentes: macro === "encuesta_estudiantes" && variante === "plantilla_pucp"
      ? stubCalcMuestraUniversityComponents(true)
      : [],
  });
  return {
    estudio,
    aulas: {
      config: stubCalcMuestraAulasConfig(),
      frame: null,
      selection: null,
      method_comparison: null,
      replacement_simulation: null,
      export: null,
    },
    reporte: { disponible: false },
  };
}

function normalizeStubCalcMuestraStudy(input = {}) {
  return {
    version: Number(input.version || 1),
    id: stringOrEmpty(input.id) || "ui-quick-check-calc-muestra",
    titulo: stringOrEmpty(input.titulo) || "Estudio sin titulo",
    fecha_creacion: input.fecha_creacion || new Date().toISOString(),
    modo_trabajo: input.modo_trabajo || "estimacion_preliminar",
    macro_familia: input.macro_familia || "estudio_propio",
    modo_sensible: Boolean(input.modo_sensible),
    contexto: {
      cliente: stringOrEmpty(input.contexto?.cliente),
      tipo_cliente: stringOrEmpty(input.contexto?.tipo_cliente),
      descripcion_libre: stringOrEmpty(input.contexto?.descripcion_libre),
    },
    componentes: Array.isArray(input.componentes) ? input.componentes : [],
    workspace: input.workspace ?? null,
    decision_log: input.decision_log,
    computado_at: input.computado_at,
  };
}

function stubCalcMuestraUniversityComponents(withFrame = false) {
  const estratos = withFrame
    ? [
        { id: "fac-1", label: "Arquitectura", N: 1200, N_a: 620, N_b: 580, n: 0 },
        { id: "fac-2", label: "Ciencias Sociales", N: 1800, N_a: 980, N_b: 820, n: 0 },
        { id: "fac-3", label: "Ingenieria", N: 2400, N_a: 880, N_b: 1520, n: 0 },
      ]
    : [];
  const marcoValidado = estratos.reduce((sum, row) => sum + Number(row.N || 0), 0);
  return [
    stubCalcMuestraComponent({
      id: "cmp-ui-universidad",
      actor: "Muestra con representatividad a nivel universidad",
      actor_id: "estudiantes_universidad",
      tecnica: "prob_conglomerado_multietapico",
      canal_recojo: "aula_qr",
      marco: { marco_validado: marcoValidado, universo_bruto: marcoValidado, marco_contactable: marcoValidado, estado: withFrame ? "validado" : "bruto", estratos },
    }),
    stubCalcMuestraComponent({
      id: "cmp-ui-facultad",
      actor: "Muestra con representatividad a nivel facultad",
      actor_id: "estudiantes_facultad",
      tecnica: "prob_estratificado_independiente",
      canal_recojo: "aula_qr",
      marco: { marco_validado: marcoValidado, universo_bruto: marcoValidado, marco_contactable: marcoValidado, estado: withFrame ? "validado" : "bruto", estratos },
    }),
  ];
}

function stubCalcMuestraComponent(overrides = {}) {
  const tecnica = overrides.tecnica || "prob_aleatorio_simple";
  return {
    id: overrides.id || "cmp-ui",
    actor: overrides.actor || "Poblacion objetivo",
    actor_id: overrides.actor_id || "poblacion_objetivo",
    actor_categoria: overrides.actor_categoria || "otros",
    canal_recojo: overrides.canal_recojo || "presencial",
    tecnica,
    naturaleza: tecnica.startsWith("prob_") || tecnica === "sistematico" ? "prob" : "operativo",
    origen_tamano: "formula",
    nivel_respaldo: tecnica.startsWith("prob_") ? "representatividad_estadistica" : "evidencia_descriptiva",
    marco: {
      universo_bruto: 0,
      marco_validado: 0,
      marco_contactable: 0,
      estado: "no_definido",
      notas: "",
      estratos: [],
      matriz_operativa: [],
      ...(overrides.marco || {}),
    },
    parametros: {
      z: 1.96,
      p: 0.5,
      e: 0.05,
      deff: 1,
      tasa_respuesta: 0.7,
      oversample_pct: 0.2,
      cobertura_objetivo: 0.6,
      promedio_conglomerado: 25,
      n_minimo_estrato: 30,
      tope_operativo: 150,
      ...(overrides.parametros || {}),
    },
    meta: {
      tipo: "objetivo",
      valor: 0,
      variable_control: "",
      sub_cuotas: {},
      ...(overrides.meta || {}),
    },
    resultado: overrides.resultado ?? null,
  };
}

function stubCalcMuestraCalculatedStudy(studyInput = {}) {
  const study = normalizeStubCalcMuestraStudy(studyInput);
  const componentes = (study.componentes || []).map((comp, index) => {
    const marcoValidado = Number(comp?.marco?.marco_validado || comp?.marco?.universo_bruto || 6000);
    const nObjetivo = Number(comp?.meta?.valor || (index === 0 ? 500 : 1200));
    const oversamplePct = Number(comp?.parametros?.oversample_pct ?? 0.2);
    const aulasBase = Math.max(1, Math.ceil(nObjetivo / Number(comp?.parametros?.promedio_conglomerado || 25)));
    return {
      ...comp,
      marco: {
        ...comp.marco,
        universo_bruto: marcoValidado,
        marco_validado: marcoValidado,
        marco_contactable: marcoValidado,
        estado: "validado",
      },
      resultado: {
        n_teorico: Math.round(nObjetivo * 0.92),
        n_objetivo: nObjetivo,
        n_operativo: Math.ceil(nObjetivo * (1 + oversamplePct)),
        precision_alcanzada: Number(comp?.parametros?.e || 0.05),
        sobremuestra: Math.ceil(nObjetivo * oversamplePct),
        origen_tamano: comp.origen_tamano || "formula",
        tecnica: comp.tecnica || "prob_aleatorio_simple",
        computado_at: new Date().toISOString(),
        inferencia: { permitido: true, motivos: null },
        distribucion_estratos: Array.isArray(comp?.marco?.estratos)
          ? comp.marco.estratos.map((row) => ({
              estrato: row.label || row.estrato || "Estrato",
              N: Number(row.N || 0),
              n: Math.max(0, Math.round((Number(row.N || 0) / Math.max(1, marcoValidado)) * nObjetivo)),
            }))
          : [],
        aulas_base_total: aulasBase,
        aulas_total: aulasBase + 8,
        aulas_extra_total: 8,
      },
    };
  });
  return {
    ...study,
    componentes,
    computado_at: new Date().toISOString(),
  };
}

function stubCalcMuestraAulasConfig() {
  return {
    schema: "calc_muestra_workspace_aulas_v1",
    modalidad: "presencial_aula",
    selector: "cube_balanceado",
    selector_engine: "cube_balanceado",
    method_family: "balanced_probability",
    min_elegibles_aula: 15,
    usar_grupos_tamano: true,
    grupos_tamano: [
      { id: "G1", label: "G1", min: 15, max: 20, descripcion: "aulas pequenas" },
      { id: "G2", label: "G2", min: 21, max: 30, descripcion: "aulas medianas" },
      { id: "G3", label: "G3", min: 31, max: 40, descripcion: "aulas estandar" },
      { id: "G4", label: "G4", min: 41, max: null, descripcion: "aulas grandes" },
    ],
    estratos_selector: ["faculty", "sex_top_1", "size_group"],
    balance_vars: ["faculty", "program", "level", "schedule", "sex"],
    spread_vars: ["program", "level", "schedule"],
    candidate_pool_size: 500,
    simulation_runs: 500,
    mos_strategy: "eligible_students_winsorized",
    coordination_mode: "m1_plus_reserve_waves",
    bolsas_reemplazo: 2,
    aulas_extra_operativas_default: 1,
    penalizacion_repetidos: 0.35,
    pps_weight: 0.45,
    coverage_weight: 0.55,
    monte_carlo_n: 500,
    semilla: 20260619,
    objective: {
      schema: "calc_muestra_aulas_representativity_objective_v1",
      primary_unit: "estudiantes_unicos_elegibles",
      variables: [
        { dimension: "faculty", label: "Facultad", aula_col: "faculty", student_col: "faculty", weight: 0.18, tolerance: 0.025, source_preference: "student" },
        { dimension: "sex", label: "Sexo", aula_col: "sex_top_1", student_col: "sex", weight: 0.1, tolerance: 0.025, source_preference: "student" },
      ],
    },
  };
}

function stubSessionState() {
  return {
    session_id: "ui-quick-check",
    created_at: new Date().toISOString(),
    xlsform: false,
    data: false,
    instrumento_parsed: false,
    data_previewed: false,
    plan_built: false,
    auditoria_run: false,
    codif_familias_generated: false,
    codif_familias_loaded: false,
    codif_plantilla_template: false,
    codif_plantilla_codigos_loaded: false,
    codif_aplicado: false,
    analitica_prep_ok: false,
    analitica_codebook_ok: false,
    analitica_frecuencias_ok: false,
    analitica_cruces_ok: false,
    analitica_spss_ok: false,
    analitica_enumeradores_ok: false,
    analitica_dim_ok: false,
    analitica_multibase_available: false,
    analitica_multibase_ok: false,
    analitica_fuente: null,
    analitica_fuente_detalle: null,
    hojas_ruta_ok: false,
    graficos_ppt_ok: false,
    graficos_word_ok: false,
    estudio_nombre: null,
    has_estudio: false,
    estudio_processing_mode: null,
    active_base: null,
    n_bases: 0,
    bases_nombres: [],
  };
}

function routeUrl(base, route, project = "") {
  // `route` puede incluir los niveles direccionables de la app en query
  // (`/carga?pestana=fuentes`). Asignarlo a `pathname` escapa el `?` como
  // `%3F` y termina visitando una ruta inexistente; resolverlo como URL
  // conserva pathname, search y hash por separado.
  const url = new URL(route, base);
  if (project) url.searchParams.set("devPulso", project);
  return url.toString();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function warmupModuleIdsForRoutes(routes) {
  const ids = new Set(["home"]);
  for (const route of routes) {
    const normalized = normalizeRoute(route).replace(/\/+$/, "") || "/";
    if (normalized === "/" || normalized === "/home") {
      ids.add("home");
    } else if (normalized === "/procesamiento") {
      ids.add("procesamiento");
    } else if (normalized.startsWith("/carga")) {
      ids.add("carga");
    } else if (normalized.startsWith("/validacion")) {
      ids.add("validacion");
    } else if (normalized.startsWith("/codificacion")) {
      ids.add("codificacion");
    } else if (normalized.startsWith("/analitica")) {
      ids.add("analitica");
    } else if (normalized.startsWith("/graficos")) {
      ids.add("graficos");
      ids.add("graficos_datos");
      ids.add("plotly");
      ids.add("html_to_image");
    } else if (normalized.startsWith("/hojas-ruta")) {
      ids.add("hojas_ruta");
      ids.add("hojas_ruta_datos");
    } else if (normalized.startsWith("/calc-muestra")) {
      ids.add("calc_muestra");
    } else if (normalized.startsWith("/muestra")) {
      ids.add("muestra");
    } else if (normalized.startsWith("/monitoreo")) {
      ids.add("monitoreo");
    // Las rutas canónicas son `/tablero` y `/editor-xlsform` (ver el router en
    // `app/`): no existe ni `/dashboard` ni `/xlsform`. Ambas ramas estaban
    // escritas contra nombres que nunca llegan, así que sus módulos jamás
    // calentaban y las dos rutas se capturaban solo con el warmup de `home`.
    } else if (normalized.startsWith("/tablero")) {
      ids.add("dashboard");
      ids.add("dashboard_datos");
      ids.add("html_to_image");
    } else if (normalized.startsWith("/editor-xlsform")) {
      ids.add("editor_xlsform");
    } else if (normalized.startsWith("/enciclopedia")) {
      ids.add("enciclopedia");
    }
  }
  return Array.from(ids);
}

function monitoreoReportScopeForClickTabs(clickTabs = []) {
  const labels = clickTabs.map((value) => String(value || "").toLowerCase());
  if (labels.some((label) => label.includes("teléfono") || label.includes("telefono") || label.includes("llamada"))) {
    return "phone_summary";
  }
  if (labels.some((label) => label.includes("validaci") || label.includes("geolocal") || label.includes("gps"))) {
    return "validation_summary";
  }
  if (labels.some((label) => label.includes("reconcili") || label.includes("explorador") || label.includes("consulta"))) {
    return "queries_summary";
  }
  if (labels.some((label) => label.includes("avance") || label.includes("actor") || label.includes("encuesta"))) {
    return "advance_summary";
  }
  if (labels.some((label) => label.includes("fuentes") || label.includes("recopil"))) {
    return "source";
  }
  return "source";
}

async function prefetchRouteDataForQa(stack, route, timeoutMs, clickTabs = []) {
  if (!stack?.apiUrl || !stack?.session) return;
  const normalized = normalizeRoute(route).replace(/\/+$/, "") || "/";
  if (normalized.startsWith("/monitoreo")) {
    const reportScope = monitoreoReportScopeForClickTabs(clickTabs);
    console.log(`[ui-quick-check] prefetch ${normalized} report_scope=${reportScope}`);
    const scopeDefaultTimeout = HEAVY_MONITOREO_SCOPES.has(reportScope) ? DEFAULT_PREFETCH_TIMEOUT_MS : 12000;
    const prefetchTimeoutMs = Math.min(timeoutMs, scopeDefaultTimeout);
    const prefetched = await apiRequest(
      stack.apiUrl,
      `/api/monitoreo/state?include_reports=1&report_scope=${encodeURIComponent(reportScope)}`,
      { session: stack.session, timeoutMs: prefetchTimeoutMs },
    ).catch((error) => ({ ok: false, status: "timeout", error: error?.message || String(error) }));
    if (!prefetched.ok) {
      console.log(`[ui-quick-check] prefetch omitido: ${prefetched.status || "error"}`);
    }
  }
  // `/carga` publica readiness solo cuando llegó el payload de `/api/estudio`,
  // que la página pide ON DEMAND al entrar en modo multi-base. En la PRIMERA
  // captura de una corrida ese pedido llega frío y a veces excede la ventana de
  // readiness: es el `waitSelectorMiss` intermitente de la matriz, que aislado
  // no reproduce. Calentarlo acá es lo mismo que ya se hace con Monitoreo.
  if (normalized.startsWith("/carga")) {
    console.log(`[ui-quick-check] prefetch ${normalized} estudio`);
    const prefetched = await apiRequest(
      stack.apiUrl,
      "/api/estudio",
      { session: stack.session, timeoutMs: Math.min(timeoutMs, 12000) },
    ).catch((error) => ({ ok: false, status: "timeout", error: error?.message || String(error) }));
    if (!prefetched.ok) {
      console.log(`[ui-quick-check] prefetch omitido: ${prefetched.status || "error"}`);
    }
  }
}

// Navegación por DIRECCIÓN canónica (`modulo/modo/seccion/pestana#panel`).
// Preferente sobre el click por etiqueta, que depende del texto visible.
// Contrato: frontend/src/lib/navegacion/direccion.ts
async function cederRenderDeTransicion(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function capturarVistaAsentada(page, { screenshot, fullScreenshot }) {
  // Playwright lleva las animaciones finitas a su estado final antes de cada
  // captura. Ese estado no se revierte, de modo que inspectDom observa después
  // la misma geometría que quedó en el PNG. Las animaciones infinitas se
  // cancelan temporalmente al estado inicial y luego se reanudan: no intentamos
  // esperarlas ni inventar un timeout.
  await page.screenshot({ path: screenshot, animations: "disabled" });
  if (fullScreenshot) {
    await page.screenshot({ path: fullScreenshot, fullPage: true, animations: "disabled" });
  }
}

async function irADireccion(page, destino, timeoutMs) {
  const resultado = await page.evaluate((clave) => {
    const nav = window.__pulsoNav;
    if (!nav) return "sin-puente";
    return nav.ir(clave) ? "ok" : "sin-nodo";
  }, destino);

  if (resultado === "sin-puente") {
    throw new Error(
      "No hay puente de navegación (window.__pulsoNav). Solo se instala en dev o con ?qaWarmup=skip.",
    );
  }
  if (resultado === "sin-nodo") {
    const disponibles = await page.evaluate(() =>
      (window.__pulsoNav?.manifiesto ?? []).map((nodo) => nodo.clave),
    );
    throw new Error(
      `La dirección "${destino}" no existe en el manifiesto. Disponibles: ${disponibles.join(", ")}`,
    );
  }

  await cederRenderDeTransicion(page);
  const readiness = await esperarListo(page, timeoutMs);
  if (!readiness?.listo) {
    throw new Error(
      `La dirección "${destino}" no alcanzó readiness final: ${readiness?.motivo || "estado desconocido"}.`,
    );
  }
}

// Readiness preguntada a la app, no adivinada con sleeps.
async function esperarListo(page, timeoutMs) {
  const limite = Date.now() + timeoutMs;
  let ultimo = null;
  while (Date.now() < limite) {
    const estado = await page.evaluate(() => {
      const nav = window.__pulsoNav;
      if (nav) return nav.listo();

      // Los fixtures aislados del inspector no montan la aplicación ni su
      // puente, pero sí declaran el mismo marcador verificable. Una shell real
      // sin puente todavía está arrancando y debe seguir esperando.
      const appShell = document.querySelector(".pulso-shell");
      const marker = document.querySelector("[data-audit-ready]");
      if (!appShell && marker) {
        const value = marker.getAttribute("data-audit-ready") ?? "";
        return value === "false"
          ? { listo: false, motivo: "marca-en-false", marca: value }
          : { listo: true, marca: value };
      }
      return null;
    });
    ultimo = estado ?? { listo: false, motivo: "sin-puente" };
    if (ultimo.listo) return ultimo;
    await page.waitForTimeout(250);
  }
  return ultimo ?? { listo: false, motivo: "timeout" };
}

// Devuelve `true` si pulsó. Con `opcional`, un control ausente no es error:
// devuelve `false` y deja seguir. Sin `opcional`, lanza como siempre.
async function clickNamedControl(page, label, timeoutMs, { opcional = false } = {}) {
  const pattern = new RegExp(escapeRegExp(label), "i");
  const startsWithPattern = new RegExp(`^\\s*${escapeRegExp(label)}(?:\\s|$)`, "i");
  const clickTimeout = Math.min(timeoutMs, DEFAULT_CLICK_TIMEOUT_MS);
  const candidates = [
    page.getByRole("tab", { name: startsWithPattern }).first(),
    page.getByRole("link", { name: startsWithPattern }).first(),
    page.locator("button").filter({ hasText: pattern }).first(),
    page.getByRole("button", { name: startsWithPattern }).first(),
    page.getByText(pattern).last(),
  ];
  let lastError = null;
  for (const locator of candidates) {
    try {
      await locator.click({ timeout: clickTimeout });
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  if (opcional) return false;
  throw lastError ?? new Error(`No se pudo hacer click en "${label}".`);
}

async function runCaptures(opts, stack) {
  const browser = await chromium.launch({ headless: !opts.headed });
  const results = [];
  const focusedWarmupModuleIds = opts.focusedWarmup ? warmupModuleIdsForRoutes(opts.routes) : [];
  try {
    for (const viewport of opts.viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(({ layoutPreset, session, focusedWarmup, warmupModuleIds }) => {
        window.localStorage.setItem("pulso.layoutPreset", layoutPreset);
        if (session) window.localStorage.setItem("pulso.sessionId", session);
        if (focusedWarmup) {
          window.localStorage.setItem("pulso.visualQaWarmup", "1");
          window.localStorage.setItem("pulso.visualQaWarmupModuleIds", warmupModuleIds.join(","));
          window.localStorage.setItem("pulso.visualQaSkipBackendWarmup", "1");
        } else {
          window.localStorage.removeItem("pulso.visualQaWarmup");
          window.localStorage.removeItem("pulso.visualQaWarmupModuleIds");
          window.localStorage.removeItem("pulso.visualQaSkipBackendWarmup");
        }
      }, {
        layoutPreset: opts.layoutPreset,
        session: stack.session || "",
        focusedWarmup: opts.focusedWarmup,
        warmupModuleIds: focusedWarmupModuleIds,
      });
      if (opts.api === "stub") await installStubApi(context);

      for (const route of opts.routes) {
        if (opts.api === "real" && opts.prefetchRouteData) {
          await prefetchRouteDataForQa(stack, route, opts.timeoutMs, opts.clickTabs);
        }
        const page = await context.newPage();
        const consoleMessages = [];
        const pageErrors = [];
        const apiErrors = [];
        const resourceErrors = [];
        page.on("console", (message) => {
          if (!["error", "warning"].includes(message.type())) return;
          const text = message.text();
          if (/React Router Future Flag Warning/.test(text)) return;
          consoleMessages.push({ type: message.type(), text: text.slice(0, 600) });
        });
        page.on("pageerror", (error) => {
          pageErrors.push(String(error?.message || error).slice(0, 800));
        });
        page.on("response", (response) => {
          const responseUrl = response.url();
          const pathname = new URL(responseUrl).pathname;
          if (pathname.startsWith("/api/") && response.status() >= 400) {
            apiErrors.push({ status: response.status(), url: responseUrl });
          } else if (response.status() >= 400) {
            resourceErrors.push({ status: response.status(), url: responseUrl });
          }
        });

        const target = routeUrl(stack.url, route, stack.session ? "" : (opts.project || ""));
        console.log(`[ui-quick-check] capturando ${target} @ ${viewportName(viewport)} preset=${opts.layoutPreset}`);
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
        await page.waitForLoadState("networkidle", { timeout: Math.min(5000, opts.timeoutMs) }).catch(() => {});
        let waitSelectorMatched = true;
        if (opts.waitSelector) {
          await page.locator(opts.waitSelector).first().waitFor({ state: "attached", timeout: opts.timeoutMs }).catch(() => {
            waitSelectorMatched = false;
          });
        }
        for (const destino of opts.direcciones) {
          await irADireccion(page, destino, opts.timeoutMs);
        }
        // Siembra: pulsa el control que construye estado —«Cargar fuente» en
        // Dashboard, por ejemplo— y **tolera que ya no esté**. La sesión es una
        // sola para toda la matriz, así que el control existe en la primera
        // captura y desaparece en las cuatro siguientes, cuando el estado ya
        // quedó sembrado. Por eso no comparte camino con `--click-tab`, donde
        // un control ausente sí es un fallo que hay que ver.
        for (const semilla of opts.sembrar) {
          const sembrado = await clickNamedControl(page, semilla, opts.timeoutMs, { opcional: true });
          if (sembrado) {
            await cederRenderDeTransicion(page);
            await esperarListo(page, opts.timeoutMs);
          }
        }
        for (const tab of opts.clickTabs) {
          // Un `--click-tab` que cambia de módulo no es un click en pestaña: es
          // el matcher pescando otra cosa. Pasó de verdad —`--click-tab "Hojas"`
          // en el editor de formularios cazó «Hojas de ruta» del rail de
          // módulos— y la corrida siguió, midió la pantalla equivocada y
          // reportó `ok=true`. Un falso verde vale menos que un rojo: si el
          // pathname cambia, se corta.
          const rutaAntes = new URL(page.url()).pathname;
          await clickNamedControl(page, tab, opts.timeoutMs);
          await cederRenderDeTransicion(page);
          const rutaDespues = new URL(page.url()).pathname;
          if (rutaDespues !== rutaAntes) {
            throw new Error(
              `El click en "${tab}" cambió de ruta (${rutaAntes} → ${rutaDespues}). ` +
              "Eso no es una pestaña: el texto colisiona con un destino de navegación. " +
              "Usa --ir con la dirección canónica, o una etiqueta que no colisione.",
            );
          }
          const tabReadiness = await esperarListo(page, opts.timeoutMs);
          if (!tabReadiness?.listo) {
            throw new Error(
              `La pestaña "${tab}" no alcanzó readiness final: ${tabReadiness?.motivo || "estado desconocido"}.`,
            );
          }
          if (opts.waitAfterClickSelector) {
            await page.locator(opts.waitAfterClickSelector).first().waitFor({ state: "attached", timeout: opts.timeoutMs }).catch(() => {});
          }
        }
        await cederRenderDeTransicion(page);
        const finalReadiness = await esperarListo(page, opts.timeoutMs);
        if (!finalReadiness?.listo) {
          throw new Error(
            `La ruta "${route}" no alcanzó readiness final antes de la captura: ${finalReadiness?.motivo || "estado desconocido"}.`,
          );
        }
        let postClickWaitSelectorMatched = true;
        if (opts.postClickWaitSelector) {
          await page.locator(opts.postClickWaitSelector).first().waitFor({ state: "attached", timeout: opts.timeoutMs }).catch(() => {
            postClickWaitSelectorMatched = false;
          });
        }

        const shotBase = `${opts.name}-${safeSlug(route)}-${viewportName(viewport)}-${opts.layoutPreset}`;
        const screenshot = path.join(opts.out, `${shotBase}.png`);
        const fullScreenshot = opts.fullPage ? path.join(opts.out, `${shotBase}-full.png`) : null;
        await capturarVistaAsentada(page, { screenshot, fullScreenshot });

        const dom = await inspectDom(page, {
          projectMode: Boolean(opts.project),
          geometryGroups: opts.geometryGroups,
          geometryTolerance: opts.geometryTolerance,
          requireGeometry: opts.requireGeometry,
        });
        // Después de medir la vista en reposo y con la captura ya tomada: abrir
        // popovers cambia la pantalla, así que el barrido va al final para no
        // contaminar el screenshot ni la geometría.
        const popovers = opts.barrerPopovers
          ? await barrerPopovers(page, { timeoutMs: opts.timeoutMs })
          : [];
        results.push({
          popovers,
          route,
          viewport,
          url: target,
          screenshot,
          fullScreenshot,
          consoleMessages,
          pageErrors,
          apiErrors,
          resourceErrors,
          waitSelectorMatched,
          postClickWaitSelectorMatched,
          ...dom,
        });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

export async function inspectDom(page, { projectMode, geometryGroups, geometryTolerance, requireGeometry, rootSelector = "" }) {
  return page.evaluate(async ({
    projectMode: wantsProject,
    geometryGroups: requestedGeometryGroups,
    geometryTolerance: geometryTolerancePx,
    requireGeometry: geometryRequired,
    rootSelector: alcance,
  }) => {
    const root = document.documentElement;
    const body = document.body;
    const text = body?.innerText || "";
    const hasEffectiveOpacity = (el) => {
      let current = el;
      while (current instanceof Element) {
        const opacity = Number.parseFloat(window.getComputedStyle(current).opacity);
        if (Number.isFinite(opacity) && opacity === 0) return false;
        const rootNode = current.getRootNode();
        current = current.parentElement || (rootNode instanceof ShadowRoot ? rootNode.host : null);
      }
      return true;
    };
    const selector = [
      "button",
      "input",
      "select",
      "textarea",
      "label",
      "th",
      "td",
      "h1",
      "h2",
      "h3",
      "[role='button']",
      "[role='tab']",
      ".pulso-adaptive-rail",
      ".pulso-adaptive-main",
      ".pulso-panel",
      "[class*='card']",
      "[class*='modal']",
      "[class*='popover']",
    ].join(",");
    // El carril icon-only muestra su etiqueta en una burbuja flotante (dec-sidebar-icon-tooltip):
    // un ::before position:absolute, pointer-events:none, que sale del botón a propósito y solo
    // existe en hover/focus. Playwright deja el cursor sobre el control que acaba de clickear, así
    // que al medir la burbuja está desplegada y scrollWidth la cuenta como desborde del botón. No
    // es contenido recortado, así que se ignora mientras el botón no clippee y su contenido en
    // flujo sí quepa dentro de la caja: si algún día la burbuja queda clippeada o el ícono se sale,
    // el issue vuelve a reportarse.
    const railTooltipEscape = (el, style) => {
      if (!el.hasAttribute("data-rail-tooltip")) return false;
      if (style.overflowX !== "visible" || style.overflowY !== "visible") return false;
      const bubble = window.getComputedStyle(el, "::before");
      if (bubble.display === "none" || bubble.position !== "absolute") return false;
      const box = el.getBoundingClientRect();
      const maxRight = box.left + el.clientLeft + el.clientWidth + 2;
      const maxBottom = box.top + el.clientTop + el.clientHeight + 2;
      return Array.from(el.children).every((child) => {
        const childStyle = window.getComputedStyle(child);
        if (childStyle.display === "none" || childStyle.visibility === "hidden") return true;
        if (["absolute", "fixed"].includes(childStyle.position)) return true;
        const childBox = child.getBoundingClientRect();
        return childBox.right <= maxRight && childBox.bottom <= maxBottom;
      });
    };
    // Con `rootSelector` la medición se acota a una superficie recién abierta
    // (un popover, un menú, un diálogo). Sin él mide el documento entero, que
    // es el caso de la vista en reposo. Acotar evita volver a reportar los
    // nodos de la vista de fondo una vez por cada disparador abierto.
    const raizMedicion = alcance ? document.querySelector(alcance) : null;
    if (alcance && !raizMedicion) {
      return { issues: [], controlTextMetrics: [], scrollJails: [], geometryAudits: [], geometryIssues: [], geometryCoverageMisses: [], alcanceAusente: true };
    }
    const ambito = raizMedicion || document;
    const issues = [];
    for (const el of Array.from(ambito.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 1
        && rect.height > 1
        && style.display !== "none"
        && style.visibility !== "hidden"
        && hasEffectiveOpacity(el);
      if (!visible) continue;
      const overflowXAllowed = ["auto", "scroll"].includes(style.overflowX);
      const overflowYAllowed = ["auto", "scroll"].includes(style.overflowY);
      // Un <select> nativo reporta el ancho de su opción más larga como
      // `scrollWidth`, aunque el control la recorte dentro de su caja. El label
      // que lo envuelve hereda la misma medición. No son desbordes de layout:
      // el overflow global y el rectángulo del control siguen detectando cuando
      // la caja realmente sale del viewport.
      const nativeSelectBox = el instanceof HTMLSelectElement
        || (el instanceof HTMLLabelElement && Boolean(el.querySelector("select")));
      // Un <input> DE ENTRADA DE TEXTO mide igual: `scrollWidth` es el ancho de
      // su VALOR, no de su caja, y el control lo recorta adentro
      // (overflow-x:clip) desplazándolo con el caret. Es el comportamiento
      // nativo del campo y no hay nada inalcanzable. Sin esta exclusión,
      // cualquier formulario que muestre un texto largo dentro de un campo
      // editable —el panel Datos de Analítica edita las etiquetas de pregunta,
      // que son oraciones enteras— sale rojo por diseño y no por defecto.
      //
      // La lista es por `type` y no `instanceof HTMLInputElement` a secas: un
      // input botón (button/submit/reset/image) NO tiene caret ni scroll
      // nativo, así que ahí un value recortado sí es contenido inalcanzable y
      // el detector tiene que seguir viéndolo (C4).
      //
      // El <label> que ENVUELVE al campo hereda la misma medición engañosa: su
      // `scrollWidth` lo fija el input de adentro, así que sin esta rama el
      // derrame se reportaba en el padre justo después de perdonarlo en el hijo.
      const textInputTypes = new Set([
        "text", "search", "url", "tel", "email", "password", "number",
      ]);
      const nativeTextBox = (el instanceof HTMLInputElement && textInputTypes.has(el.type))
        || (el instanceof HTMLLabelElement
          && Array.from(el.querySelectorAll("input")).some((field) => textInputTypes.has(field.type)));
      // `scrollWidth`/`clientWidth` son ENTEROS: en una caja de ancho
      // fraccionario el primero redondea hacia arriba y el segundo hacia
      // abajo, así que una caja perfectamente sana puede reportar unos píxeles
      // de diferencia sin que nada se salga. Cuando el elemento no recorta
      // (overflow-x visible), la pregunta real —¿el contenido escapa de la
      // caja?— se puede medir con precisión subpíxel sobre la tinta.
      //
      // Es un desempate, no un indulto: solo perdona cuando la tinta CABE.
      // Verificado contra los dos casos reales de acnur_acg — el badge de tipo
      // del editor (tinta hasta 621 dentro de una caja hasta 624: 0 px
      // perdidos, deja de reportarse) y el botón de opción de Codificación
      // (tinta hasta 731 contra una caja hasta 714: 13 px que sí se cortaban,
      // sigue reportándose).
      const inkFitsBox = () => {
        if (style.overflowX !== "visible") return false;
        try {
          const range = el.ownerDocument.createRange();
          range.selectNodeContents(el);
          const ink = range.getBoundingClientRect();
          range.detach?.();
          if (!ink || (ink.width === 0 && ink.height === 0)) return false;
          return ink.right <= rect.right + 0.5 && ink.left >= rect.left - 0.5;
        } catch {
          return false;
        }
      };
      // Un texto RECORTADO A PROPÓSITO con elipsis (`overflow:hidden` +
      // `text-overflow:ellipsis` + `white-space:nowrap`) mide igual que un
      // desborde: el `scrollWidth` es el del texto completo. La diferencia no
      // está en la medición sino en si el usuario puede llegar al texto que
      // falta. Por eso el perdón es CONDICIONAL a que el contenido siga
      // alcanzable —un `title` o `aria-label` que lo exponga entero, propio o
      // de un ancestro cercano—, que es justo lo que pide C4. Un recorte mudo
      // sigue siendo un hallazgo: el dato existe y no hay forma de leerlo.
      const elipsisAlcanzable = () => {
        if (style.textOverflow !== "ellipsis") return false;
        if (style.overflowX !== "hidden" && style.overflowX !== "clip") return false;
        const completo = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!completo) return false;
        const portador = el.closest("[title],[aria-label]");
        if (!portador) return false;
        const expuesto = (portador.getAttribute("title") || portador.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim();
        return expuesto.includes(completo);
      };
      const xOverflow = el.scrollWidth > el.clientWidth + 2 && !overflowXAllowed
        && !nativeSelectBox && !nativeTextBox && !inkFitsBox() && !elipsisAlcanzable();
      const yOverflow = el.scrollHeight > el.clientHeight + 2 && !overflowYAllowed;
      if (!xOverflow && !yOverflow) continue;
      if (railTooltipEscape(el, style)) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
      issues.push({
        type: xOverflow && yOverflow ? "overflow-both" : xOverflow ? "overflow-x" : "overflow-y",
        tag: el.tagName.toLowerCase(),
        className: String(el.getAttribute("class") || "").slice(0, 180),
        label,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        scroll: {
          width: el.scrollWidth,
          height: el.scrollHeight,
          clientWidth: el.clientWidth,
          clientHeight: el.clientHeight,
        },
      });
      if (issues.length >= 80) break;
    }

    // Una superficie efímera se mide por su desborde y nada más: el scroll jail,
    // la geometría de colecciones y los rectángulos de layout son preguntas
    // sobre el marco de la vista, y ese ya se auditó en reposo.
    if (alcance) return { issues, acotadoA: alcance };

    const rectFor = (value) => {
      const el = document.querySelector(value);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const scrollableYValues = new Set(["auto", "scroll", "overlay"]);
    const clippingYValues = new Set(["hidden", "clip"]);
    const round2 = (value) => Math.round(value * 100) / 100;
    const isVisibleElement = (el) => {
      const closedDetails = el.closest("details:not([open])");
      if (closedDetails) {
        const visibleSummary = closedDetails.querySelector(":scope > summary");
        if (!visibleSummary || (el !== visibleSummary && !visibleSummary.contains(el))) return false;
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return !el.hidden
        && el.getClientRects().length > 0
        && rect.width > 1
        && rect.height > 1
        && style.display !== "none"
        && style.visibility !== "hidden"
        && hasEffectiveOpacity(el);
    };
    const measurementCanvas = document.createElement("canvas");
    const measurementContext = measurementCanvas.getContext("2d");
    const controlTextMetrics = Array.from(document.querySelectorAll("input[placeholder]"))
      .filter((input) => (
        input instanceof HTMLInputElement
        && input.value === ""
        && input.placeholder.trim() !== ""
        && isVisibleElement(input)
      ))
      .slice(0, 80)
      .map((input) => {
        const style = window.getComputedStyle(input);
        if (measurementContext) {
          measurementContext.font = [
            style.fontStyle,
            style.fontVariant,
            style.fontWeight,
            style.fontSize,
            style.fontFamily,
          ].filter(Boolean).join(" ");
        }
        const letterSpacing = Number.parseFloat(style.letterSpacing || "0") || 0;
        const baseTextWidth = measurementContext?.measureText(input.placeholder).width ?? 0;
        const textWidth = baseTextWidth + Math.max(0, input.placeholder.length - 1) * letterSpacing;
        const paddingLeft = Number.parseFloat(style.paddingLeft || "0") || 0;
        const paddingRight = Number.parseFloat(style.paddingRight || "0") || 0;
        const availableWidth = Math.max(0, input.clientWidth - paddingLeft - paddingRight);
        const clippedX = textWidth > availableWidth + 1;
        const rect = input.getBoundingClientRect();
        const metric = {
          tag: "input",
          id: input.id || null,
          className: String(input.getAttribute("class") || "").slice(0, 180),
          label: input.placeholder,
          kind: "placeholder",
          textWidth: round2(textWidth),
          availableWidth: round2(availableWidth),
          clientWidth: input.clientWidth,
          clippedX,
        };
        if (clippedX && issues.length < 80) {
          issues.push({
            type: "placeholder-clipped",
            tag: metric.tag,
            className: metric.className,
            label: metric.label,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            text: {
              width: metric.textWidth,
              availableWidth: metric.availableWidth,
            },
          });
        }
        return metric;
      });
    const isScrollableY = (el) => {
      const style = window.getComputedStyle(el);
      // `overflow:auto` no basta para delegar el recorrido: una región de
      // 0–39 px existe en CSS, pero no ofrece una ventana de datos utilizable.
      // Sin este piso, un descendiente colapsado podía ocultar el jail real de
      // su ancestro y producir un falso verde en escritorios de poca altura.
      return isVisibleElement(el)
        && el.clientHeight >= 40
        && scrollableYValues.has(style.overflowY)
        && el.scrollHeight > el.clientHeight + 2;
    };
    const nearestScrollableY = (el) => {
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        if (isScrollableY(node)) return node;
        node = node.parentElement;
      }
      return null;
    };
    const hasScrollableYDescendant = (el) => (
      Array.from(el.querySelectorAll("*")).some((node) => isScrollableY(node))
    );
    const describeEl = (el) => ({
      tag: el.tagName.toLowerCase(),
      className: String(el.getAttribute("class") || "").slice(0, 180),
      label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
    });
    const scrollJails = [];
    const scrollJailSelector = [
      ".pulso-main--viewport",
      ".pulso-main-inner",
      ".pulso-route-surface",
      ".pulso-page-frame",
      ".pulso-page-frame-body",
      ".pulso-adaptive-split",
      ".pulso-adaptive-rail",
      ".pulso-adaptive-main",
      ".home-wrap",
      ".home-cinema",
      ".dashboard-scope",
      ".pulso-xlsform-frame",
      ".pulso-graficos-frame",
      ".cmv2-frame",
      ".hojas-ruta-frame",
      ".mon-page",
    ].join(",");

    for (const el of Array.from(document.querySelectorAll(scrollJailSelector))) {
      if (!isVisibleElement(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < 40) continue;
      const style = window.getComputedStyle(el);
      const contentExceeds = el.scrollHeight > el.clientHeight + 12;
      if (!contentExceeds || scrollableYValues.has(style.overflowY)) continue;
      const scrollOwner = nearestScrollableY(el);
      const clipsItself = clippingYValues.has(style.overflowY);
      const delegatesToDescendant = hasScrollableYDescendant(el);
      if (delegatesToDescendant) continue;
      if (!clipsItself && scrollOwner) continue;
      scrollJails.push({
        type: "scroll-jail",
        ...describeEl(el),
        overflowY: style.overflowY,
        scrollOwner: scrollOwner ? describeEl(scrollOwner) : null,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        scroll: {
          height: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
      });
      if (scrollJails.length >= 40) break;
    }

    const geometryAudits = [];
    const geometryIssues = [];
    const geometryCoverageMisses = [];
    const auditedGroups = new Set();
    const declaredGeometryGroups = new Set();
    const geometrySpecs = [];

    for (const spec of requestedGeometryGroups || []) {
      let matches = [];
      try {
        matches = Array.from(document.querySelectorAll(spec.selector));
      } catch (error) {
        geometryCoverageMisses.push({
          selector: spec.selector,
          contract: spec.contract,
          reason: `selector inválido: ${String(error?.message || error)}`,
        });
        continue;
      }
      if (matches.length === 0) {
        geometryCoverageMisses.push({
          selector: spec.selector,
          contract: spec.contract,
          reason: "grupo no encontrado",
        });
      }
      for (const group of matches) {
        declaredGeometryGroups.add(group);
        geometrySpecs.push({ ...spec, group, source: "cli" });
      }
    }

    for (const group of Array.from(document.querySelectorAll("[data-qa-geometry-group]"))) {
      declaredGeometryGroups.add(group);
      const contract = group.getAttribute("data-qa-geometry-contract") || "equal";
      if (!["equal", "intrinsic"].includes(contract)) {
        geometryCoverageMisses.push({
          selector: `[data-qa-geometry-group="${group.getAttribute("data-qa-geometry-group") || ""}"]`,
          contract,
          reason: "data-qa-geometry-contract debe ser equal o intrinsic",
        });
        continue;
      }
      geometrySpecs.push({
        contract,
        selector: `[data-qa-geometry-group="${group.getAttribute("data-qa-geometry-group") || ""}"]`,
        group,
        source: "markup",
      });
    }

    const visibleChildren = (parent) => Array.from(parent.children).filter((child) => isVisibleElement(child));
    const scrollOwnerInside = (member) => {
      if (isScrollableY(member)) return member;
      return Array.from(member.querySelectorAll("*")).find((node) => isScrollableY(node)) || null;
    };
    const elementHint = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: String(el.getAttribute("class") || "").slice(0, 180),
      label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
    });

    if (geometryRequired) {
      const geometryStateClasses = new Set([
        "active", "is-active",
        "selected", "is-selected",
        "current", "is-current",
        "disabled", "is-disabled",
        "open", "is-open",
        "checked", "is-checked",
      ]);
      const excludedGeometryContainer = [
        "nav",
        "table", "thead", "tbody", "tfoot", "tr",
        "svg", "defs", "g",
        "[role='navigation']", "[role='tablist']", "[role='toolbar']",
        "[role='menu']", "[role='menubar']", "[role='listbox']",
      ].join(",");
      const interactiveGeometryMember = [
        "button", "a[href]", "input", "select", "textarea", "option",
        "[contenteditable='true']",
        "[role='button']", "[role='tab']", "[role='menuitem']", "[role='option']",
      ].join(",");
      const structuralGeometryDescendant = [
        "article", "section", "div", "main", "header", "footer", "aside", "nav",
        "ul", "ol", "li", "table", "form", "fieldset",
      ].join(",");
      const inlineGeometryDisplays = new Set(["inline", "inline-block", "inline-flex"]);
      const isInlineSpanAtom = (member) => {
        if (
          member.tagName !== "SPAN"
          || member.querySelector(structuralGeometryDescendant)
          || member.querySelector(interactiveGeometryMember)
        ) return false;
        const display = window.getComputedStyle(member).display;
        if (inlineGeometryDisplays.has(display)) return true;
        const parent = member.parentElement;
        const parentDisplay = parent && isVisibleElement(parent)
          ? window.getComputedStyle(parent).display
          : null;
        return display === "flex" && (parentDisplay === "flex" || parentDisplay === "inline-flex");
      };
      const variantSignature = (member) => {
        const structuralClasses = Array.from(member.classList)
          .filter((className) => !geometryStateClasses.has(className))
          .sort();
        if (structuralClasses.length === 0) return null;
        return `${member.tagName.toLowerCase()}.${structuralClasses.join(".")}`;
      };
      const geometryRoots = Array.from(document.querySelectorAll("[data-audit-ready]"))
        .filter((node) => isVisibleElement(node));
      const scannedParents = new Set();

      for (const geometryRoot of geometryRoots) {
        const parents = [geometryRoot, ...Array.from(geometryRoot.querySelectorAll("*"))];
        for (const parent of parents) {
          if (scannedParents.has(parent) || !isVisibleElement(parent)) continue;
          scannedParents.add(parent);
          if (declaredGeometryGroups.has(parent)) continue;
          if (parent.closest(excludedGeometryContainer)) continue;

          const variants = new Map();
          for (const member of visibleChildren(parent)) {
            if (
              declaredGeometryGroups.has(member)
              || member instanceof SVGElement
              || member.matches(interactiveGeometryMember)
              || (member.tagName === "LABEL" && member.querySelector(interactiveGeometryMember))
            ) continue;
            const signature = variantSignature(member);
            if (!signature) continue;
            const members = variants.get(signature) || [];
            members.push(member);
            variants.set(signature, members);
          }

          for (const [variant, members] of variants) {
            if (members.length < 2) continue;
            if (members.every(isInlineSpanAtom)) continue;
            geometryCoverageMisses.push({
              type: "geometry-undeclared",
              selector: null,
              contract: null,
              reason: "colección visible de la misma variante sin contrato geométrico",
              parent: elementHint(parent),
              variant,
              count: members.length,
              members: members.map(elementHint),
            });
          }
        }
      }
    }

    const resolveReachabilityEnd = (owner, ownerRect, tolerance = 2) => {
      const candidates = [];
      let order = 0;
      const addCandidate = (node, kind, clippedBy = null) => {
        const rect = node.getBoundingClientRect();
        candidates.push({
          node,
          rect,
          kind,
          clippedBy,
          logicalBottom: rect.bottom - ownerRect.top + owner.scrollTop,
          order: order++,
        });
      };
      const furthestDescendant = (root) => {
        let furthest = null;
        const visitDescendant = (node) => {
          if (!isVisibleElement(node)) return;
          const style = window.getComputedStyle(node);
          if (style.position === "fixed") return;
          const rect = node.getBoundingClientRect();
          if (!furthest || rect.bottom > furthest.rect.bottom + tolerance) {
            furthest = { node, rect };
          }
          if (isScrollableY(node) || clippingYValues.has(style.overflowY)) return;
          visibleChildren(node).forEach(visitDescendant);
        };
        visibleChildren(root).forEach(visitDescendant);
        return furthest;
      };
      const visit = (node) => {
        if (!isVisibleElement(node)) return;
        const style = window.getComputedStyle(node);
        if (style.position === "fixed") return;
        if (node !== owner && isScrollableY(node)) {
          addCandidate(node, "nested-scroll");
          return;
        }
        const children = visibleChildren(node);
        if (clippingYValues.has(style.overflowY)) {
          const rect = node.getBoundingClientRect();
          const furthest = furthestDescendant(node);
          if (furthest && (
            furthest.rect.top < rect.top - tolerance
            || furthest.rect.bottom > rect.bottom + tolerance
          )) {
            addCandidate(furthest.node, "clipped", node);
          } else {
            addCandidate(node, "clip-surface");
          }
          return;
        }
        if (children.length > 0) {
          children.forEach(visit);
          return;
        }
        addCandidate(node, "leaf");
      };
      visibleChildren(owner).forEach(visit);
      return candidates.reduce((best, candidate) => {
        if (!best) return candidate;
        if (candidate.logicalBottom > best.logicalBottom + tolerance) return candidate;
        if (
          Math.abs(candidate.logicalBottom - best.logicalBottom) <= tolerance
          && candidate.order > best.order
        ) return candidate;
        return best;
      }, null);
    };
    const auditScrollOwner = async (owner) => {
      const originalScrollTop = owner.scrollTop;
      const maxScroll = Math.max(0, owner.scrollHeight - owner.clientHeight);
      const textMetrics = Array.from(owner.querySelectorAll("strong"))
        .filter((node) => isVisibleElement(node))
        .slice(0, 60)
        .map((node) => ({
          ...elementHint(node),
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          clippedX: node.scrollWidth > node.clientWidth + 1,
          clippedY: node.scrollHeight > node.clientHeight + 1,
        }));
      const setScrollTop = (value) => {
        owner.scrollTop = value;
        return owner.scrollTop;
      };
      const positions = {
        start: setScrollTop(0),
        middle: setScrollTop(Math.floor(maxScroll / 2)),
        end: setScrollTop(maxScroll),
      };
      // Los virtualizadores actualizan sus filas visibles después del evento
      // de scroll. Medir en el mismo tick conserva nodos del inicio con
      // coordenadas negativas y fabrica un `scroll-unreachable`, aunque el
      // usuario sí haya llegado al final. Dos frames permiten render + medida
      // sin relajar la comprobación del contenido terminal.
      await new Promise((resolve) => window.requestAnimationFrame(() => (
        window.requestAnimationFrame(resolve)
      )));
      const ownerRect = owner.getBoundingClientRect();
      const reachabilityEnd = resolveReachabilityEnd(owner, ownerRect);
      const lastContent = reachabilityEnd?.node ?? null;
      const lastRect = reachabilityEnd?.rect ?? null;
      const atEnd = Math.abs(positions.end - maxScroll) <= 1;
      const lastContentReachable = !reachabilityEnd?.clippedBy && (!lastRect || (
        lastRect.bottom <= ownerRect.bottom + 2
        && lastRect.bottom >= ownerRect.top - 2
      ));
      owner.scrollTop = originalScrollTop;
      return {
        scrollAudit: {
          maxScroll,
          originalScrollTop,
          positions,
          atEnd,
          lastContentReachable,
          lastContent: lastContent ? elementHint(lastContent) : null,
          lastContentKind: reachabilityEnd?.kind ?? null,
          ownerBottom: round2(ownerRect.bottom),
          lastContentBottom: lastRect ? round2(lastRect.bottom) : null,
          clippedBy: reachabilityEnd?.clippedBy ? elementHint(reachabilityEnd.clippedBy) : null,
        },
        textMetrics,
      };
    };

    for (const spec of geometrySpecs) {
      const group = spec.group;
      if (auditedGroups.has(group) || !isVisibleElement(group)) continue;
      auditedGroups.add(group);
      const explicitMembers = Array.from(group.querySelectorAll("[data-qa-geometry-member]"))
        .filter((member) => (
          isVisibleElement(member)
          && member.closest("[data-qa-geometry-group]") === group
        ));
      const members = explicitMembers.length > 0 ? explicitMembers : visibleChildren(group);
      if (members.length === 0) {
        geometryCoverageMisses.push({
          selector: spec.selector,
          contract: spec.contract,
          reason: "grupo visible sin miembros visibles",
        });
        continue;
      }

      const groupRect = group.getBoundingClientRect();
      const memberMeasures = await Promise.all(members.map(async (member) => {
        const rect = member.getBoundingClientRect();
        const style = window.getComputedStyle(member);
        const explicitContent = Array.from(member.querySelectorAll("[data-qa-geometry-content]"))
          .filter((node) => isVisibleElement(node));
        const contentNodes = explicitContent.length > 0 ? explicitContent : visibleChildren(member);
        const cardinality = explicitContent.length > 0
          ? explicitContent.reduce((count, region) => count + visibleChildren(region).length, 0)
          : contentNodes.length;
        // Un miembro cuyo contenido es TEXTO SUELTO no tiene hijos elemento, y
        // el fallback al borde superior le atribuía como vacío todo su interior:
        // un `<p role="status">` de dos líneas se reportaba con 13 px muertos
        // que no existen. El texto se mide con un Range, que sí lo ve; sólo si
        // tampoco hay texto se cae al borde.
        const textoBottom = () => {
          const range = document.createRange();
          range.selectNodeContents(member);
          const rects = Array.from(range.getClientRects());
          return rects.length > 0 ? Math.max(...rects.map((r) => r.bottom)) : null;
        };
        const contentBottom = contentNodes.length > 0
          ? Math.max(...contentNodes.map((node) => node.getBoundingClientRect().bottom))
          : (textoBottom() ?? rect.top + Number.parseFloat(style.paddingTop || "0"));
        const paddingBottom = Number.parseFloat(style.paddingBottom || "0") || 0;
        const ownedCapacity = member.getAttribute("data-qa-geometry-capacity") === "owned"
          || Boolean(member.querySelector("[data-qa-geometry-capacity='owned']"));
        const scrollOwner = scrollOwnerInside(member);
        const scrollEvidence = scrollOwner ? await auditScrollOwner(scrollOwner) : null;
        const lastContent = contentNodes.at(-1) || null;
        if (scrollOwner && scrollEvidence && (
          !scrollEvidence.scrollAudit.atEnd
          || !scrollEvidence.scrollAudit.lastContentReachable
        )) {
          geometryIssues.push({
            type: "scroll-unreachable",
            selector: spec.selector,
            owner: elementHint(scrollOwner),
            scrollAudit: scrollEvidence.scrollAudit,
          });
        }
        return {
          ...elementHint(member),
          rect: {
            x: round2(rect.x),
            y: round2(rect.y),
            width: round2(rect.width),
            height: round2(rect.height),
          },
          cardinality,
          contentBottom: round2(contentBottom),
          unusedInteriorBottom: round2(Math.max(0, rect.bottom - paddingBottom - contentBottom)),
          exteriorGapBottom: round2(Math.max(0, groupRect.bottom - rect.bottom)),
          ownedCapacity,
          overflowOwner: scrollOwner ? {
            ...elementHint(scrollOwner),
            clientHeight: scrollOwner.clientHeight,
            scrollHeight: scrollOwner.scrollHeight,
            scrollAudit: scrollEvidence.scrollAudit,
            textMetrics: scrollEvidence.textMetrics,
          } : null,
          lastContent: lastContent ? elementHint(lastContent) : null,
        };
      }));
      const heights = memberMeasures.map((member) => member.rect.height);
      const widths = memberMeasures.map((member) => member.rect.width);
      const heightDelta = round2(Math.max(...heights) - Math.min(...heights));
      const widthDelta = round2(Math.max(...widths) - Math.min(...widths));
      const audit = {
        selector: spec.selector,
        source: spec.source,
        contract: spec.contract,
        tolerance: geometryTolerancePx,
        group: {
          ...elementHint(group),
          rect: {
            x: round2(groupRect.x),
            y: round2(groupRect.y),
            width: round2(groupRect.width),
            height: round2(groupRect.height),
          },
        },
        heightDelta,
        widthDelta,
        members: memberMeasures,
      };
      geometryAudits.push(audit);

      if (spec.contract === "equal" && heightDelta > geometryTolerancePx) {
        geometryIssues.push({
          type: "equal-frame-drift",
          selector: spec.selector,
          heightDelta,
          tolerance: geometryTolerancePx,
          memberHeights: heights,
        });
      }
      if (spec.contract === "equal" && widthDelta > geometryTolerancePx) {
        geometryIssues.push({
          type: "equal-frame-width-drift",
          selector: spec.selector,
          widthDelta,
          tolerance: geometryTolerancePx,
          memberWidths: widths,
        });
      }
      if (spec.contract === "intrinsic") {
        const inflatedMembers = memberMeasures.filter((member) => (
          member.unusedInteriorBottom > geometryTolerancePx
          && !member.ownedCapacity
          && !member.overflowOwner
        ));
        if (inflatedMembers.length > 0) {
          geometryIssues.push({
            type: "capacity-drift",
            selector: spec.selector,
            tolerance: geometryTolerancePx,
            members: inflatedMembers.map((member) => ({
              ...elementHint(members[memberMeasures.indexOf(member)]),
              unusedInteriorBottom: member.unusedInteriorBottom,
            })),
          });
        }
      }
    }

    if (geometryRequired && geometryAudits.length === 0 && geometryCoverageMisses.length === 0) {
      geometryCoverageMisses.push({ selector: null, contract: null, reason: "sin grupos geométricos medidos" });
    }

    const globalOverflowX = body ? body.scrollWidth > window.innerWidth + 2 : false;
    const noProjectText = /\bSin proyecto\b/i.test(text) || /Selecciona un proyecto\s+\.pulso/i.test(text);
    const rootClasses = String(root.getAttribute("class") || "");
    return {
      title: document.title,
      activeLayout: {
        preset: root.dataset.pulsoLayoutPreset || null,
        density: root.dataset.pulsoLayoutDensity || null,
        mode: root.dataset.pulsoLayoutMode || null,
      },
      ready: Array.from(document.querySelectorAll("[data-audit-ready]")).map((el) => el.getAttribute("data-audit-ready")),
      session: window.localStorage.getItem("pulso.sessionId"),
      rootClasses,
      globalOverflowX,
      noProjectText,
      projectLoaded: wantsProject ? !noProjectText : null,
      textSample: text.replace(/\s+/g, " ").trim().slice(0, 500),
      controlTextMetrics,
      scrollJails,
      geometryAudits,
      geometryIssues,
      geometryCoverageMisses,
      layoutRects: {
        shell: rectFor(".pulso-shell"),
        pageFrame: rectFor(".pulso-page-frame"),
        adaptiveSplit: rectFor(".pulso-adaptive-split"),
        rail: rectFor(".pulso-adaptive-rail"),
        main: rectFor(".pulso-adaptive-main"),
      },
      issues,
    };
  }, {
    projectMode,
    geometryGroups,
    geometryTolerance,
    requireGeometry,
    rootSelector,
  });
}

// Barrido de superficies que solo existen tras un click.
//
// El detector de desborde de `inspectDom` es el mismo de siempre; lo que faltaba
// era abrir la superficie para que hubiera algo que medir. Un popover cerrado no
// tiene caja, así que la vista en reposo sale verde mientras el desborde vive
// dentro del menú. Esto abre cada disparador declarado, mide SOLO su subárbol y
// lo cierra antes de pasar al siguiente.
//
// Se apoya en dos contratos que la propia UI ya declara: `aria-haspopup` ("esto
// abre una superficie") y `aria-expanded` ("esto tiene un estado abierto"). El
// segundo trae además acordeones y filas expandibles —no son popovers, pero sí
// contenido que solo existe tras un click, así que medirlos es correcto—; lo que
// cambia es cómo se cierran, porque no responden a Escape.
//
// Un menú que no declare ninguno de los dos queda fuera del barrido, y esa
// ausencia es en sí un hallazgo de accesibilidad: si el runner no sabe que ese
// botón abre algo, un lector de pantalla tampoco.
const POPOVER_TRIGGER_SELECTOR = "[aria-haspopup='menu'],[aria-haspopup='dialog'],[aria-haspopup='listbox'],[aria-haspopup='true'],[aria-expanded]";
const POPOVER_SURFACE_SELECTOR = "[role='menu'],[role='dialog'],[role='listbox'],[class*='popover'],[class*='menu']";
const POPOVER_SCOPE_ATTR = "data-qa-popover-scope";

export async function barrerPopovers(page, { timeoutMs }) {
  const disparadores = await page.evaluate(({ triggerSelector }) => {
    return Array.from(document.querySelectorAll(triggerSelector))
      .map((el, indice) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 1 && rect.height > 1;
        const style = window.getComputedStyle(el);
        if (!visible || style.display === "none" || style.visibility === "hidden") return null;
        return {
          indice,
          etiqueta: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          className: String(el.getAttribute("class") || "").slice(0, 120),
          // De qué contrato salió y en qué estado estaba: el cierre tiene que
          // devolver el disparador a este valor, no simplemente pulsar Escape.
          declara: el.getAttribute("aria-haspopup") ? "haspopup" : "expanded",
          expandidoAlEmpezar: el.getAttribute("aria-expanded"),
        };
      })
      .filter(Boolean);
  }, { triggerSelector: POPOVER_TRIGGER_SELECTOR });

  const auditorias = [];
  for (const disparador of disparadores) {
    const rutaAntes = new URL(page.url()).pathname;
    // El índice se resuelve en el momento: abrir un popover puede reordenar o
    // reemplazar nodos, así que una referencia guardada del barrido anterior ya
    // no sirve.
    // Click REAL de Playwright (mousedown + mouseup + click), no `el.click()`
    // del DOM. Hay disparadores que abren en `onMouseDown` para no perder la
    // selección del texto —la barra del editor markdown lo hace a propósito— y
    // con el click sintético del DOM no llegan a abrirse nunca: el barrido los
    // daba por superficie ausente en vez de medirlos.
    const abierto = await page.locator(POPOVER_TRIGGER_SELECTOR).nth(disparador.indice)
      .click({ force: true, timeout: Math.min(5000, timeoutMs) })
      .then(() => ({ estado: "click" }))
      .catch((error) => ({ estado: "no-clickeable", detalle: String(error?.message || error).slice(0, 200) }));

    if (abierto.estado !== "click") {
      auditorias.push({ ...disparador, estado: abierto.estado, issues: [] });
      continue;
    }

    await cederRenderDeTransicion(page);

    const rutaDespues = new URL(page.url()).pathname;
    if (rutaDespues !== rutaAntes) {
      // No era un popover: el control navegó. Volver deja la vista donde estaba
      // para que el resto del barrido siga siendo válido.
      await page.goBack({ waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
      await esperarListo(page, timeoutMs);
      auditorias.push({ ...disparador, estado: "navego", issues: [] });
      continue;
    }

    const marcado = await page.evaluate(({ triggerSelector, surfaceSelector, scopeAttr, indice }) => {
      const el = document.querySelectorAll(triggerSelector)[indice];
      const superficies = Array.from(document.querySelectorAll(surfaceSelector)).filter((nodo) => {
        const rect = nodo.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return false;
        const style = window.getComputedStyle(nodo);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      if (superficies.length === 0) return { estado: "sin-superficie" };
      // La superficie del disparador es la más cercana en el árbol; si no
      // comparte ancestro (portal), la última visible es la recién montada.
      const propia = el
        ? superficies.find((nodo) => el.parentElement && el.parentElement.contains(nodo))
        : null;
      const elegida = propia || superficies[superficies.length - 1];
      elegida.setAttribute(scopeAttr, "1");
      return { estado: "abierto", enPortal: !propia };
    }, {
      triggerSelector: POPOVER_TRIGGER_SELECTOR,
      surfaceSelector: POPOVER_SURFACE_SELECTOR,
      scopeAttr: POPOVER_SCOPE_ATTR,
      indice: disparador.indice,
    });

    let issues = [];
    if (marcado.estado === "abierto") {
      const medicion = await inspectDom(page, {
        projectMode: false,
        geometryGroups: [],
        geometryTolerance: 2,
        requireGeometry: false,
        rootSelector: `[${POPOVER_SCOPE_ATTR}]`,
      });
      issues = (medicion.issues || []).map((issue) => ({
        ...issue,
        popover: disparador.etiqueta || disparador.className,
      }));
    }

    await page.evaluate(({ scopeAttr }) => {
      document.querySelectorAll(`[${scopeAttr}]`).forEach((nodo) => nodo.removeAttribute(scopeAttr));
    }, { scopeAttr: POPOVER_SCOPE_ATTR });

    // Cerrar en tres pasos, del más suave al más invasivo. Escape sirve para
    // popovers y menús; un acordeón o una fila expandible lo ignora, y ahí lo
    // correcto es volver a pulsar su propio disparador para devolverlo al
    // estado en que estaba. Dejar una superficie abierta contamina la medición
    // de todos los disparadores que vienen después.
    await page.keyboard.press("Escape").catch(() => {});
    await cederRenderDeTransicion(page);

    const volvioASuEstado = await page.evaluate(({ triggerSelector, indice, expandidoAlEmpezar }) => {
      const el = document.querySelectorAll(triggerSelector)[indice];
      if (!el) return true;
      return el.getAttribute("aria-expanded") === expandidoAlEmpezar;
    }, {
      triggerSelector: POPOVER_TRIGGER_SELECTOR,
      indice: disparador.indice,
      expandidoAlEmpezar: disparador.expandidoAlEmpezar,
    });

    if (!volvioASuEstado) {
      await page.locator(POPOVER_TRIGGER_SELECTOR).nth(disparador.indice)
        .click({ force: true, timeout: Math.min(5000, timeoutMs) })
        .catch(() => {});
      await cederRenderDeTransicion(page);
    }

    const sigueAbierto = await page.evaluate(({ surfaceSelector }) => {
      return Array.from(document.querySelectorAll(surfaceSelector)).some((nodo) => {
        const rect = nodo.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      });
    }, { surfaceSelector: POPOVER_SURFACE_SELECTOR });
    if (sigueAbierto) {
      await page.mouse.click(2, 2).catch(() => {});
      await cederRenderDeTransicion(page);
    }

    auditorias.push({ ...disparador, estado: marcado.estado, enPortal: marcado.enPortal ?? null, issues });
  }

  return auditorias;
}

function summarize(results, opts) {
  // Los desbordes hallados dentro de un popover son desbordes de la app: entran
  // al mismo contador que los de la vista en reposo para que `--fail-on-issues`
  // no distinga entre lo que se ve solo y lo que hay que abrir.
  const popovers = results.flatMap((item) => item.popovers || []);
  const popoverIssues = popovers.flatMap((item) => item.issues || []);
  const popoversSinSuperficie = popovers.filter((item) => item.estado === "sin-superficie");
  const visualIssues = [...results.flatMap((item) => item.issues || []), ...popoverIssues];
  const scrollJails = results.flatMap((item) => item.scrollJails || []);
  const geometryAudits = results.flatMap((item) => item.geometryAudits || []);
  const geometryIssues = results.flatMap((item) => item.geometryIssues || []);
  const geometryCoverageMisses = results.flatMap((item) => item.geometryCoverageMisses || []);
  const globalOverflow = results.filter((item) => item.globalOverflowX);
  const pageErrors = results.flatMap((item) => item.pageErrors || []);
  const consoleErrors = results.flatMap((item) => (item.consoleMessages || []).filter((msg) => (
    msg.type === "error" && !/^Failed to load resource:/i.test(msg.text)
  )));
  const apiErrors = opts.api === "real" ? results.flatMap((item) => item.apiErrors || []) : [];
  const resourceErrors = results.flatMap((item) => item.resourceErrors || []);
  const projectMisses = results.filter((item) => item.projectLoaded === false);
  const waitSelectorMisses = results.filter((item) => item.waitSelectorMatched === false);
  const postClickWaitSelectorMisses = results.filter((item) => item.postClickWaitSelectorMatched === false);
  return {
    captures: results.length,
    screenshots: results.map((item) => item.screenshot),
    visualIssues: visualIssues.length,
    popovers: popovers.length,
    popoverIssues: popoverIssues.length,
    popoversSinSuperficie: popoversSinSuperficie.length,
    scrollJails: scrollJails.length,
    geometryGroups: geometryAudits.length,
    geometryIssues: geometryIssues.length,
    geometryCoverageMisses: geometryCoverageMisses.length,
    globalOverflow: globalOverflow.length,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    apiErrors: apiErrors.length,
    resourceErrors: resourceErrors.length,
    projectMisses: projectMisses.length,
    waitSelectorMisses: waitSelectorMisses.length + postClickWaitSelectorMisses.length,
    ok: visualIssues.length === 0 &&
      scrollJails.length === 0 &&
      geometryIssues.length === 0 &&
      geometryCoverageMisses.length === 0 &&
      globalOverflow.length === 0 &&
      pageErrors.length === 0 &&
      consoleErrors.length === 0 &&
      apiErrors.length === 0 &&
      resourceErrors.length === 0 &&
      projectMisses.length === 0 &&
      waitSelectorMisses.length === 0 &&
      postClickWaitSelectorMisses.length === 0,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.project && !(await fileExists(opts.project))) {
    throw new Error(`No existe el .pulso: ${opts.project}`);
  }
  /* Abrir un proyecto escribe en él (sesión, autosave, caches del warm start).
   * Con un .pulso sin permiso de escritura el backend no falla: se queda
   * esperando, `/api/system/bootstrap` devuelve `{"sid":{}}` para siempre y
   * tanto node como R quedan a 0% de CPU. Medido: 11 minutos sin una sola
   * línea de salida contra ~1 minuto con una copia escribible.
   *
   * Es la trampa exacta de los proyectos de referencia del ADR 0043, que son
   * 0444 a propósito para que un autosave no los pise. Acá se detecta y se dice
   * qué hacer, en vez de dejar al que corre el gate mirando una consola muda. */
  if (opts.project) {
    try {
      await fsp.access(opts.project, fs.constants.W_OK);
    } catch {
      throw new Error(
        `El .pulso no tiene permiso de escritura y abrirlo colgaría el runner:\n` +
        `  ${opts.project}\n\n` +
        `Si es un proyecto de referencia (ADR 0043), saca una copia de corrida:\n` +
        `  Rscript api/scripts/reference_project_prepare_run.R --project <slug>\n` +
        `y pasa el \`project_path\` que imprime el manifiesto.`,
      );
    }
  }
  await fsp.mkdir(opts.out, { recursive: true });
  const logDir = path.join(opts.out, "logs");
  await fsp.mkdir(logDir, { recursive: true });

  const stack = await startStack(opts, logDir);
  const cleanup = async () => {
    if (opts.keepServers) return;
    await stopProcess(stack.frontend);
    await stopProcess(stack.api);
  };
  process.once("SIGINT", () => {
    cleanup().finally(() => process.exit(130));
  });
  process.once("SIGTERM", () => {
    cleanup().finally(() => process.exit(143));
  });

  try {
    const results = await runCaptures(opts, stack);
    const summary = summarize(results, opts);
    const report = {
      ok: summary.ok,
      generatedAt: new Date().toISOString(),
      options: {
        routes: opts.routes,
        viewports: opts.viewports,
        layoutPreset: opts.layoutPreset,
        api: opts.api,
        project: opts.project || null,
        headed: opts.headed,
        prefetchRouteData: opts.prefetchRouteData,
        geometryGroups: opts.geometryGroups,
        geometryTolerance: opts.geometryTolerance,
        requireGeometry: opts.requireGeometry,
      },
      stack: {
        url: stack.url,
        apiUrl: stack.apiUrl || null,
        frontendPort: stack.frontendPort,
        apiPort: stack.apiPort,
        session: stack.session || null,
        projectStatus: stack.projectStatus,
        logs: {
          api: stack.api?.logPath || null,
          vite: stack.frontend?.logPath || null,
        },
      },
      summary,
      results,
    };
    const reportPath = path.join(opts.out, "report.json");
    await fsp.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`[ui-quick-check] report: ${reportPath}`);
    console.log(`[ui-quick-check] url: ${stack.url}`);
    if (stack.apiUrl) console.log(`[ui-quick-check] api: ${stack.apiUrl}`);
    if (stack.session) console.log(`[ui-quick-check] session: ${stack.session}`);
    for (const shot of summary.screenshots) console.log(`[ui-quick-check] screenshot: ${shot}`);
    console.log(`[ui-quick-check] ok=${summary.ok} captures=${summary.captures} issues=${summary.visualIssues} popovers=${summary.popovers} popoverIssues=${summary.popoverIssues} scrollJails=${summary.scrollJails} geometryGroups=${summary.geometryGroups} geometryIssues=${summary.geometryIssues} geometryCoverageMisses=${summary.geometryCoverageMisses} overflow=${summary.globalOverflow} pageErrors=${summary.pageErrors} apiErrors=${summary.apiErrors} resourceErrors=${summary.resourceErrors} projectMisses=${summary.projectMisses} waitSelectorMisses=${summary.waitSelectorMisses}`);
    if (!summary.ok && opts.failOnIssues) process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

if (path.resolve(process.argv[1] || "") === __filename) {
  main().catch((error) => {
    console.error(`[ui-quick-check] ${error?.stack || error}`);
    process.exit(1);
  });
}
