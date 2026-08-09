import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GraficadorMetadata } from "../../api/client";
import { PANELES_POR_MODULO } from "../../lib/navegacion/manifiesto";
import {
  panelAbiertoEn,
  searchConPanel,
  searchSinPanel,
} from "../../lib/navegacion/paneles";
import { graficadorAvailabilityLabel } from "./GraficadorPicker";
import { compatibleGraficadorRef } from "./GraficosLibrariesHost";
import {
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_BIBLIOTECA_SLIDES,
  PANELES_GRAFICOS,
} from "./panelesGraficos";
import { resolveLibraryReturnFocus } from "./useLibraryDialogA11y";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return fs.readFileSync(path.join(featureDir, relativePath), "utf8");
}

function cssRuleBodies(source: string, selector: string): string[] {
  const normalizeSelector = (value: string) => value
    .replace(/\s*>\s*/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  const expected = normalizeSelector(selector);
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(",").map(normalizeSelector).includes(expected))
    .map((match) => match[2]);
}

function hasCssDeclaration(body: string, property: string, value: string): boolean {
  return body.split(";").some((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 0) return false;
    return declaration.slice(0, separator).trim() === property &&
      declaration.slice(separator + 1).trim() === value;
  });
}

describe("bibliotecas de Gráficos como paneles direccionables", () => {
  it("declara ids estables y los registra en Procesamiento", () => {
    expect(PANEL_BIBLIOTECA_SLIDES).toMatchObject({
      id: "biblioteca-slides",
      clase: "dialogo",
    });
    expect(PANEL_BIBLIOTECA_GRAFICADORES).toMatchObject({
      id: "biblioteca-graficadores",
      clase: "dialogo",
    });
    expect(PANELES_POR_MODULO.procesamiento).toBe(PANELES_GRAFICOS);
  });

  it("abre uno solo y preserva todos los otros params al abrir o cerrar", () => {
    const initial = "?modo=edicion&seccion=graficos&pestana=contenido&foco=slide-7&origen=qa";
    const withSlides = searchConPanel(initial, PANEL_BIBLIOTECA_SLIDES);

    expect(withSlides).toBe(
      `${initial}&panel=${PANEL_BIBLIOTECA_SLIDES.id}`,
    );
    expect(panelAbiertoEn(withSlides, PANEL_BIBLIOTECA_SLIDES)).toBe(true);
    expect(panelAbiertoEn(withSlides, PANEL_BIBLIOTECA_GRAFICADORES)).toBe(false);

    const withGraficadores = searchConPanel(
      withSlides,
      PANEL_BIBLIOTECA_GRAFICADORES,
    );
    expect(withGraficadores).toBe(
      `${initial}&panel=${PANEL_BIBLIOTECA_GRAFICADORES.id}`,
    );
    expect(searchSinPanel(withGraficadores, PANEL_BIBLIOTECA_GRAFICADORES)).toBe(
      initial,
    );
  });

  it("mantiene un solo host y saca los Dialog de Timeline y de cada slot", () => {
    const host = read("GraficosLibrariesHost.tsx");
    const page = read("GraficosPage.tsx");
    const slot = read("GraficadorSlot.tsx");
    const timeline = read("v2/timeline/TimelinePanelV2.tsx");
    const slidePicker = read("v2/timeline/SlidePicker.tsx");
    const graficadorPicker = read("GraficadorPicker.tsx");

    expect(host.match(/usePanelDireccionable\(/g)).toHaveLength(2);
    expect(host.match(/usePanelDireccionable\(PANEL_BIBLIOTECA_SLIDES\)/g)).toHaveLength(1);
    expect(host.match(/usePanelDireccionable\(PANEL_BIBLIOTECA_GRAFICADORES\)/g)).toHaveLength(1);
    expect(page).toMatch(/<GraficosLibrariesHost>\s*<EditorShell\s*\/>/);
    expect(slot).not.toMatch(/pickerOpen|GraficadorPicker|Dialog\./);
    expect(timeline).not.toMatch(/pickerOpen|<SlidePicker\b|Dialog\./);
    expect(slidePicker).toContain("{...panel.props}");
    expect(graficadorPicker).toContain("{...panel.props}");
  });

  it("deja el deep link de graficadores en consulta y solo habilita commit con target", () => {
    const host = read("GraficosLibrariesHost.tsx");
    const picker = read("GraficadorPicker.tsx");

    expect(host).toContain(
      "onPick={graficadorTarget ? commitGraficador : undefined}",
    );
    expect(host).toContain("const state = usePlanStore.getState()");
    expect(host).not.toMatch(/selectedSlideId|setViewMode|setInspectorTab/);
    expect(picker).toContain("Catálogo en modo consulta");
    expect(picker).toContain("if (onPick && canInsertGraficador(graf, dimOk))");
  });

  it("cierra el request síncronamente y conserva el ref capturado hasta el retorno", () => {
    const host = read("GraficosLibrariesHost.tsx");
    const picker = read("GraficadorPicker.tsx");
    const helper = read("useLibraryDialogA11y.ts");

    expect(host).toMatch(
      /const closeGraficadoresLibrary = useCallback\(\(\) => \{\s*setGraficadorTarget\(null\);\s*graficadoresPanel\.cerrar\(\);/,
    );
    expect(host).toMatch(
      /if \(!graficadoresPanel\.abierto\) setGraficadorTarget\(null\);/,
    );
    expect(host).toContain("const target = graficadorTarget;");
    expect(host).not.toContain("onAfterClose");
    expect(picker).not.toContain("onAfterClose");
    expect(helper).not.toContain("onAfterClose");
    expect(helper).toContain(
      "capturedReturnFocusRef.current = returnFocusRef ?? null;",
    );
    expect(helper).toContain(
      "[cancelAutofocus, cancelReturn, returnFocusRef, searchRef]",
    );
    expect(helper).toContain(
      "capturedReturnFocusRef.current?.current ?? null",
    );
  });

  it("no devuelve foco sobre otro modal ni abre slides con N/A dentro de un diálogo", () => {
    const helper = read("useLibraryDialogA11y.ts");
    const timeline = read("v2/timeline/TimelinePanelV2.tsx");

    expect(helper).toContain(
      `'[role="dialog"][aria-modal="true"][data-state="open"]'`,
    );
    expect(helper).toContain("document.querySelector(OPEN_MODAL_DIALOG_SELECTOR)");
    expect(helper).toContain("closingCycle !== openCycleRef.current");
    expect(timeline).toContain(
      `t?.closest('[role="dialog"][aria-modal="true"]')`,
    );
  });

  it("preserva solo args compatibles al cambiar de modelo", () => {
    const meta: GraficadorMetadata = {
      name: "p_nuevo",
      titulo_humano: "Nuevo",
      descripcion: "Modelo de prueba",
      icono_ui: "BarChart",
      args: [
        { name: "variable", label: "Variable", tipo_input: "variable", grupo: "datos" },
        { name: "mostrar", label: "Mostrar", tipo_input: "bool", grupo: "estilo" },
        { name: "titulo", label: "Título", tipo_input: "string", grupo: "textos" },
      ],
      args_extra: [],
    };

    expect(compatibleGraficadorRef(meta, {
      graficador: "p_anterior",
      args: { variable: "p1", mostrar: false, titulo: null, obsoleto: "fuera" },
    })).toEqual({
      graficador: "p_nuevo",
      args: { variable: "p1", mostrar: false, titulo: null },
    });
  });

  it("describe consulta como revisión sin ocultar requisitos previos", () => {
    const ready: GraficadorMetadata = {
      name: "p_listo",
      titulo_humano: "Listo",
      descripcion: "Modelo de prueba",
      icono_ui: "BarChart",
      args: [],
      args_extra: [],
    };

    expect(graficadorAvailabilityLabel(ready, true, true)).toBe("Listo para revisar");
    expect(graficadorAvailabilityLabel(ready, true, false)).toBe("Listo para insertar");
    expect(graficadorAvailabilityLabel({
      ...ready,
      requisito: "dimensiones",
    }, false, true)).toBe("Requiere dimensiones");
    expect(graficadorAvailabilityLabel({
      ...ready,
      available: false,
    }, true, true)).toBe("No disponible");
  });

  it("resuelve el retorno dentro del orden anterior, trigger y ancla", () => {
    const connected = (id: string) => ({ id, isConnected: true }) as unknown as HTMLElement;
    const disconnected = (id: string) => ({ id, isConnected: false }) as unknown as HTMLElement;
    const previous = connected("previous");
    const requested = connected("requested");
    const fallback = connected("fallback");

    expect(resolveLibraryReturnFocus(previous, requested, fallback)).toBe(previous);
    expect(resolveLibraryReturnFocus(disconnected("previous"), requested, fallback)).toBe(requested);
    expect(resolveLibraryReturnFocus(null, disconnected("requested"), fallback)).toBe(fallback);
  });

  it("muestra íntegro el nombre del estilo en lista, focus-card y opción portada", () => {
    const css = read("chartLayoutEditor.css");
    const selectors = [
      ".pulso-gv2-overrides-list .pulso-gv2-mode-list-label",
      ".pulso-gv2-override-focus-grid span.is-mode > b",
      '.pulso-gv2-mode-option[data-kind="mode"] .pulso-gv2-mode-option-label',
    ];
    const declarations = [
      ["overflow", "visible"],
      ["text-overflow", "clip"],
      ["white-space", "normal"],
      ["overflow-wrap", "anywhere"],
    ];

    expect(selectors.map((selector) => ({
      selector,
      hasCompleteRule: cssRuleBodies(css, selector).some((body) =>
        declarations.every(([property, value]) => hasCssDeclaration(body, property, value))
      ),
    }))).toEqual(selectors.map((selector) => ({ selector, hasCompleteRule: true })));
  });

  it("impide que el listado comprima las filas de estilos con nombres largos", () => {
    const css = read("chartLayoutEditor.css");
    const selector = ".pulso-gv2-overrides-list > .pulso-gv2-mode-list-item";

    expect(cssRuleBodies(css, selector).some((body) =>
      hasCssDeclaration(body, "flex", "0 0 auto")
    )).toBe(true);
  });
});
