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
  "data",
  "catalogo.json",
);
const manualPath = path.join(ROOT, "branding", "manual-identidad.html");
const dataScriptPath = path.join(
  ROOT,
  "branding",
  "catalogo-visual",
  "data",
  "catalogo-data.js",
);
const contextualInventoryPath = path.join(
  ROOT,
  "branding",
  "catalogo-visual",
  "docs",
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
const productionSources = walk(
  path.join(ROOT, "frontend", "src"),
  (file) =>
    /\.[jt]sx?$/i.test(file) &&
    !/\.(?:test|spec)\.[jt]sx?$/i.test(file) &&
    !/[\\/]__tests__[\\/]/.test(file) &&
    !/[\\/]__mocks__[\\/]/.test(file),
);
const productionStyles = walk(
  path.join(ROOT, "frontend", "src"),
  (file) => file.endsWith(".css") && !file.endsWith(".min.css"),
);
const catalogItems = [
  ...catalog.entries,
  ...catalog.declarations,
  ...catalog.unresolvedDeclarations,
  ...catalog.declarationCandidates,
  ...catalog.cssGeneratedContent,
  ...catalog.dynamicTemplates,
];

function declared(file, container) {
  return catalog.declarations.filter(
    (entry) =>
      entry.source.file === file && entry.componentContext === container,
  );
}

function labels(entries) {
  return entries.map((entry) => entry.label);
}

function assertExactLabels(file, container, expected) {
  assert.deepEqual(
    labels(declared(file, container)),
    expected,
    `${file} → ${container}`,
  );
}

test("cubre todos los archivos TSX/JSX productivos", () => {
  assert.equal(catalog.files.length, productionJsx.length);
  assert.deepEqual(
    new Set(catalog.files.map((entry) => entry.file)),
    new Set(productionJsx),
  );
  assert.equal(catalog.summary.productionJsxFiles, productionJsx.length);
});

test("hashea todas las fuentes productivas TS/TSX/JS/JSX sin exclusiones ocultas", () => {
  assert.equal(catalog.sourceFiles.length, productionSources.length);
  assert.deepEqual(
    new Set(catalog.sourceFiles.map((entry) => entry.file)),
    new Set(productionSources),
  );
  assert.equal(
    catalog.summary.productionSourceFilesScanned,
    productionSources.length,
  );
  for (const source of catalog.sourceFiles) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      source.candidateAudit.candidates,
      source.candidateAudit.expanded + source.candidateAudit.ignored,
    );
    assert.equal(
      source.candidateAudit.ledgered,
      source.candidateAudit.ignored,
    );
    assert.equal(
      Object.values(source.candidateAudit.dispositions).reduce(
        (total, count) => total + count,
        0,
      ),
      source.candidateAudit.ignored,
    );
  }
});

