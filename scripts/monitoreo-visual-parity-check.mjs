#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const requireFromFrontend = createRequire(path.join(process.cwd(), "frontend", "package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const TERRITORIAL_TABS = [
  ["Fuente", "Formulario"],
  ["Fuente", "Filtro y distritos"],
  ["Fuente", "Encuestadores"],
  ["Fuente", "Reconciliación"],
  ["Fuente", "Historial"],
  ["UMPs", "Cobertura"],
  ["UMPs", "Manzanas"],
  ["Validación", "Geolocalización"],
  ["Validación", "Reconciliación UMP"],
  ["Validación", "Duración de tiempo"],
  ["Validación", "Cuotas"],
  ["Validación", "Anulación"],
  ["Consultas", "Registro"],
  ["Consultas", "GPS por revisar"],
  ["Consultas", "Duración por revisar"],
  ["Consultas", "Cruce responsable"],
  ["Consultas", "Subsanaciones"],
  ["Avance", "Resumen"],
  ["Avance", "Mapa y UMP"],
  ["Avance", "Ritmo diario"],
  ["Avance", "Salidas"],
  ["Ocurrencias", "Estados general"],
  ["Ocurrencias", "Por UMP"],
  ["Ocurrencias", "Observaciones"],
];

const ACREDITACION_TABS = [
  ["Fuentes", "Encuestas"],
  ["Fuentes", "Sheets"],
  ["Fuentes", "Fuentes activas"],
  ["Modelo", "Metas y modalidades"],
  ["Modelo", "Base de barrido"],
  ["Modelo", "Enlaces y envíos"],
  ["Modelo", "Estados válidos"],
  ["Modelo", "Calendario"],
  ["Consultas", "Casos"],
  ["Consultas", "Efectivas"],
  ["Consultas", "Faltantes"],
  ["Consultas", "Duplicados"],
  ["Consultas", "Diferencias"],
  ["Teléfono", "Resumen"],
  ["Teléfono", "Día"],
  ["Teléfono", "Responsables"],
  ["Teléfono", "Alertas"],
  ["Avance", "Resumen"],
  ["Avance", "Actores"],
  ["Avance", "Encuestas"],
  ["Avance", "Detalle"],
  ["Avance", "Salidas"],
];

