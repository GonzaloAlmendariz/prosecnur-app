#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const requireFromFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

const DEFAULT_ROOT = path.join("tmp", "visual-qa", "monitoreo-publish-qa");
const DEFAULT_VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1024, height: 600 },
];

function parseArgs(argv) {
  const out = {
    root: process.env.MONITOREO_PUBLISH_QA_ROOT || DEFAULT_ROOT,
    spaceDir: [],
    failOnIssues: false,
    headed: false,
    viewports: DEFAULT_VIEWPORTS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--root") out.root = next();
    else if (arg === "--space-dir") out.spaceDir.push(next());
    else if (arg === "--only-viewport") out.viewports = [parseViewport(next())];
    else if (arg === "--viewport") out.viewports.push(parseViewport(next()));
    else if (arg === "--fail-on-issues") out.failOnIssues = true;
    else if (arg === "--headed") out.headed = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  out.viewports = dedupeViewports(out.viewports);
  return out;
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Viewport inválido: ${value}. Usa WIDTHxHEIGHT, por ejemplo 1366x768.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function dedupeViewports(viewports) {
  const seen = new Set();
  return viewports.filter((viewport) => {
    const key = `${viewport.width}x${viewport.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function printHelp() {
  console.log(`
Uso:
  node scripts/monitoreo-publish-qa-screenshots.mjs --root tmp/visual-qa/monitoreo-publish-qa --fail-on-issues

Valida Spaces HTML generados por scripts/monitoreo-publish-qa.R:
  - screenshots desktop 1440x1000, 1366x768, 1280x800, 1024x600
  - gráficos diarios presentes
  - sin overflow horizontal de página
  - cliente sin secciones/datos internos
  - interno con secciones operativas
`);
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function findSpaceDirs(root) {
  const found = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const hasIndex = entries.some((entry) => entry.isFile() && entry.name === "index.html");
    const hasManifest = entries.some((entry) => entry.isFile() && entry.name === "space_manifest.json");
    if (hasIndex && hasManifest) {
      found.push(dir);
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(path.join(dir, entry.name));
    }
  }
  await walk(root);
  return found.sort();
}

async function readJson(file, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function familyKey(value) {
  const key = String(value || "").toLowerCase();
  if (key.includes("territorial") || key.includes("fieldwork")) return "territorial";
  if (key.includes("accredit") || key.includes("acredit")) return "acreditacion";
  return "generic";
}

function audienceKey(value) {
  const key = String(value || "").toLowerCase();
  if (key.includes("internal") || key.includes("interno")) return "internal";
  return "client";
}

function forbiddenClientPatterns() {
  return [
    /Casos accionables/i,
    /Auditoría técnica/i,
    /Base técnica/i,
    /GPS y territorio/i,
    /Validación de tiempos/i,
    /Ocurrencias de campo/i,
    /Metas internas por actor/i,
    /Mínimo\/meta operativa/i,
    /Brecha contra mínimo/i,
    /ACR-RAW|TER-RAW|uuid-/i,
    /\+519/,
    /Recomendación|Diagnóstico|Acción sugerida/i,
  ];
}

function internalRequiredPatterns(family) {
  if (family === "territorial") {
    return [/Vista interna privada/i, /Auditoría técnica/i, /GPS y territorio/i, /Casos accionables/i, /TER-RAW/i];
  }
  return [/Vista interna privada/i, /Auditoría técnica/i, /Metas internas por actor/i, /Casos accionables/i, /ACR-RAW/i];
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const charts = Array.from(document.querySelectorAll("[data-chart]")).map((node) => node.getAttribute("data-chart"));
    const bodyText = document.body?.innerText || "";
    const htmlText = document.documentElement?.innerHTML || "";
    const overflowX = Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
      document.body ? document.body.scrollWidth - window.innerWidth : 0
    );
    const clipped = Array.from(
      document.querySelectorAll("h1,h2,h3,p,button,a,.metric strong,.progress-row strong,.stamp strong,.panel header strong")
    )
      .slice(0, 500)
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") return false;
        if (style.overflow === "visible" && style.textOverflow !== "ellipsis") return false;
        return node.scrollWidth > Math.ceil(node.clientWidth) + 2 || node.scrollHeight > Math.ceil(node.clientHeight) + 2;
      })
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        text: (node.textContent || "").trim().slice(0, 90),
        width: Math.round(node.getBoundingClientRect().width),
        scrollWidth: node.scrollWidth,
      }));
	    return {
	      bodyText,
	      htmlText,
	      charts,
	      hasAppShell: Boolean(document.querySelector(".space-topbar")),
	      hasSectionCards: document.querySelectorAll(".section-card").length,
	      hasSearchControls: document.querySelectorAll("[data-table-search]").length,
	      hasResetControls: document.querySelectorAll("[data-table-reset]").length,
	      hasStatusChips: document.querySelectorAll(".status-chip").length,
	      hasInteractiveTables: document.querySelectorAll("[data-space-table]").length,
	      navLinks: document.querySelectorAll("nav a").length,
	      tables: document.querySelectorAll("table").length,
	      overflowX,
      clipped,
    };
  });
}

async function validateSpace(browser, spaceDir, viewports) {
  const manifest = await readJson(path.join(spaceDir, "space_manifest.json"));
  const family = familyKey(manifest.family || manifest.variant || spaceDir);
  const audience = audienceKey(manifest.audience || manifest.variant || spaceDir);
  const screenshotsDir = path.join(spaceDir, "screenshots");
  await fs.mkdir(screenshotsDir, { recursive: true });
  const result = {
    spaceDir,
    family,
    audience,
    ok: true,
    issues: [],
    screenshots: [],
    viewports: [],
  };

  const page = await browser.newPage();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(pathToFileURL(path.join(spaceDir, "index.html")).href, { waitUntil: "load" });
      await page.locator("body").waitFor({ state: "visible", timeout: 5000 });
      const shotPath = path.join(screenshotsDir, `${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      const inspection = await inspectPage(page);
      const viewportIssues = [];
	      const requiredCharts = ["daily-status", "daily-effective", "cumulative-progress", "daily-actor-unit"];
	      for (const chart of requiredCharts) {
	        if (!inspection.charts.includes(chart)) viewportIssues.push(`falta gráfico ${chart}`);
	      }
	      if (!inspection.hasAppShell) viewportIssues.push("falta shell de app");
	      if (inspection.hasSectionCards < 4) viewportIssues.push("tarjetas de secciones insuficientes");
	      if (inspection.hasSearchControls < 4) viewportIssues.push("controles de búsqueda insuficientes");
	      if (inspection.hasResetControls < 4) viewportIssues.push("controles de limpieza insuficientes");
	      if (inspection.hasStatusChips < 4) viewportIssues.push("chips de estado insuficientes");
	      if (inspection.hasInteractiveTables < 4) viewportIssues.push("tablas interactivas insuficientes");
	      if (inspection.navLinks < 4) viewportIssues.push("navegación insuficiente");
      if (inspection.tables < 4) viewportIssues.push("tablas insuficientes");
      if (inspection.overflowX > 2) viewportIssues.push(`overflow horizontal ${inspection.overflowX}px`);
      if (inspection.clipped.length) viewportIssues.push(`texto recortado: ${inspection.clipped[0].text || inspection.clipped[0].tag}`);
      if (/Descargar|download|XLSX|CSV/i.test(inspection.bodyText)) viewportIssues.push("controles de descarga expuestos en Space");
      if (audience === "client") {
        const forbidden = forbiddenClientPatterns().filter((pattern) => pattern.test(inspection.bodyText) || pattern.test(inspection.htmlText));
        if (forbidden.length) viewportIssues.push(`cliente contiene señal interna: ${forbidden[0]}`);
      } else {
        const missing = internalRequiredPatterns(family).filter((pattern) => !pattern.test(inspection.bodyText) && !pattern.test(inspection.htmlText));
        if (missing.length) viewportIssues.push(`interno sin señal operativa: ${missing[0]}`);
      }
      result.screenshots.push(shotPath);
      result.viewports.push({ viewport, ok: viewportIssues.length === 0, issues: viewportIssues, charts: inspection.charts });
      result.issues.push(...viewportIssues.map((issue) => `${viewport.width}x${viewport.height}: ${issue}`));
    }
  } finally {
    await page.close();
  }
  result.ok = result.issues.length === 0;
  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = path.resolve(opts.root);
  const dirs = opts.spaceDir.length ? opts.spaceDir.map((dir) => path.resolve(dir)) : await findSpaceDirs(root);
  if (!dirs.length) throw new Error(`No encontré Spaces en ${root}. Ejecuta primero scripts/monitoreo-publish-qa.R.`);
  for (const dir of dirs) {
    if (!(await exists(path.join(dir, "index.html")))) throw new Error(`Falta index.html en ${dir}`);
  }
  const browser = await chromium.launch({ headless: !opts.headed });
  let spaces = [];
  try {
    for (const dir of dirs) {
      spaces.push(await validateSpace(browser, dir, opts.viewports));
    }
  } finally {
    await browser.close();
  }
  const report = {
    schema: "monitoreo_publish_visual_qa_v1",
    generatedAt: new Date().toISOString(),
    root,
    ok: spaces.every((space) => space.ok),
    spaces,
  };
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "visual-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && opts.failOnIssues) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
