// Ronda 18, ítem 1: «N en la leyenda» (`leyenda_con_n`, bool sin default en el registro) va en tres estados: Automático
// (NULL, el motor decide), Sí y No. Un interruptor no podía decir «Automático» sin mentir uno de los otros dos.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { DatosGrafico } from "./DatosGrafico";

const a = (name: string, tipo_input: ArgMetadata["tipo_input"], extra: Partial<ArgMetadata> = {}): ArgMetadata =>
  ({ name, label: name, tipo_input, grupo: "estilo", descripcion: "", ...extra });

const REGISTRO: Record<string, { args: ArgMetadata[] }> = {
  p_dumbbell: { args: [a("leyenda_con_n", "bool", { label: "N en la leyenda" }), a("mostrar_brecha", "bool", { default: true })] },
};

vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "", pathname: "/graficos" }), useNavigate: () => () => undefined }));
const ESTADO = { updateSlotArgs: () => undefined, presets: {}, plan: { slides: [] }, aplicarAjusteAlTipo: () => undefined, undo: () => undefined };
vi.mock("../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO), SLIDE_GRAF_SLOTS: {} }));
const UI = { setEditorAmplio: () => undefined, seccionesTarjeta: {}, seccionReciente: null, alternarSeccionTarjeta: () => undefined, abrirSeccionTarjeta: () => undefined };
vi.mock("./laminasStore", () => ({ useLaminasUi: Object.assign((sel: (s: typeof UI) => unknown) => sel(UI), { getState: () => UI }) }));
vi.mock("../useGraficosRegistry", () => ({ useGraficosRegistry: () => ({ graficadoresById: REGISTRO }) }));
vi.mock("../reportScope", () => ({ useGraficosReportScope: () => "active" }));
vi.mock("../../../lib/SessionContext", () => ({ useSession: () => ({ state: { active_base: "b1" } }) }));
vi.mock("../VariablePicker", () => ({ default: () => null }));
vi.mock("./brecha/BrechaEntreGrupos", () => ({ BrechaEntreGrupos: () => null }));
vi.mock("./tarjetaGrafico/EnElWord", () => ({ EnElWord: () => null }));
vi.mock("./colores/ColoresGrafico", () => ({ ColoresGrafico: () => null }));
vi.mock("./diferencias/DiferenciasInspector", () => ({ DiferenciasInspector: () => null }));

const fila = (args: Record<string, unknown>) => {
  const valor: GraficadorRef = { graficador: "p_dumbbell", args };
  const html = renderToStaticMarkup(<DatosGrafico slideId="s1" slot="grafico" valor={valor} />);
  return html.match(/data-qa="triestado-leyenda_con_n"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
};
const elegida = (html: string) => html.match(/aria-checked="true"[^>]*>(?:<[^>]+>)*([^<]+)</)?.[1];

describe("DatosGrafico, «N en la leyenda» en tres estados", () => {
  it("sale en el dumbbell como segmentado Automático / Sí / No", () => {
    const html = fila({});
    expect(html).toContain("N en la leyenda");
    expect(html).toContain("Automático");
    expect(html).toContain("Sí");
    expect(html).toContain("No");
    expect(html).not.toContain('role="switch"');
  });
  it("sin valor guardado marca Automático; true marca Sí y false marca No", () => {
    expect(elegida(fila({}))).toBe("Automático");
    expect(elegida(fila({ leyenda_con_n: true }))).toBe("Sí");
    expect(elegida(fila({ leyenda_con_n: false }))).toBe("No");
  });
});
