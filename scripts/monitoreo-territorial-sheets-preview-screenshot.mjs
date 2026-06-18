#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const requireFromFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

function parseArgs(argv) {
  const out = {
    root: path.join("tmp", "visual-qa", "territorial-sheets-ump-quota-responsible-fix"),
    failOnIssues: false,
    headed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? "";
    if (arg === "--root") out.root = next();
    else if (arg === "--fail-on-issues") out.failOnIssues = true;
    else if (arg === "--headed") out.headed = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Uso: node scripts/monitoreo-territorial-sheets-preview-screenshot.mjs --root tmp/visual-qa/territorial-sheets-ump-quota-responsible-fix --fail-on-issues");
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  return out;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function inspect(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || "";
    const operational = Array.from(document.querySelectorAll('[data-tab="Manzanas y responsables"],[data-tab="Responsables y rutas"],[data-tab="Cuotas sexo y edad"],[data-tab="Ocurrencias de campo"],[data-tab="GPS y territorio"]'))
      .map((node) => node.innerText || "")
      .join("\n");
    const statusCells = document.querySelectorAll(".status-ok,.status-over,.status-progress,.status-warn,.status-danger,.status-muted").length;
    const sections = Array.from(document.querySelectorAll(".section-row")).map((node) => (node.textContent || "").trim());
    const overflowX = Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
      document.body ? document.body.scrollWidth - window.innerWidth : 0
    );
    return {
      text,
      operational,
      statusCells,
      sections,
      tables: document.querySelectorAll("table").length,
      panels: document.querySelectorAll(".sheet-panel").length,
      overflowX,
    };
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = path.resolve(opts.root);
  const htmlPath = path.join(root, "territorial-internal-sheets-preview.html");
  if (!(await exists(htmlPath))) throw new Error(`Falta preview HTML: ${htmlPath}`);

  const browser = await chromium.launch({ headless: !opts.headed });
  let report;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.locator("body").waitFor({ state: "visible", timeout: 5000 });
    const screenshot = path.join(root, "territorial-internal-sheets-preview-1440x1000.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    const result = await inspect(page);
    await page.close();

    const requiredText = [
      "Manzanas y responsables",
      "Responsables y rutas",
      "Cuotas sexo y edad",
      "Ocurrencias de campo",
      "RELACIÓN UMP · MANZANAS DE REFERENCIA · RESPONSABLES",
      "Cumple cuota",
      "Marginales de sexo y edad",
      "MATRIZ ESPERADA SEXO/EDAD",
      "EDADES EXACTAS OBSERVADAS",
      "RITMO DIARIO DE OCURRENCIAS",
      "GPS y territorio",
      "ID respuesta",
      "Estado GPS por respuesta",
      "TARJETAS EJECUTIVAS",
      "Efectivas poblacionales",
      "UMP por aplicar",
      "PRODUCCIÓN POR ENCUESTADOR",
      "UMP completas cumpliendo cuota",
    ];
    const issues = [];
    const bodyText = result.text.toLowerCase();
    for (const needle of requiredText) {
      if (!bodyText.includes(needle.toLowerCase())) issues.push(`falta texto requerido: ${needle}`);
    }
    if (result.panels < 6) issues.push("faltan paneles de pestañas");
    if (result.tables < 6) issues.push("faltan tablas visibles");
    if (result.statusCells < 12) issues.push("faltan celdas de estado coloreadas");
    if (result.overflowX > 2) issues.push(`overflow horizontal de página: ${result.overflowX}px`);
    if (/_id|formhub\/uuid|gps_inicio|Core\/date|Core\/E1_age|Core\/E2_sex|duration_seconds|\.source_id/.test(result.operational)) {
      issues.push("campos técnicos aparecen en pestañas operativas");
    }
    if (/Acción sugerida|Recomendación|Diagnóstico|Riesgo|Próximo paso/.test(result.operational)) {
      issues.push("columnas de recomendación/diagnóstico aparecen en pestañas operativas");
    }

    report = {
      schema: "territorial_sheets_preview_visual_qa_v1",
      generatedAt: new Date().toISOString(),
      root,
      html: htmlPath,
      screenshot,
      ok: issues.length === 0,
      issues,
      metrics: {
        panels: result.panels,
        tables: result.tables,
        statusCells: result.statusCells,
        sectionRows: result.sections.length,
      },
    };
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(root, "visual-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && opts.failOnIssues) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
