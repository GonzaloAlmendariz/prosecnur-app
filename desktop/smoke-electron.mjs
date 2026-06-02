#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CDP_LIST_URL = process.env.SMOKE_CDP_URL || "http://127.0.0.1:9334/json/list";
const ROUTES = [
  "/",
  "/procesamiento",
  "/carga",
  "/validacion",
  "/codificacion",
  "/analitica",
  "/graficos",
  "/tablero",
  "/calc-muestra",
  "/hojas-ruta",
  "/monitoreo",
  "/editor-xlsform"
];
const AUDIT_MANIFEST = process.env.PULSO_AUDIT_RUN_MANIFEST || "";
const SCREENSHOT_DIR = process.env.PULSO_AUDIT_SCREENSHOT_DIR ||
  (AUDIT_MANIFEST ? path.join(path.dirname(AUDIT_MANIFEST), "screenshots") : "");
const CAPTURE_SCREENSHOTS = Boolean(SCREENSHOT_DIR || process.env.SMOKE_CAPTURE_SCREENSHOTS === "true");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJson(file) {
  if (!file || !fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(file, payload) {
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function slug(value) {
  const text = String(value || "capture")
    .toLowerCase()
    .replace(/^\//, "home")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "home";
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message || JSON.stringify(payload.error)));
        else resolve(payload.result || {});
        return;
      }
      const handlers = this.handlers.get(payload.method) || [];
      for (const handler of handlers) handler(payload.params || {});
    });
  }

  static async connect(wsUrl) {
    if (typeof WebSocket === "undefined") {
      throw new Error("Node no expone WebSocket global. Ejecuta este smoke con Node 22+.");
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(ws);
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout CDP: ${method}`));
        }
      }, 15000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function cdpTarget() {
  const response = await fetch(CDP_LIST_URL);
  if (!response.ok) throw new Error(`No se pudo leer ${CDP_LIST_URL}: ${response.status}`);
  const targets = await response.json();
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!page) throw new Error("No hay una ventana Electron expuesta por depuracion remota.");
  return page.webSocketDebuggerUrl;
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate fallo");
  }
  return result.result?.value;
}

async function navigate(client, route) {
  await evaluate(client, `
    (() => {
      window.history.pushState({}, "", ${JSON.stringify(route)});
      window.dispatchEvent(new PopStateEvent("popstate"));
      return true;
    })()
  `);
  await delay(1200);
}

function routeReadyExpression(route) {
  if (route === "/hojas-ruta") {
    return `
      Boolean(document.querySelector('[data-audit-ready="hojas-ruta"]')) &&
      !Boolean(document.querySelector('[data-audit-route="hojas-ruta"][data-audit-state="loading"]'))
    `;
  }
  if (route === "/monitoreo") {
    return `
      Boolean(document.querySelector('[data-audit-ready="monitoreo"]')) &&
      !Boolean(document.querySelector('[data-audit-route="monitoreo"][data-audit-state="loading"]'))
    `;
  }
  if (route === "/calc-muestra") {
    return `Boolean(document.querySelector('[data-audit-ready="calc-muestra"]'))`;
  }
  if (route === "/tablero") {
    return `
      Boolean(document.querySelector('.dash-tab-nav, .dash-empty-state, [data-audit-ready="dashboard"]')) ||
      /Dashboard no disponible|No se pudo cargar el dashboard/.test(document.body.innerText || "")
    `;
  }
  if (route === "/editor-xlsform") {
    return `
      Array.from(document.querySelectorAll("button")).some((el) => /Exportar\\s*\\.xlsx|Continuar editando|Entrar/i.test(el.textContent || ""))
    `;
  }
  return "document.body.innerText.trim().length >= 10";
}

async function waitForRouteReady(client, route, timeoutMs = 20000) {
  const expression = routeReadyExpression(route);
  const ready = await waitFor(client, expression, timeoutMs);
  const loadingText = await evaluate(client, `
    /Cargando\\s+(generador de hojas de ruta|monitoreo|dashboard)/i.test(document.body.innerText || "")
  `);
  return { ready, loadingText };
}

async function ensureEditorWorkbook(client) {
  const continued = await evaluate(client, `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => {
        const text = (el.textContent || "").trim();
        return text.includes("Continuar editando") || text.includes("Entrar");
      });
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()
  `);
  if (continued) {
    await waitFor(client, `
      Array.from(document.querySelectorAll("button")).some((el) => /Exportar\\s*\\.xlsx/i.test(el.textContent || ""))
    `, 12000);
    await delay(500);
  }
  await dismissCoachmarks(client);
  return continued;
}

async function dismissCoachmarks(client) {
  const dismissed = await evaluate(client, `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => (el.textContent || "").trim().includes("Saltar tour"));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()
  `);
  if (dismissed) await delay(350);
  return dismissed;
}

async function waitFor(client, expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(client, expression);
    if (ok) return true;
    await delay(400);
  }
  return false;
}

async function capture(client, id, route, screenshots) {
  if (!CAPTURE_SCREENSHOTS) return null;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${String(screenshots.length + 1).padStart(2, "0")}-${slug(id)}.png`);
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true
  });
  fs.writeFileSync(file, Buffer.from(shot.data || "", "base64"));
  const item = { id, route, path: file };
  screenshots.push(item);
  return item;
}

