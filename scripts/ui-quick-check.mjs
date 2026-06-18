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
const PROCESSING_ROUTES = ["/carga", "/validacion", "/codificacion", "/analitica"];
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
    timeoutMs: DEFAULT_TIMEOUT_MS,
    frontendPort: Number(process.env.UI_QA_FRONTEND_PORT || process.env.VITE_DEV_PORT || "5174"),
    apiPort: Number(process.env.UI_QA_API_PORT || process.env.PULSO_PORT || "8788"),
    matrix: false,
    headed: false,
    keepServers: false,
    failOnIssues: false,
    fullPage: false,
    clickTabs: [],
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
    } else if (arg === "--timeout-ms") {
      out.timeoutMs = Number(next());
    } else if (arg === "--frontend-port") {
      out.frontendPort = Number(next());
    } else if (arg === "--api-port") {
      out.apiPort = Number(next());
    } else if (arg === "--click-tab") {
      out.clickTabs.push(next());
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
  --viewport WIDTHxHEIGHT   Viewport a capturar. Puede repetirse.
  --matrix                  Usa /carga, /validacion, /codificacion, /analitica y la matriz desktop.
  --layout-preset NAME      auto, large, portable, portable-compact, compact o short.
  --project PATH            Proyecto .pulso real para reproducir problemas con datos específicos.
  --api auto|stub|real      Default auto: stub sin proyecto, real con proyecto.
  --out DIR                 Carpeta de reporte. Default: tmp/visual-qa/quick/<timestamp>.
  --click-tab TEXT          Hace click en una pestaña/control antes de capturar. Puede repetirse.
  --headed                  Abre navegador visible de Playwright.
  --keep-servers            Deja los servidores levantados al terminar.
  --fail-on-issues          Sale con código 1 si hay overflow/clipping/errores detectados.
  --full-page               Además de la captura del viewport, guarda captura full page.

El reporte marca scrollJails cuando un contenedor de layout tiene contenido
vertical inaccesible por falta de scroll propio o ancestro scrollable.
`);
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Viewport inválido: ${value}. Usa WIDTHxHEIGHT, por ejemplo 1366x768.`);
  return { width: Number(match[1]), height: Number(match[2]) };
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

async function startStack(opts, logDir) {
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
    started.url = opts.url;
    started.apiUrl = opts.apiUrl || new URL(opts.url).origin;
    if (opts.project) {
      const setup = await openProjectIntoApi(started.apiUrl, opts.project, opts.timeoutMs);
      started.session = setup.session;
      started.projectStatus = setup.projectStatus;
    }
    return started;
  }

  if (opts.api === "real") {
    started.apiPort = await findFreePort(opts.apiPort);
    started.apiUrl = `http://127.0.0.1:${started.apiPort}`;
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
      const setup = await takeBootstrapSession(started.apiUrl, opts.timeoutMs);
      started.session = setup.session;
      started.projectStatus = setup.projectStatus;
    }
  }

  started.frontendPort = await findFreePort(opts.frontendPort);
  started.url = `http://127.0.0.1:${started.frontendPort}/`;
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
  return started;
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

