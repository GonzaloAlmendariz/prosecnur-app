#!/usr/bin/env node

const CDP_LIST_URL = process.env.SMOKE_CDP_URL || "http://127.0.0.1:9334/json/list";
const ROUTES = ["/", "/procesamiento", "/carga", "/validacion", "/codificacion", "/analitica", "/graficos", "/tablero", "/hojas-ruta", "/editor-xlsform"];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function waitFor(client, expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(client, expression);
    if (ok) return true;
    await delay(400);
  }
  return false;
}

async function main() {
  const wsUrl = await cdpTarget();
  const client = await CdpClient.connect(wsUrl);
  const errors = [];
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
    const textLength = await evaluate(client, "document.body.innerText.trim().length");
    const blank = Number(textLength || 0) < 10;
    const routeErrors = errors.slice(beforeErrors);
    results.push({ route, blank, errors: routeErrors });
  }

  await navigate(client, "/editor-xlsform");
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
          return text === "Continuar editando" || text === "Empezar de cero";
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

  await navigate(client, "/hojas-ruta");
  const naInputs = await evaluate(client, `
    Array.from(document.querySelectorAll("input")).map((input) => input.value).filter((value) => /^NA$/i.test(value))
  `);

  client.close();

  const failures = [];
  for (const result of results) {
    if (result.blank) failures.push(`${result.route}: pantalla en blanco`);
    if (result.errors.length) failures.push(`${result.route}: ${result.errors.join(" | ")}`);
  }
  if (!clicked) failures.push("Editor XLSForm: no se encontro el boton Exportar .xlsx habilitado");
  if (!exportReady) failures.push("Editor XLSForm: no llego al estado Export listo");
  if (!exportLinks.some((link) => /\.xlsx$/i.test(link.download))) {
    failures.push("Editor XLSForm: no hay link descargable .xlsx con atributo download");
  }
  if (naInputs.length) failures.push(`Hojas de ruta: inputs con valor NA (${naInputs.length})`);

  console.log(JSON.stringify({ ok: failures.length === 0, routes: results, exportLinks, naInputs, failures }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
