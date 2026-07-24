#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

const DEFAULT_URL = process.env.QA_URL || "http://localhost:5173/";
const DEFAULT_API = process.env.QA_API || "auto";
const DEFAULT_OUT = process.env.QA_OUT || path.join("outputs", "visual-qa", timestampSlug());
const DEFAULT_TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS || "15000");

function parseArgs(argv) {
  const out = {
    url: DEFAULT_URL,
    api: DEFAULT_API,
    out: DEFAULT_OUT,
    route: "",
    project: process.env.PULSO || "",
    session: process.env.PULSO_SESSION || "",
    name: "screen",
    layoutPreset: process.env.QA_LAYOUT_PRESET || "auto",
    waitSelector: "[data-audit-ready]",
    reloadEngine: true,
    failOnIssues: false,
    headed: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    viewport: [{ width: 1440, height: 1000 }],
    clickTabs: [],
    expectText: [],
    forbidText: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--url") out.url = next();
    else if (arg === "--api") out.api = next();
    else if (arg === "--out") out.out = next();
    else if (arg === "--route") out.route = next();
    else if (arg === "--project") out.project = next();
    else if (arg === "--session") out.session = next();
    else if (arg === "--name") out.name = next();
    else if (arg === "--layout-preset" || arg === "--preset") out.layoutPreset = next();
    else if (arg === "--wait-selector") out.waitSelector = next();
    else if (arg === "--click-tab") out.clickTabs.push(next());
    else if (arg === "--expect-text") out.expectText.push(next());
    else if (arg === "--forbid-text") out.forbidText.push(next());
    else if (arg === "--viewport") out.viewport.push(parseViewport(next()));
    else if (arg === "--only-viewport") out.viewport = [parseViewport(next())];
    else if (arg === "--timeout-ms") out.timeoutMs = Number(next());
    else if (arg === "--no-reload-engine") out.reloadEngine = false;
    else if (arg === "--fail-on-issues") out.failOnIssues = true;
    else if (arg === "--headed") out.headed = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  out.viewport = dedupeViewports(out.viewport);
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) {
    throw new Error(`Timeout inválido: ${out.timeoutMs}`);
  }
  if (!["auto", "large", "portable", "portable-compact", "compact", "short"].includes(out.layoutPreset)) {
    throw new Error(`Preset inválido: ${out.layoutPreset}. Usa auto, large, portable, portable-compact, compact o short.`);
  }
  return out;
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Viewport inválido: ${value}. Usa WIDTHxHEIGHT, por ejemplo 1440x1000.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function dedupeViewports(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.width}x${item.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printHelp() {
  console.log(`
Uso:
  node scripts/visual-qa.mjs --url http://localhost:5173/monitoreo --api auto --project /ruta/proyecto.pulso

Opciones principales:
  --api auto              Usa el mismo origen del frontend y su proxy /api.
  --project PATH          Abre el .pulso en una sesión aislada de QA.
  --session SID           Usa una sesión ya existente.
  --reload-engine         Activo por defecto: POST /api/system/reload-engine antes de abrir proyecto.
  --no-reload-engine      Omite hot reload del motor R.
  --click-tab TEXT        Abre una pestaña por nombre antes de capturar. Puede repetirse.
  --viewport 390x844      Agrega viewport. Puede repetirse.
  --only-viewport 1440x900 Usa solo ese viewport.
  --layout-preset NAME     Siembra pulso.layoutPreset: auto, large, portable, portable-compact, compact o short.
  --timeout-ms N          Timeout por request y navegación. Default: ${DEFAULT_TIMEOUT_MS}.
  --expect-text TEXT      Falla el reporte si no aparece el texto.
  --forbid-text TEXT      Falla el reporte si aparece el texto.
  --fail-on-issues        Sale con código 1 si detecta clipping/overflow/text checks fallidos.
`);
}

async function apiRequest(base, endpoint, { method = "GET", session = "", body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = new URL(endpoint, normalizeBase(base));
  const headers = {};
  if (session) headers["X-Pulso-Session"] = session;
  if (body != null) headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  let text;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
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

function normalizeBase(base) {
  const out = String(base);
  return out.endsWith("/") ? out : `${out}/`;
}

function resolveApiBase(opts) {
  if (!opts.api || opts.api === "auto") return new URL(resolveTargetUrl(opts)).origin;
  return opts.api;
}

function stringOrEmpty(value) {
  return typeof value === "string" && value.length > 0 ? value : "";
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
    page.getByRole("link", { name: startsWithPattern }).first(),
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

async function prepareSession(opts) {
  const api = resolveApiBase(opts);
  const setup = {
    api,
    apiMode: opts.api,
    health: null,
    reload: null,
    projectOpen: null,
    session: opts.session || "",
  };
  setup.health = await apiRequest(api, "/api/system/health", { timeoutMs: opts.timeoutMs }).catch((error) => ({
    ok: false,
    error: String(error?.message || error),
  }));

  if (opts.reloadEngine) {
    setup.reload = await apiRequest(api, "/api/system/reload-engine", {
      method: "POST",
      session: setup.session,
      timeoutMs: opts.timeoutMs,
    }).catch((error) => ({ ok: false, error: String(error?.message || error) }));
  }

  if (!setup.session) {
    const bootstrap = await apiRequest(api, "/api/system/bootstrap", { timeoutMs: opts.timeoutMs }).catch(() => null);
    setup.session = stringOrEmpty(bootstrap?.json?.sid);
  }

  if (opts.project) {
    if (!setup.session) {
      const created = await apiRequest(api, "/api/session?fresh=1", { method: "POST", timeoutMs: opts.timeoutMs });
      setup.session = stringOrEmpty(created.headers["x-pulso-session"]) || stringOrEmpty(created.json?.session_id);
    }
    setup.projectOpen = await apiRequest(api, "/api/project/open", {
      method: "POST",
      session: setup.session,
      body: { path: opts.project, in_place: true },
      timeoutMs: opts.timeoutMs,
    });
    if (!setup.projectOpen?.ok) {
      throw new Error(`No se pudo abrir el .pulso para QA: HTTP ${setup.projectOpen?.status ?? "?"} ${setup.projectOpen?.text ?? ""}`);
    }
    setup.session = stringOrEmpty(setup.projectOpen?.json?.session_id) || setup.session;
  }

  return setup;
}

function resolveTargetUrl(opts) {
  const url = new URL(opts.url);
  if (opts.route) {
    url.pathname = opts.route.startsWith("/") ? opts.route : `/${opts.route}`;
  }
  return url.toString();
}

async function runViewport(opts, setup, viewport) {
  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ sessionId, layoutPreset }) => {
    if (layoutPreset) window.localStorage.setItem("pulso.layoutPreset", layoutPreset);
    if (sessionId) {
      window.localStorage.setItem("pulso.sessionId", sessionId);
    }
  }, { sessionId: setup.session, layoutPreset: opts.layoutPreset });
  const page = await context.newPage();
  const targetUrl = resolveTargetUrl(opts);
  const viewportName = `${viewport.width}x${viewport.height}`;
  const screenshotPath = path.join(opts.out, `${opts.name}-${viewportName}.png`);
  const fullScreenshotPath = path.join(opts.out, `${opts.name}-${viewportName}-full.png`);

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: opts.timeoutMs }).catch(() => {});
  for (const tab of opts.clickTabs) {
    await clickNamedControl(page, tab, opts.timeoutMs);
    await page.waitForLoadState("networkidle", { timeout: opts.timeoutMs }).catch(() => {});
    await page.waitForTimeout(350);
  }
  let waitSelectorMatched = true;
  if (opts.waitSelector) {
    waitSelectorMatched = await page.locator(opts.waitSelector).first()
      .waitFor({ state: "attached", timeout: opts.timeoutMs })
      .then(() => true)
      .catch(() => false);
  }
  await page.screenshot({ path: screenshotPath });
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });

  const dom = await page.evaluate(({ expectText, forbidText }) => {
    const text = document.body?.innerText || "";
    const checks = [
      ...expectText.map((value) => ({ kind: "expect-text", value, ok: text.includes(value) })),
      ...forbidText.map((value) => ({ kind: "forbid-text", value, ok: !text.includes(value) })),
    ];
    const issueSelector = [
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
      "[class*='card']",
      "[class*='panel']",
      "[class*='popover']",
      "[class*='modal']",
    ].join(",");
    const elements = Array.from(document.querySelectorAll(issueSelector));
    const issues = [];
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
      if (!visible) continue;
      const overflowXAllowed = ["auto", "scroll"].includes(style.overflowX);
      const overflowYAllowed = ["auto", "scroll"].includes(style.overflowY);
      const xOverflow = el.scrollWidth > el.clientWidth + 2 && !overflowXAllowed;
      const yOverflow = el.scrollHeight > el.clientHeight + 2 && !overflowYAllowed;
      if (!xOverflow && !yOverflow) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140);
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
    return {
      title: document.title,
      url: location.href,
      activeLayout: {
        preset: document.documentElement.dataset.pulsoLayoutPreset || null,
        density: document.documentElement.dataset.pulsoLayoutDensity || null,
        mode: document.documentElement.dataset.pulsoLayoutMode || null,
      },
      ready: Array.from(document.querySelectorAll("[data-audit-ready]")).map((el) => el.getAttribute("data-audit-ready")),
      checks,
      issues,
    };
  }, { expectText: opts.expectText, forbidText: opts.forbidText });

  await browser.close();
  return {
    viewport,
    waitSelectorMatched,
    screenshot: screenshotPath,
    fullScreenshot: fullScreenshotPath,
    ...dom,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await fs.mkdir(opts.out, { recursive: true });
  const setup = await prepareSession(opts);
  const viewports = [];
  for (const viewport of opts.viewport) {
    viewports.push(await runViewport(opts, setup, viewport));
  }
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    options: {
      url: opts.url,
      api: opts.api,
      resolvedApi: setup.api,
      project: opts.project || null,
      session: setup.session || null,
      reloadEngine: opts.reloadEngine,
      layoutPreset: opts.layoutPreset,
      waitSelector: opts.waitSelector,
      clickTabs: opts.clickTabs,
    },
    setup,
    viewports,
  };
  const failedChecks = viewports.flatMap((item) => item.checks.filter((check) => !check.ok));
  const visualIssues = viewports.flatMap((item) => item.issues);
  const waitSelectorMisses = viewports.filter((item) => !item.waitSelectorMatched).length;
  report.ok = failedChecks.length === 0 && visualIssues.length === 0 && waitSelectorMisses === 0;
  report.summary = {
    screenshots: viewports.flatMap((item) => [item.screenshot, item.fullScreenshot]),
    failedChecks: failedChecks.length,
    visualIssues: visualIssues.length,
    waitSelectorMisses,
  };
  const reportPath = path.join(opts.out, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`[visual-qa] report: ${reportPath}`);
  for (const shot of report.summary.screenshots) console.log(`[visual-qa] screenshot: ${shot}`);
  if (!report.ok) {
    console.log(
      `[visual-qa] failedChecks=${failedChecks.length} visualIssues=${visualIssues.length} waitSelectorMisses=${waitSelectorMisses}`,
    );
    if (opts.failOnIssues) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[visual-qa] ${error?.stack || error}`);
  process.exit(1);
});
