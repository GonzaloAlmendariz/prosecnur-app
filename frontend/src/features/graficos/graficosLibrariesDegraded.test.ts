import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GraficadorMetadata, Registry } from "../../api/client";
import {
  canInsertGraficador,
  deriveGraficadorLibraryState,
  graficadorDimensionsReady,
  graficadorInspectorDisabledReason,
} from "./GraficadorPicker";
import {
  graficosRegistryErrorLogLine,
  graficosRegistryMaps,
  publicGraficosRegistryError,
  visibleGraficosRegistrySnapshot,
  type GraficosRegistrySnapshot,
} from "./useGraficosRegistry";
import { deriveSlideLibraryState } from "./v2/timeline/SlidePicker";

const featureDir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ERROR =
  "No pudimos consultar el catálogo de Gráficos. Revisa la conexión y recarga la aplicación para reintentar.";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(featureDir, relativePath), "utf8");
}

function cssRule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No se encontró la regla ${selector}`);
  const bodyStart = source.indexOf("{", start);
  const bodyEnd = source.indexOf("}", bodyStart);
  return source.slice(bodyStart + 1, bodyEnd);
}

function graficador(
  requisito: GraficadorMetadata["requisito"] = undefined,
  available = true,
): GraficadorMetadata {
  return {
    name: "p_prueba",
    titulo_humano: "Prueba",
    descripcion: "Modelo para probar el guard.",
    icono_ui: "BarChart3",
    categoria: "other",
    blueprint: "future",
    requisito,
    available,
    args: [],
    args_extra: [],
  };
}

describe("bibliotecas de Gráficos degradadas L5", () => {
  it("convierte cualquier rechazo del registry en un detalle público constante", () => {
    const causes: unknown[] = [
      new Error("stack privado"),
      "respuesta técnica",
      { body: "detalle del backend" },
      new Error(""),
      undefined,
    ];

    expect(causes.map(publicGraficosRegistryError)).toEqual(
      causes.map(() => PUBLIC_ERROR),
    );
  });

  it("registra sólo tipo, nombre y código corto sin filtrar mensaje, body o stack", () => {
    const codedError = Object.assign(new Error("token-secreto"), {
      code: "E_REGISTRY_TIMEOUT",
    });
    const causes: unknown[] = [
      codedError,
      "body-secreto",
      { body: "payload-secreto", code: "E_REGISTRY_BAD" },
      new Error(""),
      undefined,
    ];
    const lines = causes.map(graficosRegistryErrorLogLine);

    expect(lines[0]).toContain("type=object name=Error code=E_REGISTRY_TIMEOUT");
    expect(lines[1]).toContain("type=string name=String");
    expect(lines[2]).toContain("type=object name=Object code=E_REGISTRY_BAD");
    expect(lines.join(" ")).not.toMatch(/token-secreto|body-secreto|payload-secreto|stack privado/);

    const hook = read("useGraficosRegistry.ts");
    expect(hook).toContain('import * as logSink from "../../lib/logSink";');
    expect(hook).toContain(
      'logSink.note(graficosRegistryErrorLogLine(cause), "error");',
    );
  });

  it("cierra registry y maps de A al renderizar B pendiente o fallido", () => {
    const registryA: Registry = {
      slides: [],
      graficadores: [graficador()],
    };
    const snapshotA: GraficosRegistrySnapshot = {
      sid: "sid-a",
      registry: registryA,
      loading: false,
      error: "",
    };

    const pendingB = visibleGraficosRegistrySnapshot("sid-b", snapshotA);
    expect(pendingB).toEqual({
      sid: "sid-b",
      registry: null,
      loading: true,
      error: "",
    });
    expect(graficosRegistryMaps(pendingB.registry)).toEqual({
      slidesById: {},
      graficadoresById: {},
    });

    const failedB: GraficosRegistrySnapshot = {
      ...pendingB,
      loading: false,
      error: PUBLIC_ERROR,
    };
    expect(visibleGraficosRegistrySnapshot("sid-b", failedB)).toBe(failedB);
    expect(graficosRegistryMaps(failedB.registry).graficadoresById).not.toHaveProperty(
      "p_prueba",
    );

    const hook = read("useGraficosRegistry.ts");
    expect(hook).toContain("const optionalSession = useOptionalSession();");
    expect(hook).toContain("optionalSession ? optionalSession.sessionId || null : getSession()");
  });

  it("deriva la misma precedencia ready/loading/error/empty/no-results en ambas bibliotecas", () => {
    const cases = [
      { args: [true, "", 0, 0] as const, expected: "loading" },
      { args: [false, PUBLIC_ERROR, 0, 0] as const, expected: "error" },
      { args: [false, "", 0, 0] as const, expected: "empty" },
      { args: [false, "", 19, 0] as const, expected: "no-results" },
      { args: [false, "", 19, 3] as const, expected: "ready" },
    ] as const;

    for (const testCase of cases) {
      const [loading, error, inventoryCount, filteredCount] = testCase.args;
      expect(
        deriveGraficadorLibraryState(loading, error, inventoryCount, filteredCount),
      ).toBe(testCase.expected);
      expect(
        deriveSlideLibraryState(loading, error, inventoryCount, filteredCount),
      ).toBe(testCase.expected);
    }
  });

  it("conserva los guards dimOk y available", () => {
    expect(canInsertGraficador(graficador("dimensiones"), false)).toBe(false);
    expect(canInsertGraficador(graficador("dimensiones"), true)).toBe(true);
    expect(canInsertGraficador(graficador(undefined, false), true)).toBe(false);
    expect(canInsertGraficador(graficador(), false)).toBe(true);
  });

  it("cierra dimensiones mientras registry B todavía convive con state A", () => {
    expect(graficadorDimensionsReady("sid-a", "sid-b", true)).toBe(false);
    expect(graficadorDimensionsReady("sid-b", "sid-b", false)).toBe(false);
    expect(graficadorDimensionsReady("sid-b", "sid-b", true)).toBe(true);

    const picker = read("GraficadorPicker.tsx");
    expect(picker).toContain("const { state, sessionId } = useSession();");
    expect(picker).toMatch(
      /const dimOk = graficadorDimensionsReady\(\s*state\?\.session_id,\s*sessionId,\s*state\?\.analitica_dim_ok,/,
    );
  });

  it("declara una sola región viva dentro de cada listitem y silencia counts degradados", () => {
    const graficadorPicker = read("GraficadorPicker.tsx");
    const slidePicker = read("v2/timeline/SlidePicker.tsx");

    const contracts = [
      {
        source: graficadorPicker,
        helper: "graficadorLibraryStateA11y",
        stateClass: "pulso-graficador-library-state",
        regionClass: "pulso-graficador-library-state-region",
      },
      {
        source: slidePicker,
        helper: "slideLibraryStateA11y",
        stateClass: "pulso-slide-library-empty",
        regionClass: "pulso-slide-library-state-region",
      },
    ] as const;

    for (const { source, helper, regionClass, stateClass } of contracts) {
      expect(source).toContain('role: state === "error" ? "alert" : "status"');
      expect(source).toContain('"aria-live": state === "error" ? "assertive" : "polite"');
      expect(source).toContain('"aria-atomic": "true"');
      expect(source).toContain('"aria-busy": state === "loading" ? "true" : undefined');
      expect(source.match(new RegExp(`\\{\\.\\.\\.${helper}\\(state\\)\\}`, "g"))).toHaveLength(1);
      expect(source).toMatch(new RegExp(
        `<li[\\s\\S]*?className="${stateClass}"[\\s\\S]*?>\\s*<div[\\s\\S]*?className="${regionClass}"[\\s\\S]*?\\{\\.\\.\\.${helper}\\(state\\)\\}`,
      ));
      expect(source).toContain('data-qa-geometry-contract="intrinsic"');
      expect(source).toContain('data-qa-geometry-capacity="owned"');
      expect(source).toMatch(/<PulsoButton[\s\S]*?disabled[\s\S]*?>[\s\S]*?Insertar modelo/);
      expect(source).toContain(
        'aria-live={libraryState === "ready" ? "polite" : undefined}',
      );
    }
  });

  it("mantiene retry honesto y prioriza modo consulta en Graph", () => {
    const graficadorPicker = read("GraficadorPicker.tsx");
    const slidePicker = read("v2/timeline/SlidePicker.tsx");
    const hook = read("useGraficosRegistry.ts");

    expect(graficadorInspectorDisabledReason("loading", "Sólo consulta")).toBe(
      "Sólo consulta",
    );
    expect(graficadorInspectorDisabledReason("error", "")).toBe(
      "Revisa la conexión y recarga la aplicación para reintentar.",
    );

    for (const source of [graficadorPicker, slidePicker, hook]) {
      expect(source).not.toMatch(/Cierra y vuelve a abrir|Vuelve a abrir la biblioteca/);
    }
    expect(graficadorPicker).not.toContain("window.location.reload");
    expect(slidePicker).not.toContain("window.location.reload");
  });

  it("redistribuye rail e inspector sin cambiar el ancho agregado", () => {
    const graficadorCss = read("graficadorPicker.css");
    const slideCss = read("v2/timeline/slidePicker.css");
    const graficadorRailCss = graficadorCss.slice(
      graficadorCss.indexOf(".pulso-graficador-library-filter {"),
      graficadorCss.indexOf(".pulso-graficador-library-gallery {"),
    );

    expect(graficadorCss).toContain(
      "grid-template-columns: 196px minmax(0, 1fr) 296px;",
    );
    expect(graficadorCss).toContain(
      "grid-template-columns: 170px minmax(0, 1fr) 258px;",
    );
    expect(graficadorCss).toMatch(
      /@media \(max-width: 1150px\)[\s\S]*?\.pulso-graficador-library-filter-copy small \{\s*display: none;/,
    );
    expect(graficadorCss).toMatch(
      /\.pulso-graficador-library-filter-copy strong \{[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal;/,
    );
    expect(graficadorRailCss).not.toContain("overflow-wrap: anywhere;");
    expect(graficadorRailCss.match(/overflow-wrap: normal;/g)).toHaveLength(4);
    expect(graficadorRailCss.match(/word-break: normal;/g)).toHaveLength(4);

    expect(slideCss).toContain(
      "grid-template-columns: 156px minmax(0, 1fr) 236px;",
    );
    expect(slideCss).toContain(
      "grid-template-columns: 156px minmax(0, 1fr) 212px;",
    );
    expect(slideCss).toMatch(
      /@media \(max-width: 1180px\), \(max-height: 720px\)[\s\S]*?\.pulso-slide-library-filter-copy small \{\s*display: none;/,
    );
    expect(slideCss).toMatch(
      /\.pulso-slide-library-filter-copy strong \{[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal;/,
    );
    expect(slideCss).toMatch(
      /@media \(max-width: 1060px\)[\s\S]*?\.pulso-slide-library-gallery-heading p,\s*\.pulso-slide-library-card-selected \{\s*display: none;/,
    );
  });

  it("evita cuatro cards estrechas en el ancho máximo y permite dos líneas de copy", () => {
    const slideCss = read("v2/timeline/slidePicker.css");
    const compactMarker = "@media (max-width: 1180px), (max-height: 720px) {";
    const compactStart = slideCss.indexOf(compactMarker);
    const compactEnd = slideCss.indexOf("@media (max-width: 1060px) {", compactStart);

    expect(compactStart).toBeGreaterThan(-1);
    expect(compactEnd).toBeGreaterThan(compactStart);

    const baseCss = slideCss.slice(0, compactStart);
    const compactCss = slideCss.slice(compactStart, compactEnd);
    const rule = (source: string, selector: string): string => {
      const start = source.indexOf(`${selector} {`);
      expect(start, `No se encontró ${selector} en el bloque esperado`).toBeGreaterThan(-1);
      const bodyStart = source.indexOf("{", start);
      const bodyEnd = source.indexOf("}", bodyStart);
      return source.slice(bodyStart + 1, bodyEnd);
    };

    const baseGrid = rule(baseCss, ".pulso-slide-library-grid");
    const baseFrame = rule(baseCss, ".pulso-slide-library-card-frame");
    const cardTitle = rule(baseCss, ".pulso-slide-library-card-copy strong");
    const cardDescription = rule(baseCss, ".pulso-slide-library-card-copy > span");
    const compactGrid = rule(compactCss, ".pulso-slide-library-grid");
    const compactFrame = rule(compactCss, ".pulso-slide-library-card-frame");

    expect.soft(baseGrid).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));",
    );
    expect.soft(baseGrid).toContain("grid-auto-rows: 286px;");
    expect.soft(baseFrame).toContain("height: 286px;");
    expect.soft(cardTitle).toContain("-webkit-line-clamp: 2;");
    expect.soft(cardTitle).toContain("white-space: normal;");
    expect.soft(cardDescription).toContain("-webkit-line-clamp: 2;");
    expect.soft(cardDescription).toContain("white-space: normal;");
    expect.soft(compactGrid).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));",
    );
    expect.soft(compactGrid).toContain("grid-auto-rows: 248px;");
    expect.soft(compactFrame).toContain("height: 248px;");
  });

  it("distribuye las cards del graficador hasta el borde útil en base y compacto", () => {
    const css = read("graficadorPicker.css");
    const compactStart = css.indexOf("@media (max-width: 1150px) {");

    expect(compactStart).toBeGreaterThan(-1);
    const baseGrid = cssRule(css.slice(0, compactStart), ".pulso-graficador-library-grid");
    const compactGrid = cssRule(css.slice(compactStart), ".pulso-graficador-library-grid");
    const fluidColumns = /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\([^,;]+,\s*1fr\)\);/;

    expect.soft(baseGrid, "La grilla base no debe dejar una columna residual vacía").toMatch(
      fluidColumns,
    );
    expect.soft(compactGrid, "La grilla compacta no debe dejar una columna residual vacía").toMatch(
      fluidColumns,
    );
  });

  it("reserva espacio para que el foco de la primera card no quede recortado", () => {
    const css = read("graficadorPicker.css");
    const grid = cssRule(css, ".pulso-graficador-library-grid");
    const padding = grid.match(/(?:^|\n)\s*padding:\s*([^;]+);/)?.[1]
      .trim()
      .split(/\s+/) ?? [];
    const top = padding[0] ?? "0";
    const left = padding.length === 1
      ? padding[0]
      : padding.length === 2
        ? padding[1]
        : padding.length === 3
          ? padding[1]
          : padding[3];
    const isZero = (value: string | undefined): boolean => /^0(?:[a-z%]+)?$/i.test(value ?? "0");
    const reservesFocusSpace = !isZero(top) && !isZero(left);
    const focusStart = css.indexOf(".pulso-graficador-library-filter:focus-visible,");
    const focusBodyStart = css.indexOf("{", focusStart);
    const focusBodyEnd = css.indexOf("}", focusBodyStart);
    const focusRule = css.slice(focusBodyStart + 1, focusBodyEnd);
    const usesInnerRing = /outline-offset:\s*-[^;]+;/.test(focusRule)
      || /box-shadow:[^;]*\binset\b/.test(focusRule);

    expect(
      reservesFocusSpace || usesInnerRing,
      "La card necesita reserva superior/izquierda o un ring interior",
    ).toBe(true);
  });

  it("mantiene completa la familia de cada card en una sola línea", () => {
    const css = read("graficadorPicker.css");
    const meta = cssRule(css, ".pulso-graficador-library-card-meta");
    const family = cssRule(css, ".pulso-graficador-library-card-meta span:first-child");

    expect(
      `${meta}\n${family}`,
      "La familia COMPARACIÓN no debe dejar la N huérfana",
    ).toMatch(/white-space:\s*nowrap;/);
  });

  it("deja el scroll vertical al stage y mantiene visibles sus tres hijos", () => {
    const css = read("graficadorPicker.css");
    const baseCss = css.slice(0, css.indexOf("@media (max-width: 1150px) {"));
    const stage = cssRule(baseCss, ".pulso-graficador-library-stage");
    const children = [
      ["rail", cssRule(baseCss, ".pulso-graficador-library-rail")],
      ["gallery", cssRule(baseCss, ".pulso-graficador-library-gallery")],
      ["grid", cssRule(baseCss, ".pulso-graficador-library-grid")],
      ["inspector", cssRule(baseCss, ".pulso-graficador-library-inspector")],
    ] as const;
    const ownsVerticalScroll = (rule: string): boolean => (
      /overflow-y:\s*(?:auto|scroll);/.test(rule)
      || /(?:^|\n)\s*overflow:\s*(?:auto|scroll);/.test(rule)
    );
    const clipsOrOwnsOverflow = (rule: string): boolean => (
      /overflow(?:-x|-y)?:\s*(?:hidden|auto|scroll);/.test(rule)
    );

    expect.soft(
      ownsVerticalScroll(stage),
      "El stage debe ser el único dueño del desplazamiento vertical",
    ).toBe(true);
    for (const [name, rule] of children) {
      expect.soft(
        clipsOrOwnsOverflow(rule),
        `${name} debe permanecer visible y delegar el scroll al stage`,
      ).toBe(false);
    }
  });
});