async function runtimeAudit(client) {
  return evaluate(client, `
    (async () => {
      const sid = localStorage.getItem("pulso.sessionId") || "";
      const healthRes = await fetch("/api/system/health", { headers: sid ? { "X-Pulso-Session": sid } : {} });
      const health = await healthRes.json().catch(() => ({}));
      const projectRes = await fetch("/api/project/status", { headers: sid ? { "X-Pulso-Session": sid } : {} });
      const project = await projectRes.json().catch(() => ({}));
      return {
        sid,
        origin: window.location.origin,
        port: Number(window.location.port || 0),
        pathname: window.location.pathname,
        health,
        project
      };
    })()
  `, true);
}

async function captureDashboardTabs(client, screenshots) {
  await navigate(client, "/tablero");
  await waitForRouteReady(client, "/tablero");
  const tabs = [
    { id: "dashboard-resumen", label: "Resumen" },
    { id: "dashboard-relaciones", label: "Relaciones" },
    { id: "dashboard-base-datos", label: "Base de datos" },
    { id: "dashboard-dimensiones", label: "Dimensiones" }
  ];
  const statuses = [];
  for (const tab of tabs) {
    const status = await evaluate(client, `
      (() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const button = buttons.find((el) => (el.textContent || "").trim().toLowerCase().includes(${JSON.stringify(tab.label.toLowerCase())}));
        if (!button) return { id: ${JSON.stringify(tab.id)}, label: ${JSON.stringify(tab.label)}, found: false, disabled: false, clicked: false, reason: "No se encontro la pestaña" };
        const reason = button.getAttribute("data-audit-disabled-reason") || button.getAttribute("title") || button.getAttribute("aria-label") || "";
        if (button.disabled) return { id: ${JSON.stringify(tab.id)}, label: ${JSON.stringify(tab.label)}, found: true, disabled: true, clicked: false, reason };
        button.click();
        return { id: ${JSON.stringify(tab.id)}, label: ${JSON.stringify(tab.label)}, found: true, disabled: false, clicked: true, reason };
      })()
    `);
    statuses.push(status);
    if (status.clicked) {
      await delay(900);
      await capture(client, tab.id, "/tablero", screenshots);
    }
  }
  return statuses;
}

