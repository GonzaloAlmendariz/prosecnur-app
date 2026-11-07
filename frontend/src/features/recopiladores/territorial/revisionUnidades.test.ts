import { describe, expect, it } from "vitest";
import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import { revisarUnidades } from "./revisionUnidades";

const u = (unit_id: string, role: "titular" | "reemplazo", viviendas: number, extra: Partial<UnidadTerritorial> = {}): UnidadTerritorial => ({
  unit_id, label: unit_id, role, titular_id: null, distrito: "ATE", ubigeo: "150103", zona: "00100", manzana: "001",
  rango_inicio: 1, rango_fin: 8, viviendas, ...extra,
});

describe("revisarUnidades", () => {
  it("marca con el criterio de Selección: sin viviendas es error, no alcanza es aviso", () => {
    const units = [
      u("t1", "titular", 0), u("r1", "reemplazo", 120, { titular_id: "t1" }),
      u("t2", "titular", 5), u("r2", "reemplazo", 90, { titular_id: "t2" }),
      u("t3", "titular", 150), u("r3", "reemplazo", 140, { titular_id: "t3" }),
    ];
    const { porUnidad, distritos } = revisarUnidades(units);
    expect(porUnidad.get("t1")).toEqual({ tono: "error", motivo: "sin viviendas" });
    expect(porUnidad.get("t2")?.tono).toBe("aviso");
    expect(porUnidad.get("t2")?.motivo).toBe("no alcanza");
    // Con mediana 5 la de 150 es atípica: informativa, no la cuenta como por revisar.
    expect(porUnidad.get("t3")).toEqual({ tono: "info", motivo: "muy grande" });
    expect(distritos).toEqual([{ clave: "150103", distrito: "ATE", titulares: 3, reemplazos: 3, porRevisar: 2 }]);
  });
  it("una ruta cuya titular está bien pero su reemplazo no, cuenta como por revisar", () => {
    const { distritos } = revisarUnidades([u("t", "titular", 150), u("r", "reemplazo", 0, { titular_id: "t" })]);
    expect(distritos[0].porRevisar).toBe(1);
  });
});
