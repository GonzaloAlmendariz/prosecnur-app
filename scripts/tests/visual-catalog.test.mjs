import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..", "..");
const catalogPath = path.join(
  ROOT,
  "branding",
  "catalogo-visual",
  "catalogo.json",
);
const manualPath = path.join(ROOT, "branding", "manual-identidad.html");
const dataScriptPath = path.join(
  ROOT,
  "branding",
  "catalogo-visual",
  "catalogo-data.js",
);
const contextualInventoryPath = path.join(
  ROOT,
  "branding",
  "catalogo-visual",
  "inventario-contextual.md",
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

function walk(root, predicate) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "__snapshots__"].includes(entry.name)) {
          stack.push(full);
        }
      } else if (predicate(full)) {
        files.push(path.relative(ROOT, full).split(path.sep).join("/"));
      }
    }
  }
  return files.sort();
}

const productionJsx = walk(
  path.join(ROOT, "frontend", "src"),
  (file) =>
    /\.[jt]sx$/i.test(file) &&
    !/\.(?:test|spec)\.[jt]sx$/i.test(file) &&
    !/[\\/]__tests__[\\/]/.test(file),
);

test("cubre todos los archivos TSX/JSX productivos", () => {
  assert.equal(catalog.files.length, productionJsx.length);
  assert.deepEqual(
    new Set(catalog.files.map((entry) => entry.file)),
    new Set(productionJsx),
  );
  assert.equal(catalog.summary.productionJsxFiles, productionJsx.length);
});

test("cada ocurrencia conserva jerarquía y fuente exacta", () => {
  assert.ok(catalog.entries.length > 10_000);
  for (const entry of catalog.entries) {
    assert.ok(entry.id);
    assert.ok(entry.module);
    assert.ok(entry.section);
    assert.ok(entry.category);
    assert.ok(entry.kind);
    assert.ok(entry.label);
    assert.ok(entry.usage);
    assert.ok(entry.source.file);
    assert.ok(Number.isInteger(entry.source.line) && entry.source.line > 0);
    assert.ok(Number.isInteger(entry.source.column) && entry.source.column > 0);
  }
});

test("incluye todos los módulos canónicos y utilidades globales", () => {
  const expected = [
    "global",
    "bitacora",
    "calculo-muestra",
    "formularios",
    "hojas-ruta",
    "fichas-qr",
    "monitoreo",
    "procesamiento",
    "dashboard",
    "enciclopedia",
  ];
  const modules = new Set(catalog.modules.map((entry) => entry.id));
  for (const module of expected) assert.ok(modules.has(module), module);
  const hierarchyModules = new Set(
    catalog.hierarchy.map((entry) => entry.module),
  );
  for (const module of expected) assert.ok(hierarchyModules.has(module), module);
});

test("censa controles críticos solicitados por el dueño", () => {
  const kinds = new Set(catalog.entries.map((entry) => entry.kind));
  for (const kind of [
    "Botón",
    "Switcher",
    "Checkbox",
    "Radio",
    "Selector",
    "Campo de texto",
    "Diálogo",
    "Popover",
    "Pestaña",
    "Tabla/dato",
    "Mapa",
    "Gráfico/canvas",
  ]) {
    assert.ok(kinds.has(kind), `falta ${kind}`);
  }
});

test("documenta la jerarquía real de secciones y pestañas", () => {
  const moduleSections = (moduleId) =>
    catalog.hierarchy.find((entry) => entry.module === moduleId)?.sections ?? [];
  const tabs = (moduleId, sectionId) =>
    moduleSections(moduleId).find((entry) => entry.id === sectionId)?.tabs ?? [];

  assert.deepEqual(tabs("bitacora", "calendario"), ["Mes", "Semana"]);
  assert.deepEqual(tabs("hojas-ruta", "entrega"), [
    "Cuotas",
    "Titulares",
    "Reemplazos",
  ]);
  assert.ok(
    tabs("calculo-muestra", "universidad-seleccion").includes(
      "Sustento técnico",
    ),
  );
  assert.ok(tabs("formularios", "constructor").includes("Presentación"));
  assert.ok(
    tabs("monitoreo", "territorial-avance").includes("Mapa y UMP"),
  );
  assert.ok(tabs("procesamiento", "analitica").includes("Ponderación"));
  assert.deepEqual(tabs("dashboard", "tablero"), [
    "Resumen",
    "Relaciones",
    "Base de datos",
    "Dimensiones",
  ]);
  assert.deepEqual(tabs("enciclopedia", "ficha"), [
    "Definición",
    "Fórmulas",
    "Parámetros",
    "Decisiones",
    "Aplicaciones",
  ]);
});

