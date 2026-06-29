#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const requireFromFrontend = createRequire(path.join(process.cwd(), "frontend", "package.json"));
const { chromium } = requireFromFrontend("@playwright/test");

const DEFAULT_OUT = path.join("tmp", "perf", "monitoreo-performance");
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_PROBE_TIMEOUT_MS = 60000;
const DEFAULT_TAB_PROBE_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const opts = {
    projectTerritorial: "",
    projectAcreditacion: "",
    projectAulas: "",
    projectTelefonico: "",
    url: "http://127.0.0.1:5174/",
    apiUrl: "http://127.0.0.1:8788",
    out: DEFAULT_OUT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    probeTimeoutMs: DEFAULT_PROBE_TIMEOUT_MS,
    tabProbeTimeoutMs: DEFAULT_TAB_PROBE_TIMEOUT_MS,
    tabScope: "critical",
    entryMode: "session",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--project-territorial") opts.projectTerritorial = next();
    else if (arg === "--project-acreditacion") opts.projectAcreditacion = next();
    else if (arg === "--project-aulas") opts.projectAulas = next();
    else if (arg === "--project-telefonico") opts.projectTelefonico = next();
    else if (arg === "--url") opts.url = next();
    else if (arg === "--api-url") opts.apiUrl = next();
    else if (arg === "--out") opts.out = next();
    else if (arg === "--timeout-ms") opts.timeoutMs = Number(next()) || DEFAULT_TIMEOUT_MS;
    else if (arg === "--probe-timeout-ms") opts.probeTimeoutMs = Number(next()) || DEFAULT_PROBE_TIMEOUT_MS;
    else if (arg === "--tab-probe-timeout-ms") opts.tabProbeTimeoutMs = Number(next()) || DEFAULT_TAB_PROBE_TIMEOUT_MS;
    else if (arg === "--tab-scope") {
      const value = next();
      opts.tabScope = value === "all" ? "all" : "critical";
    }
    else if (arg === "--entry-mode") {
      const value = next();
      opts.entryMode = value === "bootgate" ? "bootgate" : "session";
    }
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
  }
  return opts;
}

function usage() {
  console.log(`Uso:
node scripts/monitoreo-performance-check.mjs \\
  --project-territorial "/ruta/territorial.pulso" \\
  --project-acreditacion "/ruta/acreditacion.pulso" \\
  --project-aulas "/ruta/aulas.pulso" \\
  --project-telefonico "/ruta/telefonico.pulso" \\
  --url http://127.0.0.1:5174/ \\
  --api-url http://127.0.0.1:8788 \\
  --out tmp/perf/monitoreo-performance \\
  --probe-timeout-ms 60000 \\
  --entry-mode session|bootgate \\
  --tab-scope critical|all \\
  --tab-probe-timeout-ms 15000`);
}