test("hashea todas las hojas CSS y audita selectores/clases de estado", () => {
  assert.equal(catalog.styleFiles.length, productionStyles.length);
  assert.deepEqual(
    new Set(catalog.styleFiles.map((entry) => entry.file)),
    new Set(productionStyles),
  );
  assert.equal(
    catalog.summary.productionStyleFilesScanned,
    productionStyles.length,
  );
  assert.ok(
    catalog.styleFiles.reduce(
      (total, entry) => total + entry.stateSelectors,
      0,
    ) > 1_000,
  );
  const expectedGeneratedContent = productionStyles.flatMap((relativeFile) => {
    const source = fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
    const sanitized = source.replace(
      /\/\*[\s\S]*?\*\//g,
      (comment) => comment.replace(/[^\n]/g, " "),
    );
    const pattern =
      /(?:^|[;{])\s*content\s*:\s*((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^;])*)/gm;
    return [...sanitized.matchAll(pattern)].flatMap((match) => {
      const value = match[1].trim();
      const literalMatch = value.match(/^(["'])([\s\S]*)\1$/);
      const literal = literalMatch ? literalMatch[2] : value;
      if (
        literal.trim() &&
        !/^(?:none(?:\s*!important)?|normal|initial|inherit|unset|revert|revert-layer)$/i.test(
          value,
        )
      ) {
        return [{
          file: relativeFile,
          value,
        }];
      }
      return [];
    });
  });
  assert.equal(
    catalog.cssGeneratedContent.length,
    expectedGeneratedContent.length,
  );
  assert.equal(
    catalog.summary.cssGeneratedContent,
    expectedGeneratedContent.length,
  );
  for (const entry of catalog.cssGeneratedContent) {
    assert.equal(entry.sourceType, "contenido-generado-css");
    assert.equal(entry.renderSource.resolution, "pseudo-elemento-css");
    assert.ok(entry.attributes.selector);
    assert.ok(entry.attributes.content);
    assert.ok(entry.usage);
    assert.ok(entry.stateModel);
  }
  assert.ok(
    catalog.cssGeneratedContent.some(
      (entry) =>
        entry.source.file ===
          "frontend/src/features/procesamiento/processingSheetViewer.css" &&
        entry.label === " ↑",
    ),
    "falta el indicador ascendente generado por CSS",
  );
});

test("cada ocurrencia conserva jerarquía y fuente exacta", () => {
  assert.ok(catalog.entries.length > 10_000);
  for (const entry of catalog.entries) {
    assert.ok(entry.id);
    assert.ok(entry.module);
    assert.ok(entry.section);
    assert.ok(entry.tab);
    assert.ok(entry.category);
    assert.ok(entry.kind);
    assert.ok(entry.label);
    assert.ok(entry.usage);
    assert.ok(entry.source.file);
    assert.ok(Number.isInteger(entry.source.line) && entry.source.line > 0);
    assert.ok(Number.isInteger(entry.source.column) && entry.source.column > 0);
  }
});

test("cada elemento usa módulo, sección y pestaña registrados o un scope explícito", () => {
  const registered = new Map(
    catalog.hierarchy.flatMap((module) =>
      module.sections.map((section) => [
        `${module.module}::${section.id}`,
        new Set(section.tabs),
      ]),
    ),
  );
  for (const entry of catalogItems) {
    assert.ok(
      registered.get(`${entry.module}::${entry.section}`)?.has(entry.tab),
      `${entry.source.file}:${entry.source.line} usa ${entry.module} → ${entry.section} → ${entry.tab} sin registrar`,
    );
    assert.ok(entry.contextScope);
    assert.ok(entry.contextBasis);
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
  const canonicalTabs = (moduleId, sectionId) =>
    tabs(moduleId, sectionId).filter(
      (tab) =>
        tab !== "Transversal / sin pestaña local" &&
        tab !== "Varias pestañas / contexto dinámico",
    );

  assert.deepEqual(canonicalTabs("bitacora", "calendario"), ["Mes", "Semana"]);
  assert.deepEqual(canonicalTabs("hojas-ruta", "entrega"), [
    "Cuotas",
    "Titulares",
    "Reemplazos",
  ]);
  assert.ok(
    canonicalTabs("calculo-muestra", "universidad-seleccion").includes(
      "Sustento técnico",
    ),
  );
  assert.ok(canonicalTabs("formularios", "constructor").includes("Presentación"));
  assert.ok(
    canonicalTabs("monitoreo", "territorial-avance").includes("Mapa y UMP"),
  );
  assert.ok(canonicalTabs("procesamiento", "analitica").includes("Ponderación"));
  assert.deepEqual(canonicalTabs("dashboard", "tablero"), [
    "Resumen",
    "Relaciones",
    "Base de datos",
    "Dimensiones",
  ]);
  assert.ok(
    canonicalTabs("monitoreo", "territorial-validacion").includes(
      "Reconciliación UMP",
    ),
  );
  assert.ok(
    canonicalTabs("monitoreo", "territorial-validacion").includes(
      "Duración de tiempo",
    ),
  );
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

test("expande tuplas, records, factories y arrays de controles críticos", () => {
  assertExactLabels(
    "frontend/src/features/bitacora/logbook/gramatica.ts",
    "MODULOS_BITACORA",
    [
      "Bitácora",
      "Muestra",
      "Formulario",
      "Rutas",
      "Fichas QR",
      "Monitoreo",
      "Carga",
      "Validación",
      "Codificación",
      "Analítica",
      "Gráficos",
      "Dashboard",
      "Proyecto",
    ],
  );
  assertExactLabels(
    "frontend/src/features/bitacora/logbook/gramatica.ts",
    "TONOS",
    ["Nota", "Decisión", "Avance", "Riesgo", "Bloqueo"],
  );
  assertExactLabels(
    "frontend/src/features/calcMuestra/universidad/shared/constants.ts",
    "CLASSROOM_LAB_TABS",
    [
      "Marco de cursos-horario",
      "Objetivo de muestra",
      "Comparar métodos",
      "Simulación",
      "Cursos-horario titulares",
      "Reemplazos por curso-horario",
      "Sustento técnico",
    ],
  );
  assertExactLabels(
    "frontend/src/features/xlsformEditor/shell/MoreViewsMenu.tsx",
    "items",
    [
      "Probar formulario",
      "Resumen del formulario",
      "Vista del cuestionario",
      "Listas de opciones",
      "Mapa de lógica",
      "Filtros de opciones",
      "Lógica de SurveyMonkey",
    ],
  );
  assert.equal(
    declared(
      "frontend/src/features/xlsformEditor/XlsformEditorPage.tsx",
      "addMenuItems",
    ).length,
    16,
  );
  assertExactLabels(
    "frontend/src/features/xlsformEditor/inspector/logic/textRules.ts",
    "TEXT_RULE_RECIPES",
    [
      "Debe tener exactamente ${n} dígitos",
      "Debe tener exactamente 1 dígito",
      'Debe tener entre ${readInt(p, "min", 2)} y ${Math.max(readInt(p, "min", 2), readInt(p, "max", 10))} caracteres',
      "Solo números",
      "Solo letras y espacios",
      "Sin números",
      'Debe iniciar con “${readText(p, "texto", "PE-")}”',
      'Debe terminar en “${readText(p, "texto", ".pdf")}”',
      "Correo electrónico válido",
      "Enlace web (http/https)",
      "Código sin espacios",
      "Código de ${n} caracteres",
      "Código de 1 carácter",
      "DNI peruano (8 dígitos)",
      "Celular peruano (9 dígitos)",
    ],
  );
});

test("clasifica tipos y roles dinámicos con todas sus variantes semánticas", () => {
  const limpiezaInput = catalog.entries.find(
    (entry) =>
      entry.source.file ===
        "frontend/src/features/validacion/tabs/LimpiezaTab.tsx" &&
      entry.tag === "input" &&
      entry.attributes.name === "limpieza-case-selection",
  );
  assert.ok(limpiezaInput);
  assert.equal(limpiezaInput.kind, "Radio / Checkbox dinámico");
  assert.ok(limpiezaInput.visualVariants.includes("type=radio"));
  assert.ok(limpiezaInput.visualVariants.includes("type=checkbox"));

  for (const [file, tag] of [
    [
      "frontend/src/features/validacion/components/DecisionStorageBar.tsx",
      "div",
    ],
    [
      "frontend/src/features/dashboard/tabs/DimensionesTab/IndicadorAssembly.tsx",
      "g",
    ],
    [
      "frontend/src/features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx",
      "g",
    ],
  ]) {
    const roleButton = catalog.entries.find(
      (entry) =>
        entry.source.file === file &&
        entry.tag === tag &&
        entry.visualVariants.includes("role=button"),
    );
    assert.ok(roleButton, `${file} no conserva role=button`);
    assert.equal(roleButton.kind, "Botón", `${file} debe ser botón`);
  }
});

test("traza hosts polimórficos e iconos dinámicos hasta su proveedor", () => {
  const expectedDynamicIconHosts = productionJsx.reduce(
    (total, relativeFile) => {
      const source = fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
      return (
        total +
        [...source.matchAll(/<(?:Icon|ActiveIcon|SelectedIcon)\b/g)].length
      );
    },
    0,
  );
  const dynamicIcons = catalog.entries.filter((entry) =>
    ["Icon", "ActiveIcon", "SelectedIcon"].includes(entry.tag),
  );
  assert.equal(dynamicIcons.length, expectedDynamicIconHosts);
  for (const entry of dynamicIcons) {
    assert.equal(entry.category, "Iconografía");
    assert.equal(entry.kind, "Icono dinámico");
    assert.ok(entry.attributes.dynamicProvider);
    assert.ok(entry.attributes.dynamicOptions);
    assert.ok(entry.dynamicProviderSource?.file);
    assert.ok(
      entry.visualVariants.some((variant) =>
        variant.startsWith("provider="),
      ),
      `${entry.source.file}:${entry.source.line} no conserva proveedor`,
    );
  }

  const adaptiveTag = catalog.entries.find(
    (entry) =>
      entry.source.file ===
        "frontend/src/components/AdaptiveSplitView.tsx" &&
      entry.tag === "Tag",
  );
  assert.ok(adaptiveTag);
  assert.equal(adaptiveTag.kind, "Contenedor polimórfico");
  assert.equal(adaptiveTag.attributes.dynamicProvider, "fallbackTag");
  assert.equal(adaptiveTag.attributes.dynamicOptions, "aside / div");
  assert.equal(adaptiveTag.nativeElement, true);

  const richTag = catalog.entries.find(
    (entry) =>
      entry.source.file ===
        "frontend/src/features/xlsformEditor/helpers/RichInline.tsx" &&
      entry.tag === "Tag",
  );
  assert.ok(richTag);
  assert.equal(
    richTag.kind,
    "Editor de texto enriquecido polimórfico",
  );
  assert.equal(
    richTag.attributes.dynamicOptions,
    "div / h3 / h2 / p / span",
  );
  assert.ok(richTag.visualVariants.includes("role=textbox"));

  const selectedIcon = dynamicIcons.find(
    (entry) => entry.tag === "SelectedIcon",
  );
  assert.ok(selectedIcon);
  assert.match(
    selectedIcon.attributes.dynamicProvider,
    /resolveGraphLucideIcon/,
  );
  assert.ok(selectedIcon.visualVariants.includes("icon-option=Sliders"));
});

test("materializa navegación y estados de Hojas, Recopiladores y Monitoreo", () => {
  const hojasFile =
    "frontend/src/features/hojasRuta/hojasRutaNavigation.ts";
  const hojasSections = declared(hojasFile, "sections");
  const hojasTabs = declared(hojasFile, "deliveryTabs");
  assert.deepEqual(labels(hojasSections), [
    "Territorio",
    "Población",
    "Muestra",
    "Manzanas",
    "Entrega",
  ]);
  assert.deepEqual(labels(hojasTabs), [
    "Cuotas",
    "Titulares",
    "Reemplazos",
  ]);
  for (const entry of [...hojasSections, ...hojasTabs]) {
    assert.ok(entry.states.length >= 2, entry.label);
    assert.ok(entry.stateModel);
  }

  const recopiladoresNavigationFile =
    "frontend/src/features/recopiladores/navegacion.ts";
  assert.deepEqual(labels(declared(recopiladoresNavigationFile, "SECCIONES")), [
    "plan-recoleccion",
    "accesos",
    "materiales",
    "entrega-campo",
  ]);
  const recopiladoresTabs = catalog.declarations.filter(
    (entry) =>
      entry.source.file === recopiladoresNavigationFile &&
      entry.componentContext.startsWith("PESTANAS_POR_SECCION."),
  );
  assert.deepEqual(labels(recopiladoresTabs), [
    "unidades",
    "canales",
    "vinculacion",
    "vista",
    "paquetes",
    "traspaso",
  ]);
  assert.ok(
    recopiladoresTabs.every(
      (entry) =>
        entry.renderSource.file ===
        "frontend/src/features/recopiladores/RecopiladoresShell.tsx",
    ),
  );

  const registryFile =
    "frontend/src/features/monitoreo/core/monitoreoRegistry.ts";
  const registryLabels = new Set(
    catalog.declarations
      .filter((entry) => entry.source.file === registryFile)
      .map((entry) => entry.label),
  );
  for (const label of [
    "Acreditación",
    "Territorial",
    "Cursos-horario",
    "Telefónico",
    "Fuente",
    "UMPs",
    "Validación",
    "Agenda de cursos-horario",
    "Llamadas",
  ]) {
    assert.ok(registryLabels.has(label), label);
  }
});

test("cubre tabs y paneles representativos de Procesamiento y Dashboard", () => {
  assertExactLabels(
    "frontend/src/features/validacion/ValidacionPage.tsx",
    "TABS",
    [
      "Explorar respuestas",
      "Reglas del formulario",
      "Criterios de revisión",
      "Cierre de base",
    ],
  );
  assertExactLabels(
    "frontend/src/features/dashboard/customize/DashboardCustomizeDialog.tsx",
    "PANELS",
    [
      "Marca",
      "Pestañas",
      "FODA",
      "Matriz",
      "Íconos",
      "Gráficos",
      "Semáforo",
      "Dimensiones",
    ],
  );
});

test("las declaraciones conservan fuente, render, condición, estado y no se duplican", () => {
  assert.ok(catalog.declarations.length > 5_000);
  const identities = new Set();
  for (const entry of catalog.declarations) {
    assert.equal(entry.sourceType, "declaración");
    assert.ok(entry.usage);
    assert.ok(entry.renderedWhen);
    assert.ok(entry.stateModel);
    assert.ok(entry.renderSource?.file);
    assert.ok(entry.declarationEvidence);
    assert.ok(
      fs.existsSync(path.join(ROOT, entry.source.file)),
      entry.source.file,
    );
    const identity = `${entry.source.file}:${entry.source.line}:${entry.source.column}:${entry.label}`;
    assert.ok(!identities.has(identity), `declaración duplicada: ${identity}`);
    identities.add(identity);
  }
  assert.equal(
    catalog.declarationAudit.candidates,
    catalog.declarationAudit.expanded + catalog.declarationAudit.ignored,
  );
  assert.equal(
    catalog.declarationAudit.unresolved,
    catalog.unresolvedDeclarations.length,
  );
  assert.equal(
    catalog.declarationAudit.ledgered,
    catalog.declarationCandidates.length,
  );
  assert.equal(
    catalog.declarationAudit.ignored,
    catalog.declarationCandidates.length,
  );
  assert.equal(
    catalog.summary.unresolvedDeclarations,
    catalog.unresolvedDeclarations.length,
  );
  for (const entry of catalog.unresolvedDeclarations) {
    assert.equal(entry.sourceType, "declaración-sin-sink-resuelto");
    assert.equal(entry.visibilityStatus, "candidato-no-confirmado");
    assert.equal(entry.interactive, false);
    assert.ok(entry.stateModel);
    assert.ok(entry.renderSource?.file);
    assert.match(entry.renderSource.resolution, /no resuelto/);
  }
  const styleObjectDeclarations = [
    ...catalog.declarations,
    ...catalog.unresolvedDeclarations,
  ].filter(
    (entry) =>
      entry.source.file ===
        "frontend/src/features/graficos/GraficosHeader.tsx" &&
      [
        "primaryActionButton",
        "secondaryActionButton",
        "advancedToggle",
        "option",
      ].includes(entry.componentContext),
  );
  assert.deepEqual(
    styleObjectDeclarations,
    [],
    "los objetos CSSProperties no son elementos visuales independientes",
  );
});

test("individualiza cada candidato declarativo no expandido sin afirmar visibilidad", () => {
  const dispositions = new Set([
    "representado-por-descendiente",
    "técnico",
    "probable-visual",
    "no-resuelto",
  ]);
  const ids = new Set();
  assert.ok(catalog.declarationCandidates.length > 2_000);
  assert.equal(
    catalog.summary.declarationCandidates,
    catalog.declarationCandidates.length,
  );
  for (const entry of catalog.declarationCandidates) {
    assert.equal(entry.sourceType, "auditoría-candidato");
    assert.equal(entry.interactive, false);
    assert.ok(dispositions.has(entry.visibilityStatus));
    assert.equal(
      entry.visibilityStatus,
      entry.attributes.disposition,
    );
    assert.ok(entry.attributes.sinkEvidence);
    assert.ok(entry.attributes.startLine > 0);
    assert.ok(entry.attributes.endLine >= entry.attributes.startLine);
    assert.ok(entry.source.file);
    assert.ok(entry.componentContext);
    assert.ok(entry.label);
    assert.ok(entry.usage);
    assert.ok(entry.contextBasis);
    assert.match(entry.renderSource.resolution, /^auditoría-/);
    assert.ok(!ids.has(entry.id), `id candidato duplicado: ${entry.id}`);
    ids.add(entry.id);
  }
  for (const disposition of dispositions) {
    assert.ok(
      catalog.declarationCandidates.some(
        (entry) => entry.visibilityStatus === disposition,
      ),
      `falta disposición ${disposition}`,
    );
  }
});

test("conserva estados CSS y expresiones completas sin confundir tamaño con estado", () => {
  assert.ok(
    catalog.entries.filter((entry) => entry.styleStates?.length > 0).length >
      1_000,
  );
  for (const entry of catalogItems) {
    assert.ok(
      !entry.states?.some(
        (state) =>
          /^(?:size|variant)=/.test(state) ||
          /(?:clase|css):\.?(?:is-)?(?:compact|dense|small|medium|large|sm|md|lg|xl|text-sm|wide|narrow)(?:$|[.:\-_])/i.test(
            state,
          ),
      ),
      `${entry.id} mezcla variante con estado`,
    );
    assert.doesNotMatch(
      entry.renderedWhen ?? "",
      /===\s*["'][^"']*$/,
      `${entry.id} tiene una condición truncada`,
    );
  }
  assert.ok(
    catalog.entries.some((entry) =>
      entry.visualVariants?.some((variant) =>
        /is-compact|is-small|is-medium/.test(variant),
      ),
    ),
    "las variantes CSS de compactación deben conservarse fuera de states",
  );
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
  assert.equal(catalog.dynamicTemplates.length, catalog.declaredVisualSurfaces.length);
  for (const template of catalog.dynamicTemplates) {
    assert.equal(template.sourceType, "plantilla-dinámica");
    assert.ok(template.attributes.provider);
    assert.ok(template.renderSource?.file);
    assert.ok(template.states.length > 0);
    assert.ok(template.stateModel);
  }
  const markdownTemplates = catalog.dynamicTemplates.filter(
    (entry) =>
      entry.source.file ===
      "frontend/src/features/xlsformEditor/helpers/markdown.ts",
  );
  assert.deepEqual(
    markdownTemplates.map((entry) => entry.tag),
    ["<span>", "<a>", "<strong>", "<em>", "<s>", "<br>", "<p>"],
  );
  for (const template of markdownTemplates) {
    assert.equal(template.module, "formularios");
    assert.equal(template.section, "constructor");
    assert.equal(template.tab, "Varias pestañas / contexto dinámico");
    assert.match(template.attributes.provider, /dangerouslySetInnerHTML/);
  }
});

test("atribuye los componentes internos del Dashboard a su pestaña probada", () => {
  const tabDirectories = {
    ResumenTab: "Resumen",
    BaseDatosTab: "Base de datos",
    DimensionesTab: "Dimensiones",
  };
  for (const [directory, expectedTab] of Object.entries(tabDirectories)) {
    const prefix = `frontend/src/features/dashboard/tabs/${directory}/`;
    const rows = catalog.entries.filter((entry) =>
      entry.source.file.startsWith(prefix),
    );
    assert.ok(rows.length > 0, prefix);
    assert.ok(
      rows.every(
        (entry) =>
          entry.module === "dashboard" &&
          entry.section === "tablero" &&
          entry.tab === expectedTab &&
          entry.contextScope === "pestaña-exacta",
      ),
      `${directory} contiene contexto transversal o incorrecto`,
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
      calculo: "#7260AE",
      formularios: "#7172C1",
      hojas: "#AC563B",
      fichas: "#106E8C",
      monitoreo: "#A0464E",
      procesamiento: "#0F766E",
      dashboard: "#4A6EB6",
    },
  );
});

test("el manual integra el capítulo y el dataset generado", () => {
  const manual = fs.readFileSync(manualPath, "utf8");
  assert.match(manual, /href="#catalogo-real">11 Catálogo real/);
  assert.match(manual, /id="catalogo-real"/);
  assert.match(manual, /catalogo-visual\/data\/catalogo-data\.js/);
  assert.match(manual, /VISUAL_CATALOG:START/);
  assert.match(manual, /VISUAL_CATALOG:END/);
  assert.match(manual, /Superficies dinámicas y condicionales/);
  assert.match(
    manual,
    /catalogo-visual\/docs\/inventario-contextual\.md/,
  );
  assert.match(manual, /id="cv-origin"/);
  assert.match(manual, /plantilla dinámica/);
  assert.match(manual, /Solo ledger de candidatos/);
  assert.match(manual, /dynamicProviderSource/);
  assert.match(manual, /proveedor:/);
  assert.match(manual, /Transversal \/ sin pestaña local/);
});

test("el paquete del catálogo separa entrada, datos generados y documentación", () => {
  const packageRoot = path.join(ROOT, "branding", "catalogo-visual");
  const expectedFiles = [
    "README.md",
    "data/catalogo.json",
    "data/catalogo-data.js",
    "docs/inventario-contextual.md",
  ];
  for (const relativeFile of expectedFiles) {
    assert.ok(
      fs.existsSync(path.join(packageRoot, relativeFile)),
      `falta ${relativeFile}`,
    );
  }
  for (const legacyFile of [
    "catalogo.json",
    "catalogo-data.js",
    "inventario-contextual.md",
  ]) {
    assert.equal(
      fs.existsSync(path.join(packageRoot, legacyFile)),
      false,
      `ruta heredada duplicada: ${legacyFile}`,
    );
  }
  const readme = fs.readFileSync(
    path.join(packageRoot, "README.md"),
    "utf8",
  );
  for (const contract of [
    "## Inicio rápido",
    "## Mapa del paquete",
    "## Fuentes de verdad",
    "## Qué se edita y qué se genera",
    "## Colores de módulo",
    "data/catalogo.json",
    "docs/inventario-contextual.md",
  ]) {
    assert.match(readme, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const module of catalog.modules) {
    assert.ok(
      readme.includes(`| ${module.label} | \`${module.accent}\` |`),
      `README sin acento vigente de ${module.label}`,
    );
  }
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
  ]) {
    assert.match(inventory, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(inventory, /módulo → sección → pestaña/);
});
