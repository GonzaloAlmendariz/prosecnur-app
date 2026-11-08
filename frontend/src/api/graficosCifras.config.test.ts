// R5-12 en /cifras: el pedido suelto, el lote y los de detalle mandan la config del editor, como /regla y la vista previa.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn(async () => new Response(JSON.stringify({ ok: true, tipo: "x", cifras: [], avisos: [], por_lamina: {} }))));
vi.mock("./core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./core")>()),
  apiFetch: fetchMock,
  headers: (extra: Record<string, string> = {}) => extra,
  handle: async (res: Response) => res.json(),
}));

import { apiGraficosCifras, apiGraficosCifrasDetalle, apiGraficosCifrasDetalleLote, apiGraficosCifrasLote } from "./graficosCifras";

const cuerpo = (): Record<string, unknown> => {
  const init = (fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit] | undefined)?.[1];
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
};
const config = { presets: { panorama: { referencia: 70 } } };

describe("/cifras con la config del editor", () => {
  beforeEach(() => fetchMock.mockClear());

  it("suelto", async () => {
    await apiGraficosCifras({ graficador: "p_panorama", args: { corte: "4,5" }, config });
    expect(cuerpo()).toEqual({ graficador: "p_panorama", args: { corte: "4,5" }, config });
    await apiGraficosCifras({ graficador: "p_panorama", args: {}, scope: "consolidated" });
    expect(cuerpo()).toEqual({ graficador: "p_panorama", args: {}, scope: "consolidated" });
  });

  it("en lote", async () => {
    await apiGraficosCifrasLote({ laminas: [{ id: "0", graficador: "p_panorama", args: {} }], scope: "consolidated", config });
    expect(cuerpo()).toEqual({ laminas: [{ id: "0", slide: { graficador: "p_panorama", args: {} } }], scope: "consolidated", config });
  });

  it("con detalle, suelto y en lote", async () => {
    await apiGraficosCifrasDetalle({ graficador: "p_barras_apiladas", args: {}, caja: ["Sí"], config });
    expect(cuerpo()).toEqual({ graficador: "p_barras_apiladas", args: {}, detalle: true, caja: ["Sí"], config });
    await apiGraficosCifrasDetalleLote({ laminas: [{ id: "d0", graficador: "p_barras_apiladas", args: {} }], config });
    expect(cuerpo()).toEqual({ detalle: true, laminas: [{ id: "d0", slide: { graficador: "p_barras_apiladas", args: {} } }], config });
  });
});
