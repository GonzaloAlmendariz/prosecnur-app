// C40 pintado: la tarjeta de un gráfico muestra la guarda junto al control en TODAS las formas de fila (interruptor,
// número, códigos) y el interruptor sin valor guardado dice lo que el motor dibuja (su default del registro).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { AYUDA_BRECHA, AYUDA_CEROS, AYUDA_CORTES, AYUDA_EJE_MIN, AYUDA_MIN_N } from "./argsDatosGrafico";
import { DatosGrafico } from "./DatosGrafico";

const a = (name: string, tipo_input: ArgMetadata["tipo_input"], extra: Partial<ArgMetadata> = {}): ArgMetadata =>
  ({ name, label: name, tipo_input, grupo: "datos", descripcion: "", ...extra });

const REGISTRO: Record<string, { args: ArgMetadata[] }> = {
  p_dumbbell: { args: [a("orden", "choice", { default: "brecha", choices: [{ value: "brecha", label: "Por brecha" }] }),
    a("mostrar_brecha", "bool", { default: true }), a("umbral_brecha_pct", "number")] },
  p_barras_agrupadas: { args: [a("mostrar_ceros", "bool", { default: false }), a("invertir_leyenda", "bool")] },
  p_radar: { args: [a("modo", "choice", { choices: [{ value: "publicos", label: "Públicos" }] }),
    a("eje_min", "number", { default: 0, depende: { arg: "modo", valores: ["publicos"] } })] },
  p_mapa_resultado_distrital: { args: [a("min_n", "number", { default: 1 }), a("cortes", "codigos_list")] },
};

vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "" }) }));
vi.mock("../store", () => ({ usePlanStore: (sel: (s: { updateSlotArgs: () => void }) => unknown) => sel({ updateSlotArgs: () => undefined }) }));
vi.mock("./laminasStore", () => ({ useLaminasUi: (sel: (s: { setEditorAmplio: () => void }) => unknown) => sel({ setEditorAmplio: () => undefined }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ graficadoresById: REGISTRO }) }));
vi.mock("../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { active_base: "b1" } }) }));
vi.mock("../VariablePicker", () => ({ default: () => null }));
vi.mock("./tarjetaGrafico/TwoBoxGrafico", () => ({ TwoBoxGrafico: () => null }));
vi.mock("./tarjetaGrafico/EnElWord", () => ({ EnElWord: () => null }));
vi.mock("./colores/ColoresGrafico", () => ({ ColoresGrafico: () => null }));

const pintar = (graficador: string, args: Record<string, unknown> = {}) => {
  const valor: GraficadorRef = { graficador, args };
  return renderToStaticMarkup(<DatosGrafico slideId="s1" slot="grafico" valor={valor} />);
};
const ayudaDe = (html: string, texto: string) => html.includes(`class="pulso-f6-dato-ayuda">${texto}</span>`);

describe("DatosGrafico · C40", () => {
  it("interruptor: la guarda se lee y, sin guardar, el estado es el default del registro", () => {
    const html = pintar("p_dumbbell");
    expect(ayudaDe(html, AYUDA_BRECHA)).toBe(true);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(pintar("p_dumbbell", { mostrar_brecha: false })).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).not.toContain("umbral_brecha_pct");
  });
  it("mostrar_ceros lleva la guarda de 90–99 y un retirado guardado no aparece", () => {
    const html = pintar("p_barras_agrupadas", { invertir_leyenda: true });
    expect(ayudaDe(html, AYUDA_CEROS)).toBe(true);
    expect(html).not.toMatch(/invertir_leyenda|Invertir leyenda/);
  });
  it("número: el piso del radar entre públicos con su aviso, enlazado al control", () => {
    const html = pintar("p_radar", { modo: "publicos" });
    expect(ayudaDe(html, AYUDA_EJE_MIN)).toBe(true);
    const id = /<input id="([^"]+)" type="number"[^>]*aria-describedby="([^"]+)"/.exec(html);
    expect(id?.[2]).toBe(`${id?.[1]}-ayuda`);
  });
  it("mapa distrital: casos mínimos y cortes con su guarda y el default del motor como placeholder", () => {
    const html = pintar("p_mapa_resultado_distrital");
    expect(ayudaDe(html, AYUDA_MIN_N)).toBe(true);
    expect(ayudaDe(html, AYUDA_CORTES)).toBe(true);
    expect(html).toContain('placeholder="55, 65, 75"');
  });
});
