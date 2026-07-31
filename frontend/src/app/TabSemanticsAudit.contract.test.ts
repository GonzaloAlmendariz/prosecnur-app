import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { readSources } from "../test/contractSourceScan";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type LoadedSource = {
  readonly relative: string;
  readonly sourceFile: ts.SourceFile;
};

type SelectorCase = {
  readonly name: string;
  readonly file: string;
  readonly rootMarker: string;
  readonly semantics: "radio" | "pressed";
  readonly itemMarker?: string;
};

type TabsetCase = {
  readonly name: string;
  readonly file: string;
  readonly rootMarker: string;
  readonly relationStem: string;
  readonly singleOptionGuard?: boolean;
};

function load(relative: string): LoadedSource {
  const file = path.join(SRC, relative);
  return {
    relative,
    sourceFile: ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

function tagsWithin(node: ts.Node): ts.JsxOpeningLikeElement[] {
  const tags: ts.JsxOpeningLikeElement[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
      tags.push(child);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return tags;
}

function allTags(source: LoadedSource): ts.JsxOpeningLikeElement[] {
  return tagsWithin(source.sourceFile);
}

function findUniqueTag(
  source: LoadedSource,
  marker: string,
): ts.JsxOpeningLikeElement {
  const matches = allTags(source).filter((tag) =>
    tag.getText(source.sourceFile).includes(marker),
  );
  expect(
    matches,
    `${source.relative}: el marcador AST debe identificar exactamente una etiqueta: ${marker}`,
  ).toHaveLength(1);
  return matches[0]!;
}

function elementFor(tag: ts.JsxOpeningLikeElement): ts.Node {
  return ts.isJsxOpeningElement(tag) && ts.isJsxElement(tag.parent)
    ? tag.parent
    : tag;
}

function tagName(tag: ts.JsxOpeningLikeElement): string {
  return tag.tagName.getText();
}

function attribute(
  tag: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function attributeText(
  source: LoadedSource,
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string {
  return attribute(tag, name)?.initializer?.getText(source.sourceFile) ?? "";
}

function literalAttribute(
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string | null {
  const initializer = attribute(tag, name)?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    (ts.isStringLiteral(initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(initializer.expression))
  ) {
    return initializer.expression.text;
  }
  return null;
}

function hasAttribute(tag: ts.JsxOpeningLikeElement, name: string): boolean {
  return Boolean(attribute(tag, name)?.initializer);
}

function isGuardedByMultipleTabs(
  source: LoadedSource,
  tag: ts.JsxOpeningLikeElement,
): boolean {
  let current: ts.Node | undefined = tag.parent;
  while (current) {
    if (ts.isConditionalExpression(current)) {
      const condition = current.condition.getText(source.sourceFile);
      if (/tabs\.length\s*>\s*1/.test(condition)) return true;
    }
    current = current.parent;
  }
  return false;
}

function auditSelector(spec: SelectorCase): string[] {
  const source = load(spec.file);
  const rootTag = findUniqueTag(source, spec.rootMarker);
  const root = elementFor(rootTag);
  const itemTags = spec.itemMarker
    ? [findUniqueTag(source, spec.itemMarker)]
    : tagsWithin(root).filter((tag) => tagName(tag) === "button");
  const issues: string[] = [];
  const inspectedText = [
    root.getText(source.sourceFile),
    ...itemTags.map((tag) => tag.getText(source.sourceFile)),
  ].join("\n");

  if (itemTags.length === 0) issues.push("no encontró controles seleccionables");
  if (/role="tablist"|role="tab"|aria-selected=/.test(inspectedText)) {
    issues.push("conserva semántica tab/tablist/aria-selected sin panel asociado");
  }

  if (spec.semantics === "radio") {
    if (literalAttribute(rootTag, "role") !== "radiogroup") {
      issues.push('el contenedor exclusivo debe declarar role="radiogroup"');
    }
    itemTags.forEach((tag, index) => {
      if (literalAttribute(tag, "role") !== "radio") {
        issues.push(`control ${index + 1}: falta role="radio"`);
      }
      if (!hasAttribute(tag, "aria-checked")) {
        issues.push(`control ${index + 1}: falta aria-checked`);
      }
    });
  } else {
    if (literalAttribute(rootTag, "role") !== "group") {
      issues.push('el grupo de acciones debe declarar role="group"');
    }
    itemTags.forEach((tag, index) => {
      if (!hasAttribute(tag, "aria-pressed")) {
        issues.push(`control ${index + 1}: falta aria-pressed`);
      }
    });
  }

  return issues;
}

function auditTabset(spec: TabsetCase): string[] {
  const source = load(spec.file);
  const rootTag = findUniqueTag(source, spec.rootMarker);
  const root = elementFor(rootTag);
  const descendants = tagsWithin(root);
  const tabs = descendants.filter(
    (tag) => literalAttribute(tag, "role") === "tab",
  );
  const nonTabControls = descendants.filter(
    (tag) =>
      ["button", "a", "input", "select", "textarea"].includes(tagName(tag)) &&
      literalAttribute(tag, "role") !== "tab",
  );
  const panels = allTags(source).filter(
    (tag) =>
      attributeText(source, tag, "role").includes("tabpanel") &&
      attributeText(source, tag, "id").includes(spec.relationStem),
  );
  const issues: string[] = [];

  if (literalAttribute(rootTag, "role") !== "tablist") {
    issues.push('el contenedor debe declarar role="tablist"');
  }
  if (tabs.length === 0) issues.push("no encontró tabs dentro del tablist");
  nonTabControls.forEach((tag, index) => {
    issues.push(
      `control no-tab ${index + 1} dentro del tablist: ${tagName(tag)}`,
    );
  });
  if (spec.singleOptionGuard && !isGuardedByMultipleTabs(source, rootTag)) {
    issues.push(
      "tablist y tabs deben renderizarse solo dentro de la rama tabs.length > 1",
    );
  }

  tabs.forEach((tab, index) => {
    const id = attributeText(source, tab, "id");
    const controls = attributeText(source, tab, "aria-controls");
    if (!hasAttribute(tab, "aria-selected")) {
      issues.push(`tab ${index + 1}: falta aria-selected`);
    }
    if (!id.includes(spec.relationStem)) {
      issues.push(`tab ${index + 1}: id no pertenece a ${spec.relationStem}`);
    }
    if (!controls.includes(spec.relationStem)) {
      issues.push(`tab ${index + 1}: aria-controls no apunta a ${spec.relationStem}`);
    }
    if (controls.includes("undefined")) {
      issues.push(`tab ${index + 1}: aria-controls no puede existir solo cuando está activo`);
    }
  });

  if (panels.length !== 1) {
    issues.push(
      `debe existir un único panel activo con id ${spec.relationStem}*; encontró ${panels.length}`,
    );
  } else {
    const panel = panels[0]!;
    const labelledBy = attributeText(source, panel, "aria-labelledby");
    if (!labelledBy.includes(spec.relationStem)) {
      issues.push(`el panel no está etiquetado por el tab activo ${spec.relationStem}*`);
    }
    if (spec.singleOptionGuard) {
      const role = attributeText(source, panel, "role");
      if (!role.includes("tabs.length") || !role.includes("undefined")) {
        issues.push("con una sola opción el contenido no debe conservar role=tabpanel");
      }
      if (!labelledBy.includes("tabs.length") || !labelledBy.includes("undefined")) {
        issues.push("con una sola opción el contenido no debe conservar aria-labelledby huérfano");
      }
    }
  }

  return issues;
}

const SELECTORS_WITHOUT_PANELS: readonly SelectorCase[] = [
  {
    name: "A01 FichaTecnicaPane · formato",
    file: "features/analitica/panes/FichaTecnicaPane.tsx",
    rootMarker: 'aria-label="Formato de ficha"',
    semantics: "radio",
  },
  {
    name: "A02 CalcMuestra · rail con destinos compartidos",
    file: "features/calcMuestra/CalcMuestraPage.tsx",
    rootMarker: "cmv2-section-local-tabs",
    // Varias opciones pueden resolver al mismo destino, pero activeTabId
    // mantiene exactamente una elección: semánticamente sigue siendo radio.
    semantics: "radio",
  },
  {
    name: "A03 BaseDatosTab · códigos/etiquetas",
    file: "features/dashboard/tabs/BaseDatosTab/index.tsx",
    rootMarker: "activeKey={baseDatos.modo}",
    semantics: "radio",
  },
  {
    name: "A04 DimensionesTab · general/indicadores",
    file: "features/dashboard/tabs/DimensionesTab/index.tsx",
    rootMarker: 'className="dash-source-segments" activeKey={modo}',
    semantics: "radio",
  },
  {
    name: "A05 DimensionesTab · tipo de visualización",
    file: "features/dashboard/tabs/DimensionesTab/index.tsx",
    rootMarker: 'className="dash-dim-vis-segmented"',
    itemMarker: "dash-dim-vis-segment ",
    semantics: "radio",
  },
  {
    name: "A06 DimensionesTab · FODA lectura/datos",
    file: "features/dashboard/tabs/DimensionesTab/index.tsx",
    rootMarker: 'className="dash-foda-view-switch"',
    semantics: "radio",
  },
  {
    name: "A07 DimensionesTab · foco/animación",
    file: "features/dashboard/tabs/DimensionesTab/index.tsx",
    rootMarker: 'className="dash-foda-lectura-dots"',
    // stopIdx identifica un único cuadrante en foco; no son acciones
    // independientes que puedan quedar presionadas simultáneamente.
    semantics: "radio",
  },
  {
    name: "A08 GraficosHeader · timeline/canvas",
    file: "features/graficos/GraficosHeader.tsx",
    rootMarker: 'aria-label="Modo de trabajo"',
    semantics: "radio",
  },
  {
    name: "A09 MonitoreoOutputsWorkbench · audiencia",
    file: "features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx",
    rootMarker: 'aria-label="Audiencia de salida"',
    semantics: "radio",
  },
  {
    name: "A10 FocusedWorkspace · foco/vista completa",
    file: "features/xlsformEditor/canvas/FocusedWorkspace.tsx",
    rootMarker: 'className="pulso-focus-mode-toggle"',
    semantics: "radio",
  },
] as const;

const REAL_TABSETS: readonly TabsetCase[] = [
  {
    name: "B01 PanelBasePane",
    file: "features/analitica/panes/PanelBasePane.tsx",
    rootMarker: "analitica-segmented--five",
    relationStem: "analitica-panel-view",
  },
  {
    name: "B02 CanvasSection",
    file: "features/bitacora/canvas/CanvasSection.tsx",
    rootMarker: 'className="bcanvas-lienzos-tablist"',
    relationStem: "bcanvas-lienzo",
  },
  {
    name: "B03 InspectorV2",
    file: "features/graficos/v2/inspector/InspectorV2.tsx",
    rootMarker: 'className="pulso-gv2-inspector-tabs"',
    relationStem: "pulso-gv2-inspector",
  },
  {
    name: "B04 EstiloGlobalDialog",
    file: "features/graficos/v2/shell/EstiloGlobalDialog.tsx",
    rootMarker: 'className="pulso-gv2-estilo-tabs"',
    relationStem: "pulso-gv2-estilo",
  },
  {
    name: "B05 GlobalSettingsDialog",
    file: "features/home/GlobalSettingsDialog.tsx",
    rootMarker: 'className="home-settings-nav"',
    relationStem: "home-settings",
  },
  {
    name: "B06 Acreditacion · consultas",
    file: "features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx",
    rootMarker: 'className="mon-acr-query-tabs"',
    relationStem: "mon-acr-query",
  },
  {
    name: "B07 Acreditacion · reporte",
    file: "features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx",
    rootMarker: 'className="mon-gs-report-tabs"',
    relationStem: "mon-gs-report",
  },
  {
    name: "B08 Aulas · avance",
    file: "features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx",
    rootMarker: 'className="aulas-mon-tabs"',
    relationStem: "aulas-mon",
  },
  {
    name: "B09 Telefonico · consultas",
    file: "features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx",
    rootMarker: 'className="mon-acr-query-tabs"',
    relationStem: "mon-acr-query",
  },
  {
    name: "B10 Telefonico · reporte",
    file: "features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx",
    rootMarker: 'className="mon-gs-report-tabs"',
    relationStem: "mon-gs-report",
  },
  {
    name: "B11 RecopiladoresShell",
    file: "features/recopiladores/RecopiladoresShell.tsx",
    rootMarker: 'className="rec-tab-list"',
    relationStem: "rec-tab",
    singleOptionGuard: true,
  },
  {
    name: "B12 FocusedWorkspace · configuración",
    file: "features/xlsformEditor/canvas/FocusedWorkspace.tsx",
    rootMarker: 'className="pulso-focus-tabs"',
    relationStem: "pulso-focus",
  },
  {
    name: "B13 XLSForm Inspector",
    file: "features/xlsformEditor/inspector/Inspector.tsx",
    rootMarker: 'className="pulso-inspector-tabs"',
    relationStem: "pulso-inspector",
  },
  {
    name: "B14 CronogramaSection",
    file: "features/bitacora/CronogramaSection.tsx",
    rootMarker: "plan-vista-switch plan-command-side",
    relationStem: "plan-vista",
  },
] as const;

describe("ARIA selector and tab relationship audit", () => {
  test.each(SELECTORS_WITHOUT_PANELS)("$name", (spec) => {
    expect(auditSelector(spec), spec.name).toEqual([]);
  });

  test.each(REAL_TABSETS)("$name", (spec) => {
    expect(auditTabset(spec), spec.name).toEqual([]);
  });

  test("ModeToolbar queda excluido mientras siga sin consumidor productivo", () => {
    const consumers = readSources([".ts", ".tsx"])
      .filter((source) => source.relative !== "features/graficos/v2/shell/ModeToolbar.tsx")
      .filter((source) => /\bModeToolbar\b/.test(source.text))
      .map((source) => source.relative);

    expect(
      consumers,
      "Si ModeToolbar vuelve a ser alcanzable debe incorporarse al inventario semántico",
    ).toEqual([]);
  });
});