function routeUrl(base, route) {
  const url = new URL(base);
  url.pathname = route;
  return url.toString();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickNamedControl(page, label, timeoutMs) {
  const pattern = new RegExp(escapeRegExp(label), "i");
  const startsWithPattern = new RegExp(`^\\s*${escapeRegExp(label)}(?:\\s|$)`, "i");
  const shortTimeout = Math.min(2500, timeoutMs);
  const candidates = [
    page.getByRole("tab", { name: startsWithPattern }).first(),
    page.locator("button").filter({ hasText: pattern }).last(),
    page.getByRole("button", { name: startsWithPattern }).last(),
    page.getByText(pattern).last(),
  ];
  let lastError = null;
  for (const locator of candidates) {
    try {
      await locator.click({ timeout: shortTimeout });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No se pudo hacer click en "${label}".`);
}

async function runCaptures(opts, stack) {
  const browser = await chromium.launch({ headless: !opts.headed });
  const results = [];
  try {
    for (const viewport of opts.viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(({ layoutPreset, session }) => {
        window.localStorage.setItem("pulso.layoutPreset", layoutPreset);
        if (session) window.localStorage.setItem("pulso.sessionId", session);
      }, { layoutPreset: opts.layoutPreset, session: stack.session || "" });
      if (opts.api === "stub") await installStubApi(context);

      for (const route of opts.routes) {
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

        const target = routeUrl(stack.url, route);
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
        await page.waitForLoadState("networkidle", { timeout: opts.timeoutMs }).catch(() => {});
        if (opts.waitSelector) {
          await page.locator(opts.waitSelector).first().waitFor({ state: "attached", timeout: opts.timeoutMs }).catch(() => {});
        }
        for (const tab of opts.clickTabs) {
          await clickNamedControl(page, tab, opts.timeoutMs);
          await page.waitForLoadState("networkidle", { timeout: opts.timeoutMs }).catch(() => {});
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(250);

        const shotBase = `${opts.name}-${safeSlug(route)}-${viewportName(viewport)}-${opts.layoutPreset}`;
        const screenshot = path.join(opts.out, `${shotBase}.png`);
        const fullScreenshot = opts.fullPage ? path.join(opts.out, `${shotBase}-full.png`) : null;
        await page.screenshot({ path: screenshot });
        if (fullScreenshot) await page.screenshot({ path: fullScreenshot, fullPage: true });

        const dom = await inspectDom(page, { projectMode: Boolean(opts.project) });
        results.push({
          route,
          viewport,
          url: target,
          screenshot,
          fullScreenshot,
          consoleMessages,
          pageErrors,
          apiErrors,
          resourceErrors,
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

async function inspectDom(page, { projectMode }) {
  return page.evaluate(({ projectMode: wantsProject }) => {
    const root = document.documentElement;
    const body = document.body;
    const text = body?.innerText || "";
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
    const issues = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden";
      if (!visible) continue;
      const overflowXAllowed = ["auto", "scroll"].includes(style.overflowX);
      const overflowYAllowed = ["auto", "scroll"].includes(style.overflowY);
      const xOverflow = el.scrollWidth > el.clientWidth + 2 && !overflowXAllowed;
      const yOverflow = el.scrollHeight > el.clientHeight + 2 && !overflowYAllowed;
      if (!xOverflow && !yOverflow) continue;
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
    const isVisibleElement = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden";
    };
    const isScrollableY = (el) => {
      const style = window.getComputedStyle(el);
      return scrollableYValues.has(style.overflowY) && el.scrollHeight > el.clientHeight + 2;
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

    const globalOverflowX = body ? body.scrollWidth > window.innerWidth + 2 : false;
    const noProjectText = /\bSin proyecto\b/i.test(text);
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
      scrollJails,
      layoutRects: {
        shell: rectFor(".pulso-shell"),
        pageFrame: rectFor(".pulso-page-frame"),
        adaptiveSplit: rectFor(".pulso-adaptive-split"),
        rail: rectFor(".pulso-adaptive-rail"),
        main: rectFor(".pulso-adaptive-main"),
      },
      issues,
    };
  }, { projectMode });
}

function summarize(results, opts) {
  const visualIssues = results.flatMap((item) => item.issues || []);
  const scrollJails = results.flatMap((item) => item.scrollJails || []);
  const globalOverflow = results.filter((item) => item.globalOverflowX);
  const pageErrors = results.flatMap((item) => item.pageErrors || []);
  const consoleErrors = results.flatMap((item) => (item.consoleMessages || []).filter((msg) => (
    msg.type === "error" && !/^Failed to load resource:/i.test(msg.text)
  )));
  const apiErrors = opts.api === "real" ? results.flatMap((item) => item.apiErrors || []) : [];
  const resourceErrors = results.flatMap((item) => item.resourceErrors || []);
  const projectMisses = results.filter((item) => item.projectLoaded === false);
  return {
    captures: results.length,
    screenshots: results.map((item) => item.screenshot),
    visualIssues: visualIssues.length,
    scrollJails: scrollJails.length,
    globalOverflow: globalOverflow.length,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    apiErrors: apiErrors.length,
    resourceErrors: resourceErrors.length,
    projectMisses: projectMisses.length,
    ok: visualIssues.length === 0 &&
      scrollJails.length === 0 &&
      globalOverflow.length === 0 &&
      pageErrors.length === 0 &&
      consoleErrors.length === 0 &&
      apiErrors.length === 0 &&
      resourceErrors.length === 0 &&
      projectMisses.length === 0,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.project && !(await fileExists(opts.project))) {
    throw new Error(`No existe el .pulso: ${opts.project}`);
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
    console.log(`[ui-quick-check] ok=${summary.ok} captures=${summary.captures} issues=${summary.visualIssues} scrollJails=${summary.scrollJails} overflow=${summary.globalOverflow} pageErrors=${summary.pageErrors} apiErrors=${summary.apiErrors} resourceErrors=${summary.resourceErrors}`);
    if (!summary.ok && opts.failOnIssues) process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(`[ui-quick-check] ${error?.stack || error}`);
  process.exit(1);
});