test("cada ocurrencia usa una sección registrada en su módulo", () => {
  const registered = new Map(
    catalog.hierarchy.map((module) => [
      module.module,
      new Set(module.sections.map((section) => section.id)),
    ]),
  );
  for (const entry of catalog.entries) {
    assert.ok(
      registered.get(entry.module)?.has(entry.section),
      `${entry.source.file}:${entry.source.line} usa ${entry.module} → ${entry.section} sin registrar`,
    );
  }
});

test("registra superficies dinámicas que el JSX no puede enumerar completo", () => {
  const labels = new Set(
    catalog.declaredVisualSurfaces.map((entry) => entry.label),
  );
  for (const label of [
    "Mapa de Lima y Callao",
    "Código QR generado",
    "Visualizaciones Plotly de validación",
    "Previews de slides",
    "Visuales de dimensiones",
  ]) {
    assert.ok(labels.has(label), label);
  }
  for (const surface of catalog.declaredVisualSurfaces) {
    assert.ok(surface.module);
    assert.ok(surface.section);
    assert.ok(surface.label);
    assert.ok(surface.usage);
    assert.ok(surface.source.file);
    assert.ok(
      fs.existsSync(path.join(ROOT, surface.source.file)),
      `fuente dinámica inexistente: ${surface.source.file}`,
    );
  }
});

test("los ocho módulos mantienen sus acentos distintivos en el catálogo", () => {
  const tones = Object.fromEntries(
    catalog.modules.map((entry) => [entry.id, entry.accent.toUpperCase()]),
  );
  assert.deepEqual(
    {
      bitacora: tones.bitacora,
      calculo: tones["calculo-muestra"],
      formularios: tones.formularios,
      hojas: tones["hojas-ruta"],
      fichas: tones["fichas-qr"],
      monitoreo: tones.monitoreo,
      procesamiento: tones.procesamiento,
      dashboard: tones.dashboard,
    },
    {
      bitacora: "#A16207",
      calculo: "#7C3AED",
      formularios: "#6D5DFC",
      hojas: "#C2410C",
      fichas: "#0891B2",
      monitoreo: "#BE123C",
      procesamiento: "#0F766E",
      dashboard: "#2563EB",
    },
  );
});

test("el manual integra el capítulo y el dataset generado", () => {
  const manual = fs.readFileSync(manualPath, "utf8");
  assert.match(manual, /href="#catalogo-real">11 Catálogo real/);
  assert.match(manual, /id="catalogo-real"/);
  assert.match(manual, /catalogo-visual\/catalogo-data\.js/);
  assert.match(manual, /VISUAL_CATALOG:START/);
  assert.match(manual, /VISUAL_CATALOG:END/);
  assert.match(manual, /Superficies dinámicas y condicionales/);
  assert.match(manual, /inventario-contextual\.md/);
});

test("el transporte del manual está comprimido y no duplica el JSON", () => {
  const dataScript = fs.readFileSync(dataScriptPath, "utf8");
  assert.match(dataScript, /__PROSECNUR_VISUAL_CATALOG_PROMISE__/);
  assert.match(dataScript, /DecompressionStream\("gzip"\)/);
  assert.ok(
    fs.statSync(dataScriptPath).size < fs.statSync(catalogPath).size / 4,
    "catalogo-data.js debe ser al menos 4× menor que catalogo.json",
  );
});

test("el índice humano conserva el lenguaje módulo-sección-pestaña", () => {
  const inventory = fs.readFileSync(contextualInventoryPath, "utf8");
  for (const heading of [
    "## Bitácora",
    "## Cálculo de muestra",
    "## Editor de formularios",
    "## Hojas de ruta",
    "## Fichas QR",
    "## Monitoreo",
    "## Procesamiento",
    "## Dashboard",
    "## Enciclopedia",
  ]) {
    assert.match(inventory, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(inventory, /módulo → sección → pestaña/);
});