async function captureDashboardCustomize(client, screenshots) {
  await navigate(client, "/tablero");
  await waitForRouteReady(client, "/tablero");
  const opened = await evaluate(client, `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => /Personalizar/i.test(el.textContent || ""));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()
  `);
  if (!opened) {
    return { opened: false, panels: [], reason: "No se encontro el boton Personalizar" };
  }
  const ready = await waitFor(client, `Boolean(document.querySelector(".dash-customize-dialog"))`, 8000);
  if (!ready) {
    return { opened: true, panels: [], reason: "No se abrio el dialogo Personalizar" };
  }

  const panels = [
    { id: "dashboard-personalizar-marca", label: "Marca" },
    { id: "dashboard-personalizar-pestanas", label: "Pestañas" },
    { id: "dashboard-personalizar-foda", label: "FODA" },
    { id: "dashboard-personalizar-graficos", label: "Gráficos" }
  ];
  const statuses = [];
  for (const panel of panels) {
    const status = await evaluate(client, `
      (() => {
        const buttons = Array.from(document.querySelectorAll(".dash-customize-nav button"));
        const button = buttons.find((el) => (el.textContent || "").trim().toLowerCase().includes(${JSON.stringify(panel.label.toLowerCase())}));
        if (!button) return { id: ${JSON.stringify(panel.id)}, label: ${JSON.stringify(panel.label)}, found: false, clicked: false };
        if (button.disabled) return { id: ${JSON.stringify(panel.id)}, label: ${JSON.stringify(panel.label)}, found: true, clicked: false, disabled: true };
        button.click();
        return { id: ${JSON.stringify(panel.id)}, label: ${JSON.stringify(panel.label)}, found: true, clicked: true, disabled: false };
      })()
    `);
    statuses.push(status);
    if (status.clicked) {
      await delay(550);
      await capture(client, panel.id, "/tablero", screenshots);
    }
  }
  await evaluate(client, `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => /Cerrar/i.test(el.getAttribute("aria-label") || ""));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()
  `);
  await delay(250);
  return { opened: true, panels: statuses };
}