function nowMs(start) {
  return Math.max(0, Math.round(performance.now() - start));
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function routeUrl(base, route) {
  const url = new URL(route.replace(/^\//, ""), `${normalizeBaseUrl(base)}/`);
  return url.toString();
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function apiRequest(apiUrl, endpoint, { session = "", method = "GET", body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${normalizeBaseUrl(apiUrl)}${endpoint}`, {
      method,
      headers: {
        ...(session ? { "X-Pulso-Session": session } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
      session: res.headers.get("x-pulso-session") || session,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function createSession(apiUrl, timeoutMs) {
  const res = await apiRequest(apiUrl, "/api/session?fresh=1", { method: "POST", timeoutMs });
  if (!res.ok) throw new Error(`No se pudo crear sesion: HTTP ${res.status} ${res.text}`);
  return res.session || res.json?.session_id || "";
}

async function openProject(apiUrl, project, session, timeoutMs) {
  const started = performance.now();
  const res = await apiRequest(apiUrl, "/api/project/open", {
    session,
    method: "POST",
    body: { path: project, in_place: true },
    timeoutMs,
  });
  if (!res.ok) throw new Error(`No se pudo abrir ${project}: HTTP ${res.status} ${res.text}`);
  return { session: res.session || res.json?.session_id || session, ms: nowMs(started), response: res.json };
}

async function waitForJob(apiUrl, jobId, session, timeoutMs) {
  const started = performance.now();
  let last = null;
  while (nowMs(started) < timeoutMs) {
    const res = await apiRequest(apiUrl, `/api/jobs/${encodeURIComponent(jobId)}`, { session, timeoutMs: Math.min(timeoutMs, 15000) });
    last = res.json;
    if (!res.ok) return { ms: nowMs(started), status: "http_error", snapshot: last };
    if (["done", "error", "cancelled"].includes(String(last?.status))) {
      return { ms: nowMs(started), status: last.status, snapshot: last };
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return { ms: nowMs(started), status: "timeout", snapshot: last };
}

async function runWarmup(apiUrl, session, profile, timeoutMs) {
  const modules = profile === "territorial"
    ? ["project", "monitoreo", "monitoreo_territorial"]
    : ["project", "monitoreo"];
  const started = performance.now();
  const res = await apiRequest(apiUrl, "/api/project/warmup", {
    session,
    method: "POST",
    body: { mode: "full", budget_ms: Math.min(timeoutMs, 320000), modules },
    timeoutMs,
  });
  if (!res.ok || !res.json?.job_id) {
    return { ms: nowMs(started), status: "start_error", response: res.json || res.text };
  }
  const job = await waitForJob(apiUrl, res.json.job_id, session, timeoutMs);
  return { ms: nowMs(started), ...job };
}

function summarizeRequests(requests) {
  const stateRequests = requests.filter((item) => item.path.includes("/api/monitoreo/state"));
  const keyCounts = new Map();
  for (const item of stateRequests) {
    keyCounts.set(item.path, (keyCounts.get(item.path) || 0) + 1);
  }
  return {
    total: requests.length,
    monitoreo_state: stateRequests.length,
    duplicates: Array.from(keyCounts.entries()).filter(([, count]) => count > 1).map(([key, count]) => ({ key, count })),
    full_scope_used: stateRequests.some((item) => new URL(item.url).searchParams.get("report_scope") === "full"),
    scopes: stateRequests.map((item) => ({
      include_reports: new URL(item.url).searchParams.get("include_reports"),
      report_scope: new URL(item.url).searchParams.get("report_scope") || "default",
    })),
    state_details: stateRequests.map((item) => ({
      method: item.method,
      path: item.path,
      status: item.status ?? null,
      started_ms: item.started_ms ?? null,
      duration_ms: item.duration_ms ?? null,
      failed: item.failed ?? "",
    })),
    paths: requests.map((item) => item.path),
  };
}

async function clickByText(page, text, timeout = 5000) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout });
  await locator.click();
}

async function scrollSelectorToStart(page, selector, timeout = 5000) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout }).catch(() => null);
  await page.evaluate((targetSelector) => {
    const node = document.querySelector(targetSelector);
    if (node instanceof Element) node.scrollIntoView({ block: "start", inline: "nearest" });
  }, selector).catch(() => null);
}

function filenameSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tab";
}

const DEFAULT_LOADING_SELECTORS = [
  ".mon-shell-fallback",
  ".mon-shell-error",
  ".mon-territorial-loading",
  ".mon-territorial-route-map-loading",
  ".pulso-spin",
];

const PROFILE_COVERAGE = {
  territorial: {
    declaredViews: ["Fuente", "UMPs", "Validacion", "Consultas", "Avance", "Ocurrencias"],
    declaredTabs: [
      "Fuente/Formulario",
      "Fuente/Filtro y distritos",
      "Fuente/Encuestadores",
      "Fuente/Reconciliacion",
      "Fuente/Historial",
      "UMPs/Cobertura",
      "UMPs/Manzanas",
      "Validacion/Geolocalizacion",
      "Validacion/Reconciliacion UMP",
      "Validacion/Duracion de tiempo",
      "Validacion/Cuotas",
      "Validacion/Anulacion",
      "Consultas/Registro",
      "Consultas/GPS por revisar",
      "Consultas/Duracion por revisar",
      "Consultas/Cruce responsable",
      "Consultas/Subsanaciones",
      "Avance/Resumen",
      "Avance/Mapa y UMP",
      "Avance/Ritmo diario",
      "Avance/Salidas",
      "Ocurrencias/Estados general",
      "Ocurrencias/Por UMP",
      "Ocurrencias/Observaciones",
    ],
    measuredTabs: [
      "Fuente/Formulario",
      "Avance/Resumen",
      "Avance/Mapa y UMP",
    ],
  },
  acreditacion: {
    declaredViews: ["Fuentes", "Modelo", "Consultas", "Telefono", "Avance"],
    declaredTabs: [
      "Fuentes/Encuestas",
      "Fuentes/Sheets",
      "Fuentes/Fuentes activas",
      "Modelo/Metas y modalidades",
      "Modelo/Base de barrido",
      "Modelo/Enlaces y envios",
      "Modelo/Estados validos",
      "Modelo/Calendario",
      "Consultas/Casos",
      "Consultas/Efectivas",
      "Consultas/Faltantes",
      "Consultas/Duplicados",
      "Consultas/Diferencias",
      "Telefono/Resumen",
      "Telefono/Dia",
      "Telefono/Responsables",
      "Telefono/Alertas",
      "Avance/Resumen",
      "Avance/Actores",
      "Avance/Encuestas",
      "Avance/Detalle",
      "Avance/Salidas",
    ],
    measuredTabs: [
      "Fuentes/Encuestas",
      "Avance/Resumen",
      "Avance/Detalle",
    ],
  },
  aulas_universitarias: {
    declaredViews: ["Avance", "Agenda", "Validación", "Consultas", "Fuentes"],
    declaredTabs: [
      "Avance/Resumen",
      "Agenda/Aulas",
      "Validación/Alertas",
      "Consultas/Brechas",
      "Fuentes/Plan",
    ],
    measuredTabs: [
      "Avance/Resumen",
      "Agenda/Aulas",
      "Validacion/Alertas",
    ],
  },
  telefonico: {
    declaredViews: ["Telefono", "Fuentes", "Modelo", "Avance", "Consultas"],
    declaredTabs: [
      "Telefono/Resumen",
      "Telefono/Dia",
      "Telefono/Responsables",
      "Telefono/Alertas",
      "Fuentes/Encuestas",
      "Modelo/Base de barrido",
      "Avance/Resumen",
      "Consultas/Casos",
    ],
    measuredTabs: [
      "Telefono/Resumen",
      "Telefono/Responsables",
      "Avance/Resumen",
    ],
  },
};

const PROFILE_TAB_PLANS = {
  territorial: [
    { view: "fuentes", viewLabel: "Fuente", key: "form", label: "Formulario" },
    { view: "fuentes", viewLabel: "Fuente", key: "filter", label: "Filtro y distritos" },
    { view: "fuentes", viewLabel: "Fuente", key: "roster", label: "Encuestadores" },
    { view: "fuentes", viewLabel: "Fuente", key: "reconciliation", label: "Reconciliacion" },
    { view: "fuentes", viewLabel: "Fuente", key: "history", label: "Historial" },
    { view: "modelo", viewLabel: "UMPs", key: "resumen", label: "Cobertura" },
    { view: "modelo", viewLabel: "UMPs", key: "tabla", label: "Manzanas" },
    { view: "calidad", viewLabel: "Validacion", key: "geolocalizacion", label: "Geolocalizacion" },
    { view: "calidad", viewLabel: "Validacion", key: "reconciliacion", label: "Reconciliacion UMP" },
    { view: "calidad", viewLabel: "Validacion", key: "duracion", label: "Duracion de tiempo" },
    { view: "calidad", viewLabel: "Validacion", key: "cuotas", label: "Cuotas" },
    { view: "calidad", viewLabel: "Validacion", key: "anulacion", label: "Anulacion" },
    { view: "consultas", viewLabel: "Consultas", key: "registro", label: "Registro" },
    { view: "consultas", viewLabel: "Consultas", key: "gps", label: "GPS por revisar" },
    { view: "consultas", viewLabel: "Consultas", key: "duracion", label: "Duracion por revisar" },
    { view: "consultas", viewLabel: "Consultas", key: "responsable", label: "Cruce responsable" },
    { view: "consultas", viewLabel: "Consultas", key: "subsanaciones", label: "Subsanaciones" },
    { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" },
    { view: "avance", viewLabel: "Avance", key: "ump", label: "Mapa y UMP" },
    { view: "avance", viewLabel: "Avance", key: "ritmo", label: "Ritmo diario" },
    { view: "avance", viewLabel: "Avance", key: "salidas", label: "Salidas" },
    { view: "ocurrencias", viewLabel: "Ocurrencias", key: "states", label: "Estados general" },
    { view: "ocurrencias", viewLabel: "Ocurrencias", key: "ump", label: "Por UMP" },
    { view: "ocurrencias", viewLabel: "Ocurrencias", key: "alerts", label: "Observaciones" },
  ],
  acreditacion: [
    { view: "fuentes", viewLabel: "Fuentes", key: "survey", label: "Encuestas" },
    { view: "fuentes", viewLabel: "Fuentes", key: "sheets", label: "Sheets" },
    { view: "fuentes", viewLabel: "Fuentes", key: "activas", label: "Fuentes activas" },
    { view: "modelo", viewLabel: "Modelo", key: "estructura", label: "Metas y modalidades" },
    { view: "modelo", viewLabel: "Modelo", key: "casos", label: "Base de barrido" },
    { view: "modelo", viewLabel: "Modelo", key: "enlaces", label: "Enlaces y envios" },
    { view: "modelo", viewLabel: "Modelo", key: "reglas", label: "Estados validos" },
    { view: "modelo", viewLabel: "Modelo", key: "estrategias", label: "Calendario" },
    { view: "consultas", viewLabel: "Consultas", key: "casos", label: "Casos" },
    { view: "consultas", viewLabel: "Consultas", key: "efectivas", label: "Efectivas" },
    { view: "consultas", viewLabel: "Consultas", key: "faltantes", label: "Faltantes" },
    { view: "consultas", viewLabel: "Consultas", key: "duplicados", label: "Duplicados" },
    { view: "consultas", viewLabel: "Consultas", key: "diferencias", label: "Diferencias" },
    { view: "telefonico", viewLabel: "Telefono", key: "resumen", label: "Resumen" },
    { view: "telefonico", viewLabel: "Telefono", key: "dia", label: "Dia" },
    { view: "telefonico", viewLabel: "Telefono", key: "responsables", label: "Responsables" },
    { view: "telefonico", viewLabel: "Telefono", key: "alertas", label: "Alertas" },
    { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" },
    { view: "avance", viewLabel: "Avance", key: "actores", label: "Actores" },
    { view: "avance", viewLabel: "Avance", key: "encuestas", label: "Encuestas" },
    { view: "avance", viewLabel: "Avance", key: "detalle", label: "Detalle" },
    { view: "avance", viewLabel: "Avance", key: "salidas", label: "Salidas" },
  ],
  aulas_universitarias: [
    { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" },
    { view: "modelo", viewLabel: "Agenda", key: "aulas", label: "Aulas" },
    { view: "calidad", viewLabel: "Validación", key: "alertas", label: "Alertas" },
    { view: "consultas", viewLabel: "Consultas", key: "brechas", label: "Brechas" },
    { view: "fuentes", viewLabel: "Fuentes", key: "plan", label: "Plan" },
  ],
  telefonico: [
    { view: "telefonico", viewLabel: "Telefono", key: "resumen", label: "Resumen" },
    { view: "telefonico", viewLabel: "Telefono", key: "dia", label: "Dia" },
    { view: "telefonico", viewLabel: "Telefono", key: "responsables", label: "Responsables" },
    { view: "telefonico", viewLabel: "Telefono", key: "alertas", label: "Alertas" },
    { view: "fuentes", viewLabel: "Fuentes", key: "survey", label: "Encuestas" },
    { view: "modelo", viewLabel: "Modelo", key: "casos", label: "Base de barrido" },
    { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" },
    { view: "consultas", viewLabel: "Consultas", key: "casos", label: "Casos" },
  ],
};

const PROFILE_HYDRATION_TAB_MAP = {
  territorial: {
    entry_data: "Fuente/Formulario",
    advance_summary_hydrated: "Avance/Resumen",
    advance_map_hydrated: "Avance/Mapa y UMP",
  },
  acreditacion: {
    entry_data: "Fuentes/Encuestas",
    advance_summary_hydrated: "Avance/Resumen",
    advance_detail_hydrated: "Avance/Detalle",
  },
  aulas_universitarias: {
    entry_data: "Avance/Resumen",
    agenda_hydrated: "Agenda/Aulas",
  },
  telefonico: {
    entry_data: "Telefono/Resumen",
    phone_responsibles_hydrated: "Telefono/Responsables",
  },
};

const HYDRATION_PROBES = {
  territorial: {
    routeShell: {
      name: "route_shell",
      label: "Route shell with rail and operational pills",
      rootSelector: "body",
      requiredSelectors: [".mon-workbench-head", ".mon-workbench-pills span", ".mon-workbench-rail"],
      dataSelectors: [".mon-workbench-pills span", ".mon-rail-sync", ".mon-flow-overview strong"],
      visualSelectors: [".mon-flow-track span", ".mon-nav-item", ".mon-rail-phase-switch button"],
      minData: 5,
      minVisual: 3,
      maxLoading: 0,
    },
    entryData: {
      name: "entry_data",
      label: "Initial territorial data hydrated",
      rootSelector: ".mon-workbench-rail",
      requiredSelectors: [".mon-flow-overview", ".mon-rail-status", ".mon-section-local-tabs"],
      dataSelectors: [".mon-rail-sync strong", ".mon-rail-sync small", ".mon-workbench-pills span"],
      visualSelectors: [".mon-flow-track span", ".mon-nav-item", ".mon-rail-phase-switch button"],
      minData: 6,
      minVisual: 3,
      maxLoading: 0,
    },
    advanceSummary: {
      name: "advance_summary_hydrated",
      label: "Territorial advance summary with KPIs and charts",
      rootSelector: "section[aria-label='Resumen ejecutivo de avance territorial']",
      requiredSelectors: [
        ".mon-territorial-overview-hero",
        ".mon-territorial-exec-progress",
        ".mon-territorial-exec-districts",
      ],
      dataSelectors: [
        ".mon-territorial-overview-hero strong",
        ".mon-territorial-exec-progress-facts div",
        ".mon-territorial-exec-district-card",
        ".mon-territorial-exec-distribution-list span",
      ],
      visualSelectors: [
        ".mon-territorial-objective-track i",
        ".mon-territorial-exec-ring",
        ".mon-territorial-exec-ump-stack i",
        ".mon-territorial-exec-district-card i",
        ".mon-territorial-exec-distribution-list i",
      ],
      minData: 8,
      minVisual: 5,
      maxLoading: 0,
    },
    advanceMap: {
      name: "advance_map_hydrated",
      label: "Territorial advance map first viewport",
      rootSelector: "section[aria-label='Mapa y UMP territorial']",
      requiredSelectors: [
        ".mon-territorial-advance-zone-panel",
        ".mon-territorial-route-coverage-svg",
        ".mon-territorial-ump-toolbar",
      ],
      dataSelectors: [
        ".mon-territorial-advance-zone-panel header strong",
        ".mon-territorial-route-coverage-legend span",
        ".mon-territorial-ump-toolbar label",
        ".mon-territorial-ump-toolbar select",
      ],
      visualSelectors: [
        ".mon-territorial-route-coverage-svg path",
        ".mon-territorial-route-coverage-zones path",
        ".mon-territorial-route-coverage-labels text",
        ".mon-territorial-route-coverage-legend span",
      ],
      minData: 6,
      minVisual: 8,
      maxLoading: 0,
    },
    advanceMapDetail: {
      name: "advance_map_detail_hydrated",
      label: "Territorial UMP detail map with SVG, GPS and rich layers",
      rootSelector: "section[aria-label='Mapa territorial interactivo de UMP']",
      requiredSelectors: [
        "svg[aria-label*='Mapa interactivo']",
        ".mon-territorial-advance-map-footer span",
      ],
      dataSelectors: [
        ".mon-territorial-ump-map-nav-row",
        ".mon-territorial-ump-table tbody tr",
        ".mon-territorial-ump-detail-grid div",
        ".mon-territorial-advance-map-footer span",
        ".mon-territorial-ump-response",
      ],
      visualSelectors: [
        "svg[aria-label*='Mapa interactivo'] path",
        "svg[aria-label*='Mapa interactivo'] circle",
        ".mon-territorial-map-legend span",
      ],
      minData: 6,
      minVisual: 8,
      maxLoading: 0,
    },
  },
  acreditacion: {
    routeShell: {
      name: "route_shell",
      label: "Route shell with accreditation rail and operational pills",
      rootSelector: "body",
      requiredSelectors: [".mon-workbench-head", ".mon-workbench-pills span", ".mon-workbench-rail.is-acreditacion"],
      dataSelectors: [".mon-workbench-pills span", ".mon-clarity-card", ".mon-nav-item"],
      visualSelectors: [".mon-nav-item", ".mon-clarity-card", ".mon-workbench-head-icon"],
      minData: 5,
      minVisual: 4,
      maxLoading: 0,
    },
    entryData: {
      name: "entry_data",
      label: "Accreditation sources package hydrated",
      rootSelector: "body",
      requiredSelectors: [
        ".mon-clarity-card",
        ".mon-acr-source-blueprint-step",
      ],
      dataSelectors: [
        ".mon-clarity-card",
        ".mon-acr-requirement-card",
        ".mon-acr-configured-sources-panel",
        ".mon-profile-panel",
      ],
      visualSelectors: [
        ".mon-acr-source-blueprint-step",
        ".mon-acr-requirement-metric",
        ".mon-acr-requirement-ops",
      ],
      minData: 5,
      minVisual: 3,
      maxLoading: 0,
    },
    advanceSummary: {
      name: "advance_summary_hydrated",
      label: "Accreditation advance summary with KPIs and daily chart",
      rootSelector: "section[aria-label='Resumen canónico de avance']",
      requiredSelectors: [
        ".mon-advance-hero",
        ".mon-advance-hero-kpis",
        ".mon-advance-summary-grid",
      ],
      dataSelectors: [
        ".mon-advance-hero strong",
        ".mon-advance-metric",
        ".mon-advance-focus article",
        ".mon-advance-daily-table tbody tr",
      ],
      visualSelectors: [
        ".mon-advance-storage-bar i",
        ".mon-advance-daily-mini",
        ".mon-advance-focus article i",
        ".mon-advance-daily-table td",
      ],
      minData: 5,
      minVisual: 5,
      maxLoading: 0,
    },
    advanceDetail: {
      name: "advance_detail_hydrated",
      label: "Accreditation advance detail with control bars and report tables",
      rootSelector: "section[aria-label='Detalle canónico de avance']",
      requiredSelectors: [
        ".mon-advance-hero",
        ".mon-control-detail-panel",
        ".mon-gs-report-panel",
      ],
      dataSelectors: [
        ".mon-advance-hero-kpis span",
        ".mon-control-variable-row",
        ".mon-gs-report-block",
        ".mon-gs-report-table tbody tr",
      ],
      visualSelectors: [
        ".mon-control-variable-bars i",
        ".mon-gs-report-brief-stats span",
        ".mon-report-cell--percent i",
        ".mon-gs-report-tabs button",
      ],
      minData: 6,
      minVisual: 4,
      minRows: 1,
      maxLoading: 0,
    },
  },
  aulas_universitarias: {
    routeShell: {
      name: "route_shell",
      label: "Aulas profile shell with topbar, rail and workbench",
      rootSelector: "body",
      requiredSelectors: [".mon-profile-page", ".mon-profile-topbar", ".mon-profile-rail", ".mon-profile-workbench"],
      dataSelectors: [".mon-profile-brand strong", ".mon-profile-rail button", ".mon-profile-sidebar", ".mon-profile-readiness"],
      visualSelectors: [".mon-profile-rail button", ".mon-profile-readiness", ".mon-profile-workbench"],
      minData: 5,
      minVisual: 3,
      maxLoading: 0,
    },
    entryData: {
      name: "entry_data",
      label: "Aulas advance view hydrated",
      rootSelector: ".mon-profile-content",
      requiredSelectors: [".mon-profile-head", ".mon-profile-kpis", ".mon-profile-panel"],
      dataSelectors: [".mon-profile-stat", ".mon-profile-panel", ".mon-profile-panel-head", ".mon-profile-table tbody tr", ".mon-profile-empty"],
      visualSelectors: [".mon-profile-stat", ".mon-profile-panel", ".mon-profile-table", ".mon-aulas-handoff-grid article"],
      minData: 4,
      minVisual: 3,
      maxLoading: 0,
    },
    agenda: {
      name: "agenda_hydrated",
      label: "Aulas agenda with handoff and table states",
      rootSelector: ".mon-profile-content",
      requiredSelectors: [".mon-profile-head", ".mon-profile-panel"],
      dataSelectors: [".mon-aulas-handoff-grid article", ".mon-profile-table tbody tr", ".mon-profile-muted", ".mon-profile-empty"],
      visualSelectors: [".mon-aulas-handoff-grid article", ".mon-profile-table", ".mon-profile-panel"],
      minData: 3,
      minVisual: 2,
      maxLoading: 0,
    },
  },
  telefonico: {
    routeShell: {
      name: "route_shell",
      label: "Phone workbench shell with rail and operational pills",
      rootSelector: "body",
      requiredSelectors: [".mon-workbench-head", ".mon-workbench-pills span", ".mon-workbench-rail.is-acreditacion"],
      dataSelectors: [".mon-workbench-pills span", ".mon-nav-item", ".mon-clarity-card"],
      visualSelectors: [".mon-nav-item", ".mon-clarity-card", ".mon-workbench-head-icon"],
      minData: 5,
      minVisual: 4,
      maxLoading: 0,
    },
    entryData: {
      name: "entry_data",
      label: "Phone summary hydrated with operation KPIs",
      rootSelector: ".mon-phone-panel",
      requiredSelectors: [".mon-phone-hero", ".mon-phone-tabbody"],
      dataSelectors: [".mon-phone-metric", ".mon-phone-storage-legend span", ".mon-phone-flow span", ".mon-phone-status-rank section", ".mon-phone-overview-grid"],
      visualSelectors: [".mon-phone-storage-bar i", ".mon-phone-flow span", ".mon-phone-status-rank section", ".mon-phone-metric"],
      minData: 4,
      minVisual: 3,
      maxLoading: 0,
    },
    phoneResponsible: {
      name: "phone_responsibles_hydrated",
      label: "Phone responsible board with meters or empty states",
      rootSelector: ".mon-phone-panel",
      requiredSelectors: [".mon-phone-tabbody"],
      dataSelectors: [".mon-phone-responsibles", ".mon-phone-responsible", ".mon-phone-unassigned", ".mon-phone-overview-grid", ".mon-profile-empty"],
      visualSelectors: [".mon-phone-responsible-meter span", ".mon-phone-storage-bar i", ".mon-phone-layout", ".mon-phone-ops-card"],
      minData: 2,
      minVisual: 1,
      maxLoading: 0,
    },
  },
};

function finiteMs(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function maxMs(values) {
  const numeric = values.map(finiteMs).filter((value) => value != null);
  return numeric.length ? Math.max(...numeric) : null;
}

function diffTabs(declaredTabs, measuredTabs) {
  const measured = new Set(measuredTabs);
  return declaredTabs.filter((tab) => !measured.has(tab));
}

function declaredTabLabel(tab) {
  return `${tab.viewLabel}/${tab.label}`;
}

function countWarmupTasks(tasks = []) {
  const counts = {
    total: Array.isArray(tasks) ? tasks.length : 0,
    ready: 0,
    skipped: 0,
    timeout: 0,
    error: 0,
    other: 0,
  };
  if (!Array.isArray(tasks)) return counts;
  for (const task of tasks) {
    const status = String(task?.status || "other");
    if (status in counts) counts[status] += 1;
    else counts.other += 1;
  }
  return counts;
}

function profileCoverage(profile, route) {
  const coverage = PROFILE_COVERAGE[profile] || { declaredViews: [], declaredTabs: [], measuredTabs: [] };
  const declaredTabResults = Array.isArray(route?.declared_tab_hydration) ? route.declared_tab_hydration : [];
  const probeTabMap = PROFILE_HYDRATION_TAB_MAP[profile] || {};
  const probeTabResults = declaredTabResults.length
    ? []
    : (Array.isArray(route?.hydration) ? route.hydration : [])
      .map((probe) => {
        const tab = probeTabMap[probe?.name];
        if (!tab) return null;
        return {
          label: tab,
          ok: Boolean(probe?.ok),
          reason: probe?.error || (Array.isArray(probe?.missing_required) && probe.missing_required.length
            ? `missing ${probe.missing_required.join(", ")}`
            : "hydration probe failed"),
        };
      })
      .filter(Boolean);
  const measuredTabs = declaredTabResults.length
    ? declaredTabResults.map((item) => item.declared_label || item.label).filter(Boolean)
    : probeTabResults.length
      ? probeTabResults.map((item) => item.label).filter(Boolean)
      : [];
  const hydratedTabs = declaredTabResults.length
    ? declaredTabResults.filter((item) => item.ok).map((item) => item.declared_label || item.label).filter(Boolean)
    : probeTabResults.filter((item) => item.ok).map((item) => item.label).filter(Boolean);
  const failedTabs = declaredTabResults.length
    ? declaredTabResults.filter((item) => !item.ok).map((item) => ({
      tab: item.declared_label || item.label,
      reason: item.nav_error || item.blocking_text || item.error || "hydration probe failed",
    }))
    : probeTabResults.filter((item) => !item.ok).map((item) => ({
      tab: item.label,
      reason: item.reason,
    }));
  const notMeasuredTabs = diffTabs(coverage.declaredTabs, measuredTabs);
  const status = failedTabs.length
    ? "measured_with_failures"
    : notMeasuredTabs.length
      ? "partial_critical"
      : "all_declared";
  return {
    declared_views: coverage.declaredViews,
    declared_tabs: coverage.declaredTabs,
    measured_tabs: measuredTabs,
    hydrated_tabs: hydratedTabs,
    unmeasured_tabs: notMeasuredTabs,
    failed_tabs: failedTabs,
    declared_tab_count: coverage.declaredTabs.length,
    measured_tab_count: measuredTabs.length,
    hydrated_tab_count: hydratedTabs.length,
    unmeasured_tab_count: notMeasuredTabs.length,
    failed_tab_count: failedTabs.length,
    status,
  };
}

function buildTimingBreakdown({ profile, projectOpenMs, warmup, route }) {
  const coverage = profileCoverage(profile, route);
  const openMs = finiteMs(projectOpenMs);
  const warmupMs = finiteMs(warmup?.ms);
  const bootgateMs = finiteMs(route?.bootgate_loading_ms);
  const projectLoadingScreenMs = bootgateMs ?? (openMs != null && warmupMs != null ? openMs + warmupMs : null);
  const probes = Array.isArray(route?.hydration) ? route.hydration : [];
  const coldProbes = probes.filter((probe) => probe?.ok && !String(probe.name || "").startsWith("warm_"));
  const declaredTabResults = Array.isArray(route?.declared_tab_hydration) ? route.declared_tab_hydration : [];
  const okDeclaredTabs = declaredTabResults.filter((probe) => probe?.ok);
  const allMeasuredColdTabsMs = maxMs([
    ...coldProbes.map((probe) => probe.ms_from_route_start),
    ...okDeclaredTabs.map((probe) => probe.ms_from_route_start),
  ]);
  const declaredTabsMaxMs = maxMs(okDeclaredTabs.map((probe) => probe.ms_from_route_start));
  const visualReadyMs = finiteMs(route?.visual_ready_ms);
  const topbarSidebarMs = finiteMs(route?.topbar_sidebar_ms);
  const entryHydratedMs = finiteMs(route?.hydrated_ready_ms);
  const warmReturn = Array.isArray(route?.interactions)
    ? route.interactions.find((item) => item?.ok && String(item.name || "").startsWith("warm_"))
    : null;
  return {
    project_loading_screen: {
      method: bootgateMs != null ? "visual_bootgate_dev_pulso" : "api_open_plus_project_warmup",
      note: bootgateMs != null
        ? "Observed browser time from /monitoreo?devPulso=... until the Monitoreo route became visible after BootGate project open and warmup."
        : "Equivalent blocking project preparation time. It does not observe the visual BootGate animation unless the stack is launched with bootstrap UI measurement.",
      open_project_ms: openMs,
      warmup_ms: warmupMs,
      blocking_ms: projectLoadingScreenMs,
      bootgate_ms: bootgateMs,
      status: warmup?.status || route?.route_entry_status || "unknown",
      task_counts: countWarmupTasks(warmup?.snapshot?.result_data?.tasks || []),
    },
    monitoreo_after_project: {
      route_visual_ms: visualReadyMs,
      topbar_sidebar_ms: topbarSidebarMs,
      first_tab_hydrated_ms: entryHydratedMs,
      all_measured_cold_tabs_hydrated_ms: allMeasuredColdTabsMs,
      extra_wait_after_visual_ms: allMeasuredColdTabsMs != null && visualReadyMs != null ? allMeasuredColdTabsMs - visualReadyMs : null,
      extra_wait_after_topbar_sidebar_ms: allMeasuredColdTabsMs != null && topbarSidebarMs != null ? allMeasuredColdTabsMs - topbarSidebarMs : null,
      extra_wait_after_first_tab_ms: allMeasuredColdTabsMs != null && entryHydratedMs != null ? allMeasuredColdTabsMs - entryHydratedMs : null,
      total_project_loading_plus_measured_tabs_ms: projectLoadingScreenMs != null && allMeasuredColdTabsMs != null
        ? projectLoadingScreenMs + allMeasuredColdTabsMs
        : null,
      warm_return_ms: finiteMs(warmReturn?.ms),
      coverage,
      declared_tabs: {
        scope: route?.declared_tab_scope || "critical",
        attempted: declaredTabResults.length,
        hydrated: okDeclaredTabs.length,
        failed: declaredTabResults.filter((probe) => !probe?.ok).length,
        max_hydrated_ms: declaredTabsMaxMs,
        all_declared_hydrated_ms: declaredTabResults.length
          && !declaredTabResults.some((probe) => !probe?.ok)
          && coverage.unmeasured_tab_count === 0
          ? declaredTabsMaxMs
          : null,
      },
    },
  };
}

function evaluateHydrationProbe(probe) {
  const defaultLoadingSelectors = [
    ".mon-shell-fallback",
    ".mon-shell-error",
    ".mon-territorial-loading",
    ".mon-territorial-route-map-loading",
    ".pulso-spin",
  ];
  const root = probe.rootSelector ? document.querySelector(probe.rootSelector) : document.body;
  const isVisible = (node) => {
    if (!node || !(node instanceof Element)) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const intersectsViewport = rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0.01
      && rect.width > 0
      && rect.height > 0
      && intersectsViewport;
  };
  const countVisible = (selectors, base = document) => (
    selectors.reduce((total, selector) => {
      const matches = Array.from(base.querySelectorAll(selector));
      if (base instanceof Element && base.matches(selector)) matches.unshift(base);
      return total + matches.filter(isVisible).length;
    }, 0)
  );
  const required = (probe.requiredSelectors || []).map((selector) => ({
    selector,
    count: countVisible([selector], root || document),
  }));
  const dataCount = root ? countVisible(probe.dataSelectors || [], root) : 0;
  const visualCount = root ? countVisible(probe.visualSelectors || [], root) : 0;
  const rowCount = root ? countVisible(["tbody tr", ".mon-territorial-ump-table tbody tr", ".mon-gs-report-table tbody tr"], root) : 0;
  const loadingCount = root ? countVisible(probe.loadingSelectors || defaultLoadingSelectors, root) : 0;
  const text = root?.textContent?.replace(/\s+/g, " ").trim().slice(0, 320) || "";
  const missingRequired = required.filter((item) => item.count <= 0).map((item) => item.selector);
  const ok = Boolean(root)
    && missingRequired.length === 0
    && dataCount >= (probe.minData ?? 1)
    && visualCount >= (probe.minVisual ?? 0)
    && rowCount >= (probe.minRows ?? 0)
    && loadingCount <= (probe.maxLoading ?? Number.POSITIVE_INFINITY);
  const snapshot = {
    ok,
    root_found: Boolean(root),
    missing_required: missingRequired,
    data_count: dataCount,
    visual_count: visualCount,
    row_count: rowCount,
    loading_count: loadingCount,
    text_sample: text,
  };
  if (probe.waitForOkOnly) return ok;
  return snapshot;
}

async function recordHydrationProbe(page, probe, routeStarted, timeoutMs) {
  const waitStarted = performance.now();
  let error = "";
  try {
    await page.waitForFunction(evaluateHydrationProbe, { ...probe, waitForOkOnly: true }, { timeout: timeoutMs });
  } catch (probeError) {
    error = probeError.message;
  }
  const snapshot = await page.evaluate(evaluateHydrationProbe, probe).catch((probeError) => ({
    ok: false,
    root_found: false,
    missing_required: probe.requiredSelectors || [],
    data_count: 0,
    visual_count: 0,
    row_count: 0,
    loading_count: 0,
    text_sample: "",
    error: probeError.message,
  }));
  return {
    name: probe.name,
    label: probe.label,
    ms_from_route_start: nowMs(routeStarted),
    wait_ms: nowMs(waitStarted),
    ok: Boolean(snapshot.ok) && !error,
    ...snapshot,
    error,
  };
}

async function captureHydrationProbe(page, { probe, routeStarted, timeoutMs, screenshotPath }) {
  const result = await recordHydrationProbe(page, probe, routeStarted, timeoutMs);
  if (result.ok && probe.rootSelector) {
    await page.locator(probe.rootSelector).first().scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => null);
  }
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null);
    result.screenshot = screenshotPath;
  }
  return result;
}

function evaluateDeclaredTabHydration(tab) {
  const defaultLoadingSelectors = [
    ".mon-shell-fallback",
    ".mon-shell-error",
    ".mon-territorial-loading",
    ".mon-territorial-route-map-loading",
    ".pulso-spin",
  ];
  const root = document.querySelector(`.mon-workbench-content--${tab.view}`) || document.querySelector(".mon-workbench-content") || document.querySelector(".mon-profile-content");
  const profilePage = document.querySelector(".mon-profile-page");
  const section = document.querySelector(`.mon-section-pill.is-${tab.view}.is-active, .mon-section-pill.is-${tab.view}[aria-selected='true']`);
  const profileSection = Array.from(document.querySelectorAll(".mon-profile-rail button.is-active"))
    .find((node) => (node.textContent || "").toLowerCase().includes(String(tab.viewLabel || tab.label || "").toLowerCase()));
  const localTab = document.querySelector(`.mon-section-local-tabs button.is-${tab.view}-${tab.key}.is-active, .mon-section-local-tabs button.is-${tab.view}-${tab.key}[aria-selected='true']`);
  const hasCanonicalLocalTabs = Boolean(document.querySelector(".mon-section-local-tabs"));
  const sectionFound = Boolean(section || profileSection);
  const localTabFound = Boolean(localTab) || (Boolean(profilePage) && !hasCanonicalLocalTabs);
  const isVisible = (node) => {
    if (!node || !(node instanceof Element)) return false;
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const intersectsViewport = rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || "1") > 0.01
      && rect.width > 0
      && rect.height > 0
      && intersectsViewport;
  };
  const countVisible = (selectors, base = document) => selectors.reduce((total, selector) => {
    const matches = Array.from(base.querySelectorAll(selector));
    if (base instanceof Element && base.matches(selector)) matches.unshift(base);
    return total + matches.filter(isVisible).length;
  }, 0);
  const dataSelectors = [
    ".mon-workbench-pills span",
    ".pulso-panel",
    "section[aria-label]",
    "article",
    "strong",
    "td",
    "th",
    "[class*='metric']",
    "[class*='kpi']",
    "[class*='stat']",
  ];
  const visualSelectors = [
    "svg",
    "canvas",
    "table",
    "tbody tr",
    "[class*='chart']",
    "[class*='map']",
    "[class*='bar']",
    "[class*='meter']",
    "[class*='ring']",
    "[class*='progress']",
    "[class*='stack'] i",
    "[class*='flow']",
  ];
  const emptySelectors = [
    ".ter-empty",
    "[class*='empty']",
    "[class*='placeholder']",
  ];
  const errorSelectors = [
    ".mon-shell-error",
    ".mon-profile-error",
    "[class*='error']",
  ];
  const dataCount = root ? countVisible(dataSelectors, root) : 0;
  const visualCount = root ? countVisible(visualSelectors, root) : 0;
  const rowCount = root ? countVisible(["tbody tr"], root) : 0;
  const emptyCount = root ? countVisible(emptySelectors, root) : 0;
  const loadingCount = root ? countVisible(defaultLoadingSelectors, root) : countVisible(defaultLoadingSelectors);
  const errorCount = root ? countVisible(errorSelectors, root) : countVisible(errorSelectors);
  const text = root?.textContent?.replace(/\s+/g, " ").trim().slice(0, 360) || "";
  const blockingTextPatterns = [
    /failed to fetch/i,
    /reintentar/i,
    /preparando vista/i,
    /leyendo cache/i,
    /leyendo cach[eé]/i,
    /preparando ocurrencias/i,
    /necesita el scope/i,
    /sin .* hidratad/i,
    /todav[ií]a no hay .* hidratad/i,
    /validaci[oó]n pendiente/i,
  ];
  const blockingText = blockingTextPatterns.find((pattern) => pattern.test(text))?.source || "";
  const hasContent = dataCount >= 3 || visualCount >= 1 || rowCount >= 1 || emptyCount >= 1;
  const ok = Boolean(root)
    && sectionFound
    && localTabFound
    && loadingCount === 0
    && errorCount === 0
    && !blockingText
    && hasContent;
  const snapshot = {
    ok,
    root_found: Boolean(root),
    active_section_found: sectionFound,
    active_local_tab_found: localTabFound,
    data_count: dataCount,
    visual_count: visualCount,
    row_count: rowCount,
    empty_count: emptyCount,
    loading_count: loadingCount,
    error_count: errorCount,
    blocking_text: blockingText,
    text_sample: text,
  };
  if (tab.waitForOkOnly) return ok;
  return snapshot;
}

async function activateDeclaredTab(page, tab, timeoutMs) {
  const section = page.locator(`.mon-section-pill.is-${tab.view}`).first();
  if (await section.count()) {
    await section.waitFor({ state: "visible", timeout: timeoutMs });
    const sectionActive = await section.evaluate((node) => (
      node.classList.contains("is-active") || node.getAttribute("aria-selected") === "true"
    )).catch(() => false);
    if (!sectionActive) {
      await section.click({ timeout: timeoutMs });
    }
    await page.waitForSelector(`.mon-section-pill.is-${tab.view}.is-active, .mon-section-pill.is-${tab.view}[aria-selected='true']`, { timeout: timeoutMs });
  } else {
    const profileSection = page.locator(".mon-profile-rail button", { hasText: tab.viewLabel }).first();
    await profileSection.waitFor({ state: "visible", timeout: timeoutMs });
    const profileActive = await profileSection.evaluate((node) => node.classList.contains("is-active")).catch(() => false);
    if (!profileActive) await profileSection.click({ timeout: timeoutMs });
    await page.locator(".mon-profile-rail button.is-active", { hasText: tab.viewLabel }).first().waitFor({ state: "visible", timeout: timeoutMs });
  }

  const localTab = page.locator(`.mon-section-local-tabs button.is-${tab.view}-${tab.key}`).first();
  if (!(await localTab.count())) return;
  await localTab.waitFor({ state: "visible", timeout: timeoutMs });
  const localActive = await localTab.evaluate((node) => (
    node.classList.contains("is-active") || node.getAttribute("aria-selected") === "true"
  )).catch(() => false);
  if (!localActive) {
    await localTab.click({ timeout: timeoutMs });
  }
  await page.waitForSelector(
    `.mon-section-local-tabs button.is-${tab.view}-${tab.key}.is-active, .mon-section-local-tabs button.is-${tab.view}-${tab.key}[aria-selected='true']`,
    { timeout: timeoutMs },
  );
}

async function recordDeclaredTabHydration(page, tab, routeStarted, timeoutMs, screenshotPath = "") {
  const waitStarted = performance.now();
  let error = "";
  try {
    await page.waitForFunction(evaluateDeclaredTabHydration, { ...tab, waitForOkOnly: true }, { timeout: timeoutMs });
  } catch (probeError) {
    error = probeError.message;
  }
  const snapshot = await page.evaluate(evaluateDeclaredTabHydration, tab).catch((probeError) => ({
    ok: false,
    root_found: false,
    active_section_found: false,
    active_local_tab_found: false,
    data_count: 0,
    visual_count: 0,
    row_count: 0,
    empty_count: 0,
    loading_count: 0,
    error_count: 0,
    blocking_text: "",
    text_sample: "",
    error: probeError.message,
  }));
  const result = {
    name: `tab_${tab.view}_${tab.key}`,
    label: tab.label,
    declared_label: declaredTabLabel(tab),
    view: tab.view,
    key: tab.key,
    ms_from_route_start: nowMs(routeStarted),
    wait_ms: nowMs(waitStarted),
    ok: Boolean(snapshot.ok) && !error,
    ...snapshot,
    error,
  };
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null);
    result.screenshot = screenshotPath;
  }
  return result;
}

async function measureDeclaredTabs(page, { profile, routeStarted, timeoutMs, screenshotsDir = "" }) {
  const plan = PROFILE_TAB_PLANS[profile] || [];
  const results = [];
  if (screenshotsDir) await fs.mkdir(screenshotsDir, { recursive: true });
  for (const [index, tab] of plan.entries()) {
    const interactionStarted = performance.now();
    let navError = "";
    const screenshotPath = screenshotsDir
      ? path.join(screenshotsDir, `${String(index + 1).padStart(2, "0")}-${filenameSlug(declaredTabLabel(tab))}.png`)
      : "";
    try {
      await activateDeclaredTab(page, tab, timeoutMs);
    } catch (error) {
      navError = error.message;
    }
    const result = navError
      ? {
        name: `tab_${tab.view}_${tab.key}`,
        label: tab.label,
        declared_label: declaredTabLabel(tab),
        view: tab.view,
        key: tab.key,
        ms_from_route_start: nowMs(routeStarted),
        wait_ms: 0,
        interaction_ms: nowMs(interactionStarted),
        ok: false,
        root_found: false,
        active_section_found: false,
        active_local_tab_found: false,
        data_count: 0,
        visual_count: 0,
        row_count: 0,
        empty_count: 0,
        loading_count: 0,
        error_count: 0,
        text_sample: "",
        nav_error: navError,
      }
      : await recordDeclaredTabHydration(page, tab, routeStarted, timeoutMs, screenshotPath);
    if (navError && screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null);
      result.screenshot = screenshotPath;
    }
    result.interaction_ms = result.interaction_ms ?? nowMs(interactionStarted);
    results.push(result);
  }
  return results;
}

async function measureRoute({ opts, profile, project, session, projectOut }) {
  const measureStarted = performance.now();
  const requests = [];
  const requestEntries = new Map();
  const pageErrors = [];
  const resourceErrors = [];
  const probes = HYDRATION_PROBES[profile];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(({ sessionId, entryMode }) => {
    if (sessionId) window.localStorage.setItem("pulso.sessionId", sessionId);
    window.localStorage.setItem("pulso.layoutPreset", "auto");
    if (entryMode === "bootgate") {
      window.localStorage.removeItem("pulso.visualQaWarmup");
      window.localStorage.removeItem("pulso.visualQaWarmupModuleIds");
      window.localStorage.removeItem("pulso.visualQaSkipBackendWarmup");
    } else {
      window.localStorage.setItem("pulso.visualQaWarmup", "1");
      window.localStorage.setItem("pulso.visualQaWarmupModuleIds", "monitoreo");
      window.localStorage.setItem("pulso.visualQaSkipBackendWarmup", "1");
    }
  }, { sessionId: session, entryMode: opts.entryMode });
  const page = await context.newPage();
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/api/")) return;
    const parsed = new URL(url);
    const item = {
      method: request.method(),
      url,
      path: `${parsed.pathname}${parsed.search}`,
      started_ms: nowMs(measureStarted),
    };
    requests.push(item);
    requestEntries.set(request, item);
  });
  page.on("requestfinished", async (request) => {
    const item = requestEntries.get(request);
    if (!item) return;
    item.finished_ms = nowMs(measureStarted);
    item.duration_ms = Math.max(0, item.finished_ms - item.started_ms);
    const response = await request.response().catch(() => null);
    item.status = response?.status() ?? null;
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const item = requestEntries.get(request);
    if (item) {
      item.finished_ms = nowMs(measureStarted);
      item.duration_ms = Math.max(0, item.finished_ms - item.started_ms);
      item.failed = request.failure()?.errorText || "request failed";
    }
    if (request.url().includes("/api/") || request.resourceType() !== "image") {
      resourceErrors.push({ url: request.url(), failure: request.failure()?.errorText || "" });
    }
  });

  const navigationStarted = performance.now();
  const targetUrl = new URL(routeUrl(opts.url, "/monitoreo"));
  if (opts.entryMode === "bootgate") {
    targetUrl.searchParams.set("devPulso", project);
  }
  await page.goto(targetUrl.toString(), { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
  const domContentMs = nowMs(navigationStarted);
  let routeEntryError = "";
  try {
    await page.waitForSelector('[data-audit-ready^="monitoreo"], .mon-shell-fallback, .mon-shell-error', { timeout: opts.timeoutMs });
  } catch (error) {
    routeEntryError = error.message;
  }
  const visualReadyFromNavigationMs = nowMs(navigationStarted);
  const routeStarted = opts.entryMode === "bootgate" ? performance.now() : navigationStarted;
  const bootgateLoadingMs = opts.entryMode === "bootgate" ? visualReadyFromNavigationMs : null;
  const visualReadyMs = opts.entryMode === "bootgate" ? 0 : visualReadyFromNavigationMs;
  const topbarSidebarMs = routeEntryError
    ? null
    : await page.waitForSelector(".mon-workbench-rail, .mon-shell-error, .mon-shell-fallback", { timeout: opts.timeoutMs })
      .then(() => nowMs(routeStarted))
      .catch(() => null);
  const entryScreenshot = routeEntryError
    ? path.join(projectOut, "screenshots", `${profile}-entry-failed.png`)
    : path.join(projectOut, "screenshots", `${profile}-entry.png`);
  await page.screenshot({ path: entryScreenshot, fullPage: false }).catch(() => null);
  if (routeEntryError) {
    const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    await fs.writeFile(path.join(projectOut, `${profile}-entry-failed.txt`), bodyText);
    await browser.close();
    const summary = summarizeRequests(requests);
    return {
      project,
      profile,
      route: "/monitoreo",
      declared_tab_scope: opts.tabScope,
      entry_mode: opts.entryMode,
      route_entry_ok: false,
      route_entry_status: "entry_timeout",
      route_entry_error: routeEntryError,
      route_entry_text_sample: bodyText.replace(/\s+/g, " ").trim().slice(0, 720),
      bootgate_loading_ms: bootgateLoadingMs,
      visual_ready_from_navigation_ms: visualReadyFromNavigationMs,
      dom_content_ms: domContentMs,
      visual_ready_ms: visualReadyMs,
      topbar_sidebar_ms: topbarSidebarMs,
      hydrated_ready_ms: null,
      graphics_ready_ms: null,
      interactive_ready_ms: null,
      hydration: [],
      requests: summary,
      interactions: [],
      declared_tab_hydration: [],
      screenshots: { entry_failed: entryScreenshot },
      errors: { page: pageErrors, resource: resourceErrors },
    };
  }
  const hydration = [];
  hydration.push(await captureHydrationProbe(page, {
    probe: probes.routeShell,
    routeStarted,
    timeoutMs: opts.probeTimeoutMs,
  }));
  hydration.push(await captureHydrationProbe(page, {
    probe: probes.entryData,
    routeStarted,
    timeoutMs: opts.probeTimeoutMs,
    screenshotPath: path.join(projectOut, "screenshots", `${profile}-entry-hydrated.png`),
  }));

  const interactions = [];
  try {
    if (profile === "territorial") {
      const advanceStarted = performance.now();
      await activateDeclaredTab(page, { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" }, opts.tabProbeTimeoutMs);
      const advanceProbe = await captureHydrationProbe(page, {
        probe: probes.advanceSummary,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-advance-summary.png`),
      });
      interactions.push({ name: "advance_summary", ms: nowMs(advanceStarted), ok: advanceProbe.ok, probe: advanceProbe.name });

      const mapStarted = performance.now();
      await activateDeclaredTab(page, { view: "avance", viewLabel: "Avance", key: "ump", label: "Mapa y UMP" }, opts.tabProbeTimeoutMs);
      await scrollSelectorToStart(page, probes.advanceMap.rootSelector);
      const mapProbe = await captureHydrationProbe(page, {
        probe: probes.advanceMap,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-interaction.png`),
      });
      hydration.push(advanceProbe, mapProbe);
      interactions.push({ name: "advance_map", ms: nowMs(mapStarted), ok: mapProbe.ok, probe: mapProbe.name });

      const mapDetailStarted = performance.now();
      await page.locator(probes.advanceMapDetail.rootSelector).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
      const mapDetailProbe = await captureHydrationProbe(page, {
        probe: probes.advanceMapDetail,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-interaction-detail.png`),
      });
      hydration.push(mapDetailProbe);
      interactions.push({ name: "advance_map_detail", ms: nowMs(mapDetailStarted), ok: mapDetailProbe.ok, probe: mapDetailProbe.name });

      const warmStarted = performance.now();
      await activateDeclaredTab(page, { view: "avance", viewLabel: "Avance", key: "resumen", label: "Resumen" }, opts.tabProbeTimeoutMs);
      await page.waitForTimeout(180);
      await activateDeclaredTab(page, { view: "avance", viewLabel: "Avance", key: "ump", label: "Mapa y UMP" }, opts.tabProbeTimeoutMs);
      await scrollSelectorToStart(page, probes.advanceMap.rootSelector);
      const warmProbe = await captureHydrationProbe(page, {
        probe: { ...probes.advanceMap, name: "warm_advance_map_hydrated", label: "Warm return to territorial UMP map" },
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-warm-interaction.png`),
      });
      hydration.push(warmProbe);
      interactions.push({ name: "warm_map", ms: nowMs(warmStarted), ok: warmProbe.ok, probe: warmProbe.name });
    } else if (profile === "acreditacion") {
      const advanceStarted = performance.now();
      await clickByText(page, "Avance");
      const advanceProbe = await captureHydrationProbe(page, {
        probe: probes.advanceSummary,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-advance-summary.png`),
      });
      interactions.push({ name: "advance_summary", ms: nowMs(advanceStarted), ok: advanceProbe.ok, probe: advanceProbe.name });

      const detailStarted = performance.now();
      await clickByText(page, "Detalle");
      const detailProbe = await captureHydrationProbe(page, {
        probe: probes.advanceDetail,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-interaction.png`),
      });
      hydration.push(advanceProbe, detailProbe);
      interactions.push({ name: "advance_detail", ms: nowMs(detailStarted), ok: detailProbe.ok, probe: detailProbe.name });

      const warmStarted = performance.now();
      await clickByText(page, "Resumen");
      await page.waitForTimeout(180);
      await clickByText(page, "Detalle");
      const warmProbe = await captureHydrationProbe(page, {
        probe: { ...probes.advanceDetail, name: "warm_advance_detail_hydrated", label: "Warm return to accreditation advance detail" },
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-warm-interaction.png`),
      });
      hydration.push(warmProbe);
      interactions.push({ name: "warm_detail", ms: nowMs(warmStarted), ok: warmProbe.ok, probe: warmProbe.name });
    } else if (profile === "aulas_universitarias") {
      const agendaStarted = performance.now();
      await clickByText(page, "Agenda");
      const agendaProbe = await captureHydrationProbe(page, {
        probe: probes.agenda,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-agenda.png`),
      });
      hydration.push(agendaProbe);
      interactions.push({ name: "agenda", ms: nowMs(agendaStarted), ok: agendaProbe.ok, probe: agendaProbe.name });

      const warmStarted = performance.now();
      await clickByText(page, "Avance");
      await page.waitForTimeout(180);
      await clickByText(page, "Agenda");
      const warmProbe = await captureHydrationProbe(page, {
        probe: { ...probes.agenda, name: "warm_agenda_hydrated", label: "Warm return to aulas agenda" },
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-warm-interaction.png`),
      });
      hydration.push(warmProbe);
      interactions.push({ name: "warm_agenda", ms: nowMs(warmStarted), ok: warmProbe.ok, probe: warmProbe.name });
    } else if (profile === "telefonico") {
      const responsibleStarted = performance.now();
      await clickByText(page, "Responsables");
      const responsibleProbe = await captureHydrationProbe(page, {
        probe: probes.phoneResponsible,
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-responsables.png`),
      });
      hydration.push(responsibleProbe);
      interactions.push({ name: "phone_responsibles", ms: nowMs(responsibleStarted), ok: responsibleProbe.ok, probe: responsibleProbe.name });

      const warmStarted = performance.now();
      await clickByText(page, "Resumen");
      await page.waitForTimeout(180);
      await clickByText(page, "Responsables");
      const warmProbe = await captureHydrationProbe(page, {
        probe: { ...probes.phoneResponsible, name: "warm_phone_responsibles_hydrated", label: "Warm return to phone responsibles" },
        routeStarted,
        timeoutMs: opts.probeTimeoutMs,
        screenshotPath: path.join(projectOut, "screenshots", `${profile}-warm-interaction.png`),
      });
      hydration.push(warmProbe);
      interactions.push({ name: "warm_phone_responsibles", ms: nowMs(warmStarted), ok: warmProbe.ok, probe: warmProbe.name });
    }
  } catch (error) {
    interactions.push({ name: "section_tab", ms: nowMs(routeStarted), ok: false, error: error.message });
  }

	  const declaredTabHydration = opts.tabScope === "all"
	    ? await measureDeclaredTabs(page, {
	      profile,
	      routeStarted,
	      timeoutMs: opts.tabProbeTimeoutMs,
	      screenshotsDir: path.join(projectOut, "screenshots", "tabs"),
	    })
	    : [];

  await browser.close();
  const summary = summarizeRequests(requests);
  const hydratedReadyMs = hydration.find((item) => item.name === "entry_data" && item.ok)?.ms_from_route_start ?? null;
  const graphicsProbe = [...hydration, ...declaredTabHydration].reverse().find((item) => (
    item.ok && (/advance_(map|detail)|warm_advance_(map|detail)/.test(item.name) || Number(item.visual_count) > 0)
  ));
  return {
    project,
    profile,
    route: "/monitoreo",
    declared_tab_scope: opts.tabScope,
    entry_mode: opts.entryMode,
    route_entry_ok: true,
    route_entry_status: "ready",
    bootgate_loading_ms: bootgateLoadingMs,
    visual_ready_from_navigation_ms: visualReadyFromNavigationMs,
    dom_content_ms: domContentMs,
    visual_ready_ms: visualReadyMs,
    topbar_sidebar_ms: topbarSidebarMs,
    hydrated_ready_ms: hydratedReadyMs,
    graphics_ready_ms: graphicsProbe?.ms_from_route_start ?? null,
    interactive_ready_ms: interactions.find((item) => item.ok)?.ms ?? null,
    hydration,
    requests: summary,
    interactions,
    declared_tab_hydration: declaredTabHydration,
    errors: { page: pageErrors, resource: resourceErrors },
  };
}

async function runProject(opts, profile, project) {
  const projectOut = path.resolve(opts.out, profile);
  await fs.mkdir(path.join(projectOut, "screenshots"), { recursive: true });
  if (!project) {
    return { profile, skipped: true, reason: "project not provided" };
  }
  if (!(await fileExists(project))) {
    return { profile, skipped: true, reason: `project does not exist: ${project}` };
  }
  try {
    if (opts.entryMode === "bootgate") {
      const route = await measureRoute({ opts, profile, project, session: "", projectOut });
      const timing = buildTimingBreakdown({
        profile,
        projectOpenMs: null,
        warmup: null,
        route,
      });
      const result = {
        profile,
        project,
        session: "",
        project_open_ms: null,
        warmup_ms: null,
        warmup_status: route.route_entry_status || "unknown",
        warmup_tasks: [],
        timing,
        route,
      };
      await fs.writeFile(path.join(projectOut, `${profile}.json`), JSON.stringify(result, null, 2));
      return result;
    }
    let session = await createSession(opts.apiUrl, opts.timeoutMs);
    const opened = await openProject(opts.apiUrl, project, session, opts.timeoutMs);
    session = opened.session;
    const warmup = await runWarmup(opts.apiUrl, session, profile, opts.timeoutMs);
    const route = await measureRoute({ opts, profile, project, session, projectOut });
    const timing = buildTimingBreakdown({
      profile,
      projectOpenMs: opened.ms,
      warmup,
      route,
    });
    const result = {
      profile,
      project,
      session,
      project_open_ms: opened.ms,
      warmup_ms: warmup.ms,
      warmup_status: warmup.status,
      warmup_tasks: warmup.snapshot?.result_data?.tasks || [],
      timing,
      route,
    };
    await fs.writeFile(path.join(projectOut, `${profile}.json`), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const result = {
      profile,
      project,
      failed: true,
      error: error.message,
      stack: error.stack,
    };
    await fs.writeFile(path.join(projectOut, `${profile}.json`), JSON.stringify(result, null, 2));
    return result;
  }
}

function mdForResult(result) {
  if (result.skipped) return `## ${result.profile}\n\nSkipped: ${result.reason}\n`;
  if (result.failed) return `## ${result.profile}\n\nFailed: ${result.error}\n`;
  const route = result.route || {};
  const projectLoading = result.timing?.project_loading_screen || {};
  const afterProject = result.timing?.monitoreo_after_project || {};
  const coverage = afterProject.coverage || {};
  const declaredTabs = afterProject.declared_tabs || {};
  const projectLoadingLabel = projectLoading.method === "visual_bootgate_dev_pulso"
    ? "Project loading screen observed"
    : "Project preparation estimate";
  const hydrationLines = (route.hydration ?? []).map((probe) => (
    `  - ${probe.name}: ${probe.ok ? "ok" : "fail"} at ${probe.ms_from_route_start} ms (wait ${probe.wait_ms} ms, data ${probe.data_count}, visual ${probe.visual_count}, rows ${probe.row_count}, loading ${probe.loading_count})`
  )).join("\n");
  const declaredTabLines = (route.declared_tab_hydration ?? []).map((probe) => {
    const status = probe.ok ? "ok" : "fail";
    const reason = probe.ok ? "" : `, reason ${probe.nav_error || probe.blocking_text || probe.error || "hydration failed"}`;
    return `  - ${probe.declared_label}: ${status} at ${probe.ms_from_route_start} ms (wait ${probe.wait_ms} ms, interact ${probe.interaction_ms} ms, data ${probe.data_count}, visual ${probe.visual_count}, rows ${probe.row_count}, empty ${probe.empty_count}, loading ${probe.loading_count}${reason})`;
  }).join("\n");
  const coverageLines = (coverage.unmeasured_tabs ?? []).slice(0, 12).map((tab) => `  - ${tab}`).join("\n");
  const remainingCoverage = Math.max(0, (coverage.unmeasured_tab_count ?? 0) - 12);
  const failedTabLines = (coverage.failed_tabs ?? []).slice(0, 12).map((item) => `  - ${item.tab}: ${item.reason}`).join("\n");
  const remainingFailed = Math.max(0, (coverage.failed_tab_count ?? 0) - 12);
  return `## ${result.profile}

- Project: \`${result.project}\`
- Project open: ${result.project_open_ms} ms
- Warmup: ${result.warmup_ms} ms (${result.warmup_status})
- ${projectLoadingLabel}: ${projectLoading.blocking_ms ?? "n/a"} ms (${projectLoading.method ?? "unknown"})
- Project loading note: ${projectLoading.note ?? "n/a"}
- Route entry OK: ${route.route_entry_ok === false ? "no" : "yes"}
${route.route_entry_error ? `- Route entry error: ${route.route_entry_error}` : ""}
- Timing split: project screen ${projectLoading.blocking_ms ?? "n/a"} ms; Monitoreo after project ${afterProject.all_measured_cold_tabs_hydrated_ms ?? "n/a"} ms; total ${afterProject.total_project_loading_plus_measured_tabs_ms ?? "n/a"} ms
- Hydration rule: route-open is not success; declared tabs must pass visible data/visual/row guards with no loading or blocking placeholder text.
- Entry visual ready: ${route.visual_ready_ms} ms
- Topbar/sidebar ready: ${route.topbar_sidebar_ms} ms
- Entry data hydrated: ${route.hydrated_ready_ms ?? "n/a"} ms
- All measured cold tabs hydrated: ${afterProject.all_measured_cold_tabs_hydrated_ms ?? "n/a"} ms
- Extra wait after Monitoreo visual entry: ${afterProject.extra_wait_after_visual_ms ?? "n/a"} ms
- Total project loading + measured Monitoreo tabs: ${afterProject.total_project_loading_plus_measured_tabs_ms ?? "n/a"} ms
- Last graph/detail hydrated: ${route.graphics_ready_ms ?? "n/a"} ms
- Interactive ready: ${route.interactive_ready_ms ?? "n/a"} ms
- Warm return: ${afterProject.warm_return_ms ?? "n/a"} ms
- Declared tab scope: ${declaredTabs.scope ?? "critical"}
- Declared section tabs measured: ${coverage.measured_tab_count ?? 0}/${coverage.declared_tab_count ?? 0}
- Declared section tabs hydrated: ${coverage.hydrated_tab_count ?? 0}/${coverage.declared_tab_count ?? 0} (${coverage.status ?? "unknown"})
- All declared tabs hydrated: ${declaredTabs.all_declared_hydrated_ms ?? "n/a"} ms
- Max hydrated declared tab time: ${declaredTabs.max_hydrated_ms ?? "n/a"} ms
- Hydration probes: ${(route.hydration ?? []).filter((item) => item.ok).length}/${(route.hydration ?? []).length} ok
- Requests: ${route.requests?.total ?? 0}
- /api/monitoreo/state requests: ${route.requests?.monitoreo_state ?? 0}
- Full scope used: ${route.requests?.full_scope_used ? "yes" : "no"}
- Duplicate state requests: ${route.requests?.duplicates?.length ?? 0}
- Page errors: ${route.errors?.page?.length ?? 0}
- Resource/API errors: ${route.errors?.resource?.length ?? 0}
${coverageLines ? `- Unmeasured declared section tabs:\n${coverageLines}${remainingCoverage ? `\n  - ... ${remainingCoverage} more` : ""}` : ""}
${failedTabLines ? `- Failed declared section tabs:\n${failedTabLines}${remainingFailed ? `\n  - ... ${remainingFailed} more` : ""}` : ""}
${hydrationLines ? `- Hydration probe detail:\n${hydrationLines}` : ""}
${declaredTabLines ? `- Declared tab hydration detail:\n${declaredTabLines}` : ""}
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await fs.mkdir(path.resolve(opts.out), { recursive: true });
  const results = [];
  results.push(await runProject(opts, "territorial", opts.projectTerritorial));
  results.push(await runProject(opts, "acreditacion", opts.projectAcreditacion));
  results.push(await runProject(opts, "aulas_universitarias", opts.projectAulas));
  results.push(await runProject(opts, "telefonico", opts.projectTelefonico));
  const summary = {
    schema: "monitoreo_hydration_performance_check_v4",
    generated_at: new Date().toISOString(),
    url: opts.url,
    api_url: opts.apiUrl,
    probe_timeout_ms: opts.probeTimeoutMs,
    tab_scope: opts.tabScope,
    tab_probe_timeout_ms: opts.tabProbeTimeoutMs,
    results,
  };
  await fs.writeFile(path.join(opts.out, "summary.json"), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(opts.out, "report.json"), JSON.stringify(summary, null, 2));
  const report = `# Monitoreo performance check

Generated: ${summary.generated_at}

${results.map(mdForResult).join("\n")}
`;
  await fs.writeFile(path.join(opts.out, "report.md"), report);
  console.log(`[monitoreo-performance-check] wrote ${path.resolve(opts.out)}`);
  for (const result of results) {
    if (result.skipped) {
      console.log(`[monitoreo-performance-check] ${result.profile}: skipped (${result.reason})`);
    } else if (result.failed) {
      console.log(`[monitoreo-performance-check] ${result.profile}: failed (${result.error})`);
    } else {
      const projectLoading = result.timing?.project_loading_screen || {};
      const afterProject = result.timing?.monitoreo_after_project || {};
      const coverage = afterProject.coverage || {};
      console.log(`[monitoreo-performance-check] ${result.profile}: project_screen=${projectLoading.blocking_ms ?? "n/a"}ms monitoreo_visual=${result.route.visual_ready_ms}ms monitoreo_all_measured=${afterProject.all_measured_cold_tabs_hydrated_ms ?? "n/a"}ms extra_after_visual=${afterProject.extra_wait_after_visual_ms ?? "n/a"}ms measured=${coverage.measured_tab_count ?? 0}/${coverage.declared_tab_count ?? 0} hydrated=${coverage.hydrated_tab_count ?? 0}/${coverage.declared_tab_count ?? 0} state_requests=${result.route.requests.monitoreo_state} full=${result.route.requests.full_scope_used}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
