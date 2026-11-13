import { describe, expect, it, vi } from "vitest";
import type { InstrumentoDrillResult } from "../../../api/validacion";
import { cargarDetalleCompleto, totalDeCasos, unirPaginasDelDetalle } from "./detalleCompleto";

// Un motor de mentira con `total` casos que pagina como el de R: sin página
// pedida, los primeros 500.
function motor(total: number) {
  return vi.fn(async (pagina?: { desde: number; limite: number }): Promise<InstrumentoDrillResult> => {
    const desde = pagina?.desde ?? 0;
    const limite = pagina?.limite ?? 500;
    const hasta = Math.min(total, desde + limite);
    const ids = Array.from({ length: Math.max(0, hasta - desde) }, (_, i) => `c${desde + i + 1}`);
    return {
      ok: true,
      regla: { id: "R1" } as InstrumentoDrillResult["regla"],
      uuid_col: "_pulso_case_id",
      case_ids: ids,
      casos: ids.map((id) => ({ _pulso_case_id: id })),
      esperado: ids.map((id) => ({ sujeto: id })),
      contexto_por_caso: ids.map(() => null),
      coincide_con: null,
      n_casos_total: total,
      desde,
      limite,
      hay_mas: hasta < total,
    } as unknown as InstrumentoDrillResult;
  });
}

describe("detalle de casos completo", () => {
  it("con 853 casos trae los 853, no los primeros 500", async () => {
    const pedir = motor(853);
    const d = await cargarDetalleCompleto(pedir, 2000);
    expect(d.casos).toHaveLength(853);
    expect(d.case_ids).toHaveLength(853);
    expect(d.case_ids?.[852]).toBe("c853");
    expect((d as unknown as { esperado: unknown[] }).esperado).toHaveLength(853);
    expect(totalDeCasos(d)).toBe(853);
    // La primera se pide sin página (como antes) y la segunda desde el caso 501.
    expect(pedir).toHaveBeenNthCalledWith(1);
    expect(pedir).toHaveBeenNthCalledWith(2, { desde: 500, limite: 2000 });
  });

  it("con pocos casos hace una sola petición", async () => {
    const pedir = motor(12);
    const d = await cargarDetalleCompleto(pedir);
    expect(d.casos).toHaveLength(12);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("varias páginas siguen en orden", async () => {
    const d = await cargarDetalleCompleto(motor(4500), 1000);
    expect(d.case_ids?.slice(498, 502)).toEqual(["c499", "c500", "c501", "c502"]);
    expect(d.casos).toHaveLength(4500);
    expect(d.hay_mas).toBe(false);
  });

  it("una página vacía antes del total falla con su causa", async () => {
    const pedir = vi.fn(async (pagina?: { desde: number; limite: number }) => {
      const base = await motor(853)(pagina);
      return pagina ? { ...base, casos: [], case_ids: [] } : base;
    });
    await expect(cargarDetalleCompleto(pedir)).rejects.toThrow("trajo 500 de 853 casos");
  });

  it("un motor sin total cuenta los que llegaron", () => {
    const d = { ok: true, casos: [{}, {}], uuid_col: null } as unknown as InstrumentoDrillResult;
    expect(totalDeCasos(d)).toBe(2);
    expect(unirPaginasDelDetalle([d])).toBe(d);
  });
});