async function main() {
  const manifestBefore = readJson(AUDIT_MANIFEST);
  const wsUrl = await cdpTarget();
  const client = await CdpClient.connect(wsUrl);
  const errors = [];
  const screenshots = [];
  client.on("Runtime.consoleAPICalled", (params) => {
    if (["error", "assert"].includes(params.type)) {
      errors.push(`console.${params.type}: ${(params.args || []).map((arg) => arg.value || arg.description || "").join(" ")}`);
    }
  });
  client.on("Runtime.exceptionThrown", (params) => {
    errors.push(`exception: ${params.exceptionDetails?.text || "error JS"}`);
  });
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") errors.push(`log: ${params.entry.text}`);
  });

  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.enable");

  const results = [];
  for (const route of ROUTES) {
    const beforeErrors = errors.length;
    await navigate(client, route);
    if (route === "/editor-xlsform") {
      await ensureEditorWorkbook(client);
    }
    const readiness = await waitForRouteReady(client, route);
    await capture(client, route, route, screenshots);
    const textLength = await evaluate(client, "document.body.innerText.trim().length");
    const blank = Number(textLength || 0) < 10;
    const routeErrors = errors.slice(beforeErrors);
    results.push({ route, blank, ready: readiness.ready, loadingText: readiness.loadingText, errors: routeErrors });
  }

  const dashboardTabs = await captureDashboardTabs(client, screenshots);
  const dashboardCustomize = await captureDashboardCustomize(client, screenshots);

  await navigate(client, "/editor-xlsform");
  await ensureEditorWorkbook(client);
  let clicked = await evaluate(client, `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((el) => /Exportar\\s*\\.xlsx/i.test(el.textContent || ""));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()
  `);
  if (!clicked) {
    const opened = await evaluate(client, `
      (() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const button = buttons.find((el) => {
          const text = (el.textContent || "").trim();
          return text.includes("Continuar editando") || text.includes("Entrar") || text.includes("Empezar de cero");
        });
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()
    `);
    if (opened) {
      await waitFor(client, `
        Array.from(document.querySelectorAll("button")).some((el) => /Exportar\\s*\\.xlsx/i.test(el.textContent || ""))
      `, 12000);
    }
    clicked = await evaluate(client, `
      (() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const button = buttons.find((el) => /Exportar\\s*\\.xlsx/i.test(el.textContent || ""));
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()
    `);
  }
  const exportReady = clicked && await waitFor(client, `
    document.body.innerText.includes("Export listo") ||
    document.body.innerText.includes("Exportación lista") ||
    document.body.innerText.includes("Exportación guardada")
  `);
  const exportLinks = await evaluate(client, `
    Array.from(document.querySelectorAll("a[download]")).map((a) => ({
      text: (a.textContent || "").trim(),
      download: a.getAttribute("download") || "",
      href: a.href || ""
    }))
  `);
  const exportControls = await evaluate(client, `
    Array.from(document.querySelectorAll("button,a")).map((el) => ({
      tag: el.tagName,
      text: (el.textContent || "").trim(),
      download: el.getAttribute("download") || "",
      disabled: Boolean(el.disabled)
    }))
  `);

  await navigate(client, "/hojas-ruta");
  const naInputs = await evaluate(client, `
    Array.from(document.querySelectorAll("input")).map((input) => input.value).filter((value) => /^NA$/i.test(value))
  `);
  const runtime = await runtimeAudit(client);

  client.close();

  const failures = [];
  for (const result of results) {
    if (result.blank) failures.push(`${result.route}: pantalla en blanco`);
    if (!result.ready) failures.push(`${result.route}: no alcanzo estado listo para auditoria`);
    if (result.loadingText) failures.push(`${result.route}: captura quedo en estado de carga`);
    if (result.errors.length) failures.push(`${result.route}: ${result.errors.join(" | ")}`);
  }
  for (const tab of dashboardTabs) {
    if (!tab.clicked) {
      failures.push(`Dashboard: no se capturo ${tab.label}${tab.reason ? ` (${tab.reason})` : ""}`);
    }
  }
  if (!dashboardCustomize.opened) {
    failures.push(`Dashboard: no se pudo abrir Personalizar (${dashboardCustomize.reason || "sin detalle"})`);
  }
  for (const panel of dashboardCustomize.panels || []) {
    if (!panel.clicked) {
      failures.push(`Dashboard Personalizar: no se capturo ${panel.label}`);
    }
  }
  if (!clicked) failures.push("Editor XLSForm: no se encontro el boton Exportar .xlsx habilitado");
  if (!exportReady) failures.push("Editor XLSForm: no llego al estado Export listo");
  const hasXlsxDownloadLink = exportLinks.some((link) => /\.xlsx$/i.test(link.download));
  const hasXlsxProjectControl = exportControls.some((control) =>
    !control.disabled && /Descargar\s*\.xlsx|Export listo|Exportacion guardada|Exportación guardada/i.test(control.text || "")
  );
  if (!hasXlsxDownloadLink && !hasXlsxProjectControl) {
    failures.push("Editor XLSForm: no hay control final para recuperar el .xlsx exportado");
  }
  if (naInputs.length) failures.push(`Hojas de ruta: inputs con valor NA (${naInputs.length})`);

  if (AUDIT_MANIFEST) {
    if (!runtime.sid) failures.push("Auditoria: no hay sid en localStorage");
    if (manifestBefore.sid && runtime.sid !== manifestBefore.sid) {
      failures.push(`Auditoria: sid no coincide (manifest=${manifestBefore.sid}, runtime=${runtime.sid})`);
    }
    const expectedProject = manifestBefore.project_path || "";
    const actualProject = runtime.project?.path || "";
    if (!runtime.project?.has_project) {
      failures.push("Auditoria: /api/project/status no reporta proyecto abierto");
    }
    if (expectedProject && actualProject && expectedProject !== actualProject) {
      failures.push(`Auditoria: project_path no coincide (manifest=${expectedProject}, runtime=${actualProject})`);
    }
    if (manifestBefore.port && Number(manifestBefore.port) !== Number(runtime.port)) {
      failures.push(`Auditoria: puerto no coincide (manifest=${manifestBefore.port}, runtime=${runtime.port})`);
    }
  }

  if (AUDIT_MANIFEST) {
    const manifestAfter = {
      ...manifestBefore,
      status: failures.length ? "smoke_failed" : "smoke_done",
      smoke_checked_at: new Date().toISOString(),
      smoke: {
        ok: failures.length === 0,
        runtime,
        routes: results,
        dashboardTabs,
        dashboardCustomize,
        exportLinks,
        exportControls,
        naInputs,
        failures
      },
      screenshots
    };
    writeJson(AUDIT_MANIFEST, manifestAfter);
  }

  console.log(JSON.stringify({ ok: failures.length === 0, routes: results, dashboardTabs, dashboardCustomize, exportLinks, exportControls, naInputs, runtime, screenshots, failures }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
