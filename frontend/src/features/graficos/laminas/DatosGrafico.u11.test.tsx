// U11 y U-c pintados: la sección «Diferencias entre grupos» de una multiapilada sale sólo en el modo «cruce» y refleja un
// `overrides.mostrar_significancia` viejo; «Espacio para las etiquetas» de agrupadas vacío dice «Automático», sin cifra
// heredada del preset (la lámina nativa no la usa).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { DatosGrafico, rotuloConAyuda } from "./DatosGrafico";

const a = (name: string, tipo_input: ArgMetadata["tipo_input"], extra: Partial<ArgMetadata> = {}): ArgMetadata =>
  ({ name, label: name, tipo_input, grupo: "datos", descripcion: "", ...extra });

const SOLO_CRUCE = { depende: { arg: "modo", valores: ["cruce"] } };
const REGISTRO: Record<string, { args: ArgMetadata[] }> = {
  p_barras_multiapiladas: { args: [
    a("modo", "choice", { choices: [{ value: "var", label: "Comparar preguntas" }, { value: "cruce", label: "Abrir una pregunta por grupos" }] }),
    a("var", "variable_opt", SOLO_CRUCE), a("cruces", "variable_opt", { depende: { arg: "modo", valores: ["cruce", "var_cruce"] } }),
    a("mostrar_significancia", "bool", { default: false, ...SOLO_CRUCE }),
    a("significancia_alpha", "number", { default: 0.05, min: 0.001, max: 0.2, ...SOLO_CRUCE }),
  ] },
  p_barras_agrupadas: { args: [a("var", "variable"), a("canvas_w_etiquetas", "number", { grupo: "canvas" })] },
};

vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "", pathname: "/graficos" }), useNavigate: () => () => undefined }));
// El preset de agrupadas trae 0.45 (`.PRESETS_DEFAULT_PULSO`): la tarjeta no debe mostrarlo.
const ESTADO = {
  updateSlotArgs: () => undefined, presets: { barras_agrupadas: { canvas_w_etiquetas: 0.45 } }, plan: { slides: [] },
  aplicarAjusteAlTipo: () => undefined, undo: () => undefined,
};
vi.mock("../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO), SLIDE_GRAF_SLOTS: {} }));
const UI = { setEditorAmplio: () => undefined, seccionesTarjeta: {}, seccionReciente: null, alternarSeccionTarjeta: () => undefined, abrirSeccionTarjeta: () => undefined };
vi.mock("./laminasStore", () => ({ useLaminasUi: Object.assign((sel: (s: typeof UI) => unknown) => sel(UI), { getState: () => UI }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ graficadoresById: REGISTRO }) }));
vi.mock("../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { active_base: "b1" } }) }));
vi.mock("./OrdenCategoriasGrafico", () => ({ OrdenCategoriasGrafico: () => null }));
vi.mock("./EtiquetasCortas", () => ({ EtiquetaCortaPregunta: () => null, EtiquetasCortasPreguntas: () => null }));
vi.mock("../VariablePicker", () => ({ default: () => null }));
vi.mock("./tarjetaGrafico/TwoBoxGrafico", () => ({ TwoBoxGrafico: () => null }));
vi.mock("./tarjetaGrafico/EnElWord", () => ({ EnElWord: () => null }));
vi.mock("./colores/ColoresGrafico", () => ({ ColoresGrafico: () => null }));
vi.mock("./diferencias/DiferenciasInspector", () => ({
  DiferenciasInspector: ({ encendido, cruce }: { encendido: boolean; cruce: string }) =>
    <div data-inspector="" data-encendido={String(encendido)} data-cruce={cruce} />,
}));

const pintar = (graficador: string, args: Record<string, unknown> = {}) => {
  const valor: GraficadorRef = { graficador, args };
  return renderToStaticMarkup(<DatosGrafico slideId="s1" slot="grafico" valor={valor} />);
};

describe("DatosGrafico, U11 multiapiladas por cruce", () => {
  it("la sección sale en el modo «cruce» y no en los demás ni sin modo", () => {
    expect(pintar("p_barras_multiapiladas", { modo: "cruce", var: "p1", cruces: "sexo" })).toContain('data-inspector=""');
    expect(pintar("p_barras_multiapiladas", { modo: "var", vars: ["p1", "p2"] })).not.toContain("data-inspector");
    expect(pintar("p_barras_multiapiladas", { modo: "var_cruce", vars: ["p1"], cruces: "sexo" })).not.toContain("data-inspector");
    expect(pintar("p_barras_multiapiladas", { vars: ["p1"] })).not.toContain("data-inspector");
  });
  it("el interruptor refleja un `overrides.mostrar_significancia` viejo, que manda en el motor", () => {
    const html = pintar("p_barras_multiapiladas", { modo: "cruce", var: "p1", cruces: "sexo", mostrar_significancia: false, overrides: { mostrar_significancia: true } });
    expect(html).toContain('data-encendido="true"');
    expect(pintar("p_barras_multiapiladas", { modo: "cruce", var: "p1", cruces: "sexo" })).toContain('data-encendido="false"');
  });
  it("ni el interruptor ni el nivel son filas genéricas de Datos", () => {
    const html = pintar("p_barras_multiapiladas", { modo: "cruce", var: "p1", cruces: "sexo" });
    expect(html).not.toContain('data-campo="mostrar_significancia"');
    expect(html).not.toContain('data-campo="significancia_alpha"');
  });
});

describe("DatosGrafico, U-c espacio para las etiquetas", () => {
  // Ítem 11 (2026-11-08): es un slider; vacío marca «Auto» y no muestra cifra (la lámina la calcula).
  const fila = (html: string) => html.match(/<div class="[^"]*" data-qa="espacio-etiquetas">[\s\S]*?<\/button><\/div>/)?.[0] ?? "";
  it("vacío dice «Auto», sin el 0.45 del preset ni el 0.36 que anunciaba el registro", () => {
    const campo = fila(pintar("p_barras_agrupadas", { var: "p1" }));
    expect(campo).toContain("is-sin-cifra");
    expect(campo).toMatch(/aria-pressed="true"[^>]*>(<span[^>]*>)?Auto</);
    expect(campo).not.toMatch(/value="(45|36|0\.45|0\.36)"/);
  });
  it("con un valor guardado en `overrides` lo muestra en %", () => {
    const campo = fila(pintar("p_barras_agrupadas", { var: "p1", overrides: { canvas_w_etiquetas: 0.3 } }));
    expect(campo).toMatch(/class="pulso-f6-input pulso-f6-regla-numero" value="30"/);
    expect(campo).toMatch(/type="range"[^>]*value="30"/);
  });
});

describe("R6-9: el «?» va pegado a la última palabra del rótulo", () => {
  it("la última palabra y el «?» en un tramo que no se parte; el resto del rótulo puede bajar de línea", () => {
    const html = renderToStaticMarkup(<>{rotuloConAyuda("Pista gris hasta el 100%", <button type="button">?</button>)}</>);
    expect(html).toBe('<span class="pulso-f6-rotulo-texto">Pista gris hasta el <span style="white-space:nowrap">100%\u00a0<button type="button">?</button></span></span>');
  });
  it("sin «?» queda el texto tal cual; una sola palabra va entera junto al «?»", () => {
    expect(rotuloConAyuda("Orden", null)).toBe("Orden");
    expect(renderToStaticMarkup(<>{rotuloConAyuda("Orden", <i>?</i>)}</>)).toContain('<span style="white-space:nowrap">Orden\u00a0<i>?</i></span>');
  });
});
