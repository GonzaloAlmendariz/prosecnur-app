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
});