function parseArgs(argv) {
  const opts = {
    profile: "territorial",
    project: "",
    session: process.env.PULSO_SESSION || "",
    url: "http://localhost:5176/",
    out: path.join("tmp", "visual-qa", "monitoreo-visual-parity"),
    timeoutMs: 240000,
    waitAfterReadyMs: 4000,
    maxTabs: 0,
    viewport: { width: 3000, height: 1100 },
    only: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--profile") opts.profile = next();
    else if (arg === "--project") opts.project = next();
    else if (arg === "--session") opts.session = next();
    else if (arg === "--url") opts.url = next();
    else if (arg === "--out") opts.out = next();
    else if (arg === "--timeout-ms") opts.timeoutMs = Number(next());
    else if (arg === "--wait-after-ready-ms") opts.waitAfterReadyMs = Number(next());
    else if (arg === "--max-tabs") opts.maxTabs = Number(next());
    else if (arg === "--viewport") opts.viewport = parseViewport(next());
    else if (arg === "--only") opts.only.push(next());
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  if (!["territorial", "acreditacion"].includes(opts.profile)) throw new Error("--profile debe ser territorial o acreditacion");
  if (!opts.project) throw new Error("--project es obligatorio");
  opts.project = path.resolve(opts.project);
  opts.session = String(opts.session || "").trim();
  opts.url = normalizeBaseUrl(opts.url);
  return opts;
}

function printHelp() {
  console.log(`
Uso:
node scripts/monitoreo-visual-parity-check.mjs \\
  --profile territorial \\
  --project "/ruta/ACNURCG.pulso" \\
  --session "<sid-abierto-opcional>" \\
  --url http://localhost:5176/ \\
  --out tmp/visual-qa/territorial-parity

Captura el comparador canonico vs modular en orden seccion/pestana.
Usa --only "Avance/Mapa y UMP" para repetir una pestaña concreta.
Si pasas --session, el navegador usa esa sesión y no reabre el .pulso vía devPulso.
No declara paridad automaticamente: produce PNGs y report.json para revision.
`);
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Viewport invalido: ${value}. Usa WIDTHxHEIGHT.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tab";
}

function tabFilterKey(view, tab) {
  return slug(`${view}/${tab}`);
}

function selectTabs(tabs, opts) {
  let selected = tabs.map(([view, tab], index) => ({ index: index + 1, view, tab }));
  if (opts.only.length) {
    const only = new Set(opts.only.map((value) => slug(value)));
    selected = selected.filter((item) => (
      only.has(tabFilterKey(item.view, item.tab))
      || only.has(slug(item.tab))
      || only.has(slug(item.view))
    ));
    if (!selected.length) {
      throw new Error(`--only no coincide con ninguna pestaña: ${opts.only.join(", ")}`);
    }
  } else if (opts.maxTabs > 0) {
    selected = selected.slice(0, opts.maxTabs);
  }
  return selected;
}

function comparisonPath(profile) {
  return profile === "acreditacion" ? "/monitoreo/comparar-acreditacion" : "/monitoreo/comparar-territorial";
}

function comparisonUrl(opts, view, tab) {
  const url = new URL(comparisonPath(opts.profile), `${opts.url}/`);
  if (!opts.session) url.searchParams.set("devPulso", opts.project);
  url.searchParams.set("compareView", view);
  url.searchParams.set("compareTab", tab);
  return url.toString();
}

function loadingReason(text) {
  const patterns = [
    /Preparando vista/i,
    /Preparando datos/i,
    /Preparando consultas/i,
    /Preparando UMPs/i,
    /Preparando validaci[oó]n/i,
    /Preparando avance/i,
    /Preparando ocurrencias/i,
    /Leyendo cache local/i,
    /Cargando monitoreo/i,
    /Preparando monitoreo/i,
    /Cargando datos/i,
    /Cargando consultas/i,
    /Cargando UMPs/i,
    /Cargando manzanas/i,
    /Cargando cartograf[ií]a/i,
    /Cartograf[ií]a de Hojas de Ruta/i,
    /Cargando calles/i,
    /Cargando GPS/i,
    /Cambios sin guardar/i,
    /Resumen pendiente/i,
    /Todav[ií]a no hay reporte local preparado/i,
    /CORTE SIN CORTE/i,
    /ACTIVAS 0\/0/i,
    /REGISTROS 0/i,
  ];
  return patterns.find((pattern) => pattern.test(text))?.source || "";
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function textMatches(text, label) {
  return normalizeLabel(text).includes(normalizeLabel(label));
}

function targetHydrationLabel(value) {
  const key = normalizeLabel(value);
  if (key === "telefono" || key === "telefonico") return "Teléfono";
  if (key === "dia") return "Día";
  return String(value || "");
}

function positiveMetric(text, patterns) {
  return patterns.some((pattern) => {
    const match = text.match(pattern);
    if (!match) return false;
    const raw = String(match[1] || "").replace(/[,.]/g, "");
    return Number(raw) > 0;
  });
}

function hydrationForFrame(text, target) {
  const blockers = [];
  if (/Selecciona un proyecto|Sin proyecto/i.test(text)) blockers.push("Proyecto sin sesión");
  if (loadingReason(text)) blockers.push("Loader visible");
  if (/Resumen pendiente|Todav[ií]a no hay reporte local preparado/i.test(text)) blockers.push("Resumen pendiente");
  if (/ACTIVAS 0\/0/i.test(text)) blockers.push("Fuentes activas 0/0");
  if (/CORTE SIN CORTE/i.test(text)) blockers.push("Corte sin preparar");

  const viewLabel = targetHydrationLabel(target.view);
  const tabLabel = targetHydrationLabel(target.tab);
  if (viewLabel && !textMatches(text, viewLabel) && !(viewLabel === "Teléfono" && /Monitoreo telef[oó]nico|Barrido telef[oó]nico/i.test(text))) {
    blockers.push(`Sección ${viewLabel} no activa`);
  }
  if (tabLabel && !textMatches(text, tabLabel) && !(tabLabel === "Día" && /Ritmo diario|Avance diario/i.test(text))) {
    blockers.push(`Pestaña ${tabLabel} no activa`);
  }

  const phoneTarget = viewLabel === "Teléfono";
  if (phoneTarget) {
    if (/Sin monitoreo telef[oó]nico|Sin hoja de barrido/i.test(text)) blockers.push("Telefonico sin reporte");
    if (!/Monitoreo telef[oó]nico|Barrido telef[oó]nico|Operaci[oó]n telef[oó]nica/i.test(text)) blockers.push("Telefonico no visible");
    const hasPhoneData = positiveMetric(text, [
      /BLOQUES TEL\.\s*([0-9.,]+)/i,
      /EFECTIVAS TEL\.\s*([0-9.,]+)/i,
      /([0-9.,]+)\s+personas en la base telef/i,
      /([0-9.,]+)\s+barridos/i,
    ]);
    if (!hasPhoneData) blockers.push("Telefonico sin métricas positivas");
    if (tabLabel === "Día") {
      const hasDaily = /Ritmo diario|Avance diario|Total diario|Fecha\s+Casos/i.test(text)
        && positiveMetric(text, [
          /EFECTIVAS\s*([0-9.,]+)/i,
          /([0-9.,]+)\s+d[ií]as? con/i,
          /Total diario\s*([0-9.,]+)/i,
        ]);
      if (!hasDaily) blockers.push("Serie diaria no hidratada");
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

async function frameSummaries(page) {
  const summaries = [];
  for (const frame of page.frames()) {
    const frameUrl = frame.url();
    if (!frameUrl.includes("/monitoreo?")) continue;
    await suppressProjectLifecycleDialog(frame);
    const text = await frame.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    const normalized = text.replace(/\s+/g, " ").trim();
    summaries.push({
      url: frameUrl,
      loading_reason: loadingReason(normalized),
      hydration: hydrationForFrame(normalized, page.__monitoreoTarget ?? { view: "", tab: "" }),
      text_sample: normalized.slice(0, 1400),
    });
  }
  return summaries;
}

async function suppressProjectLifecycleDialog(frame) {
  await frame.evaluate(() => {
    const id = "monitoreo-visual-qa-hide-project-dialog";
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `
      .pulso-project-confirm-scrim {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
  }).catch(() => undefined);
}

async function dismissPendingChangesDialogs(page) {
  for (const frame of page.frames()) {
    const frameUrl = frame.url();
    if (!frameUrl.includes("/monitoreo?")) continue;
    await suppressProjectLifecycleDialog(frame);
    const text = await frame.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (!/Cambios sin guardar/i.test(text)) continue;
    await frame.locator(".pulso-project-confirm button[aria-label='Cancelar']").first().click({ force: true, timeout: 1500 }).catch(() => undefined);
    await frame.locator(".pulso-project-confirm-actions button", { hasText: /^Cancelar$/i }).first().click({ force: true, timeout: 1500 }).catch(() => undefined);
    await frame.locator("body").press("Escape", { timeout: 1000 }).catch(() => undefined);
    await frame.evaluate(() => {
      const dialog = document.querySelector(".pulso-project-confirm");
      if (!dialog) return;
      const cancelByLabel = dialog.querySelector("button[aria-label='Cancelar']");
      if (cancelByLabel instanceof HTMLButtonElement) {
        cancelByLabel.click();
        return;
      }
      const buttons = Array.from(dialog.querySelectorAll("button"));
      const cancelButton = buttons.find((button) => button.textContent?.trim() === "Cancelar");
      if (cancelButton instanceof HTMLButtonElement) cancelButton.click();
    }).catch(() => undefined);
  }
}

async function waitForComparisonReady(page, timeoutMs, target) {
  const started = performance.now();
  page.__monitoreoTarget = target;
  while (performance.now() - started < timeoutMs) {
    await dismissPendingChangesDialogs(page);
    const frames = await frameSummaries(page);
    if (frames.length >= 2 && frames.every((frame) => frame.hydration.ready)) {
      return { ready: true, wait_ms: Math.round(performance.now() - started), frames };
    }
    await sleep(1000);
  }
  return {
    ready: false,
    wait_ms: Math.round(performance.now() - started),
    frames: await frameSummaries(page),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tabs = opts.profile === "acreditacion" ? ACREDITACION_TABS : TERRITORIAL_TABS;
  const selectedTabs = selectTabs(tabs, opts);
  await fs.mkdir(opts.out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: opts.viewport });
  await context.addInitScript(({ session }) => {
    window.localStorage.setItem("pulso.layoutPreset", "auto");
    window.localStorage.setItem("pulso.visualQaWarmup", "1");
    window.localStorage.setItem("pulso.visualQaWarmupModuleIds", "monitoreo");
    if (session) window.localStorage.setItem("pulso.sessionId", session);
  }, { session: opts.session });
  const results = [];
  for (const [captureIndex, { index, view, tab }] of selectedTabs.entries()) {
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error).slice(0, 800)));
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      const text = message.text();
      if (/React Router Future Flag/.test(text)) return;
      consoleErrors.push(text.slice(0, 800));
    });
    const label = `${view}/${tab}`;
    const filename = `${String(index).padStart(2, "0")}-${slug(label)}.png`;
    const screenshot = path.join(opts.out, filename);
    const url = comparisonUrl(opts, view, tab);
    page.__monitoreoTarget = { view, tab };
    const started = performance.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    const ready = await waitForComparisonReady(page, opts.timeoutMs, { view, tab });
    await sleep(opts.waitAfterReadyMs);
    await dismissPendingChangesDialogs(page);
    await sleep(750);
    await dismissPendingChangesDialogs(page);
    const finalFrames = await frameSummaries(page);
    await page.screenshot({ path: screenshot, fullPage: false });
    const isReady = ready.ready && finalFrames.length >= 2 && finalFrames.every((frame) => frame.hydration.ready);
    results.push({
      index: index + 1,
      label,
      view,
      tab,
      url,
      screenshot,
      ready: isReady,
      wait_ms: ready.wait_ms,
      total_ms: Math.round(performance.now() - started),
      frame_count: finalFrames.length || ready.frames.length,
      frames: finalFrames.length ? finalFrames : ready.frames,
      page_errors: pageErrors,
      console_errors: consoleErrors,
    });
    await page.close();
    console.log(`${String(captureIndex + 1).padStart(2, "0")}/${selectedTabs.length} ${isReady ? "ready" : "timeout"} ${label} -> ${screenshot}`);
  }
  await browser.close();
  const report = {
    generated_at: new Date().toISOString(),
    profile: opts.profile,
    project: opts.project,
    session: opts.session || null,
    url: opts.url,
    viewport: opts.viewport,
    captured: results.length,
    ready: results.filter((item) => item.ready).length,
    results,
  };
  await fs.writeFile(path.join(opts.out, "report.json"), JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
