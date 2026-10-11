import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrato A5 2b (W1): «Armar desde…» es `panel=armar-desde` (usePanelDireccionable), en el compartido queda
// `aria-disabled` con su motivo y no pide nada, y los vacíos de Láminas y Vista general lo ofrecen.

const planSugerido = vi.fn();
vi.mock("../../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/client")>()),
  apiGraficosPlanSugerido: (...args: unknown[]) => planSugerido(...args),
}));
vi.mock("../usePptStyleProfiles", () => ({ usePptStyleProfiles: () => ({ profiles: [] }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ registry: null, graficadoresById: {} }) }));
vi.mock("../../project/ProjectShell", () => ({ useOptionalProjectShell: () => null }));

const { SuggestedPlanButton } = await import("../SuggestedPlanButton");
const { BotonArmarDesdeVacio } = await import("./BotonArmarDesdeVacio");
const { MOTIVO_ARMAR_DESDE_CONSOLIDADO } = await import("./aplicarPlanSugerido");

const en = (url: string, nodo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [url] }, nodo));

describe("«Armar desde…» · panel direccionable y alcance", () => {
  beforeEach(() => planSugerido.mockReset());

  // Mata: volver a un `useState` local para abrir (el enlace no reproduciría la vista).
  it("?panel=armar-desde abre el popover; sin el param queda cerrado", () => {
    const abierto = en("/procesamiento?seccion=graficos&pestana=vista-general&panel=armar-desde", createElement(SuggestedPlanButton));
    expect(abierto).toContain('role="dialog"');
    expect(abierto).toContain('data-pulso-panel="armar-desde"');
    expect(abierto).toContain('aria-expanded="true"');
    const cerrado = en("/procesamiento?seccion=graficos&pestana=vista-general", createElement(SuggestedPlanButton));
    expect(cerrado).not.toContain('role="dialog"');
    expect(cerrado).toContain('aria-expanded="false"');
    expect(cerrado).toContain("Armar desde…");
  });

  // Mata: ignorar el alcance consolidado.
  it("informe compartido: aria-disabled, motivo y 0 llamadas a /plan/sugerido", () => {
    const html = en("/procesamiento?seccion=graficos&pestana=laminas&scope=consolidado&panel=armar-desde", createElement(SuggestedPlanButton));
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(MOTIVO_ARMAR_DESDE_CONSOLIDADO);
    expect(html).not.toContain("Actualizar propuesta");
    expect(planSugerido).not.toHaveBeenCalled();
  });

  it("CTA de los vacíos: activo fuera del compartido, aria-disabled con motivo dentro", () => {
    const activo = en("/procesamiento?seccion=graficos&pestana=laminas", createElement(BotonArmarDesdeVacio));
    expect(activo).toContain("Armar desde un plan sugerido");
    expect(activo).not.toContain("aria-disabled");
    const compartido = en("/procesamiento?seccion=graficos&pestana=laminas&scope=consolidado", createElement(BotonArmarDesdeVacio));
    expect(compartido).toContain('aria-disabled="true"');
    expect(compartido).toContain(MOTIVO_ARMAR_DESDE_CONSOLIDADO);
  });
});

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fuente = (rel: string) => fs.readFileSync(path.join(AQUI, rel), "utf8");

describe("vacíos y avisos (lectura de la fuente: el vacío y la Vista general necesitan la pila para montarse)", () => {
  // Mata: dejar «Ir al Editor anterior» como salida del vacío de Láminas.
  it("el vacío de Láminas ofrece «Armar desde» y ya no «Ir al Editor anterior»", () => {
    const src = fuente("../laminas/LaminasWorkbench.tsx");
    const vacio = src.slice(src.indexOf("if (!lamina || !slide)"), src.indexOf("return (", src.indexOf("if (!lamina || !slide)") + 40));
    expect(vacio).toContain("<BotonArmarDesdeVacio />");
    expect(src).not.toContain("Ir al Editor anterior");
  });

  it("el vacío de Vista general ofrece «Armar desde» y «N avisos» abre PanelAvisos dentro de la vista", () => {
    const src = fuente("../vistaGeneral/VistaGeneral.tsx");
    const vacio = src.slice(src.indexOf("if (!slides.length)"), src.indexOf("let indiceCapitulo"));
    expect(vacio).toContain("<BotonArmarDesdeVacio />");
    expect(src).not.toContain("Ir al Editor anterior");
    expect(src).toMatch(/<AvisosVistaGeneral estructura=\{estructura\} onIr=\{abrir\} \/>/);
    const avisos = fuente("../vistaGeneral/AvisosVistaGeneral.tsx");
    expect(avisos).toContain("usePanelDireccionable(PANEL_AVISOS_INFORME)");
    expect(avisos).toContain("<PanelAvisos");
  });

  it("SuggestedPlanButton abre por la dirección y aplica en un paso", () => {
    const src = fuente("../SuggestedPlanButton.tsx");
    expect(src).toContain("usePanelDireccionable(PANEL_ARMAR_DESDE)");
    expect(src).not.toMatch(/useState\(false\);\s*\n\s*const \[busy/);
    expect(src).toContain("aplicarPlanSugerido({");
    expect(src).not.toMatch(/\b(loadPlan|setEquivalenciasRevision|setScopeRules|applyPptStyleProfile)\(/);
  });
});
