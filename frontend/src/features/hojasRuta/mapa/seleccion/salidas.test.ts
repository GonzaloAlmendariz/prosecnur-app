import { describe, expect, it } from "vitest";
import type { HojasRutaWorkspaceOutputs, SelectedBlock } from "../../../../api/hojasRuta";
import { alternarId, candidatasDeReemplazo, listoParaEntregar, pasosDeEntrega, pesoLegible } from "./salidas";

const t = (id: string, hoja: number, distrito: string, zona: string) => ({ id_manzana: id, hoja_num: hoja, distrito, zona, tipo_manzana: "titular" }) as unknown as SelectedBlock;
const titulares = [t("a", 1, "ATE", "00100"), t("b", 2, "ATE", "00300"), t("c", 3, "CHORRILLOS", "00100")];

describe("salidas de la selección", () => {
  it("la entrega espera territorio, población, cuotas y manzanas", () => {
    const vacia = pasosDeEntrega(0, null);
    expect(vacia.map((p) => p.ok)).toEqual([false, false, false, false]);
    expect(listoParaEntregar(vacia)).toBe(false);
    const llena = pasosDeEntrega(2, { population: { ok: true }, quota: { ok: true }, sample: { ok: true, n_blocks: 3 } } as unknown as HojasRutaWorkspaceOutputs);
    expect(listoParaEntregar(llena)).toBe(true);
    expect(llena[3].detalle).toBe("3 titulares");
    // Un sorteo trae sus cuotas en sample.quota aunque outputs.quota esté vacío.
    const soloSorteo = pasosDeEntrega(2, { population: { ok: true }, quota: null, sample: { ok: true, n_blocks: 3, quota: { ok: true } } } as unknown as HojasRutaWorkspaceOutputs);
    expect(listoParaEntregar(soloSorteo)).toBe(true);
  });

  it("las elegidas van primero; sin búsqueda no se lista el resto", () => {
    expect(candidatasDeReemplazo(titulares, "", ["c"]).filas.map((f) => f.id)).toEqual(["c"]);
    const r = candidatasDeReemplazo(titulares, "00100", ["b"]);
    expect(r.filas.map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(r.coincidencias).toBe(2);
  });

  it("la búsqueda ignora tildes y respeta el tope", () => {
    expect(candidatasDeReemplazo(titulares, "chórrillos", []).filas.map((f) => f.codigo)).toEqual(["UMP 3"]);
    expect(candidatasDeReemplazo(titulares, "ump", [], 2).filas).toHaveLength(2);
    expect(candidatasDeReemplazo(titulares, "00100 ate", []).filas.map((f) => f.id)).toEqual(["a"]);
  });

  it("alterna ids y rotula pesos", () => {
    expect(alternarId(["a"], "b")).toEqual(["a", "b"]);
    expect(alternarId(["a", "b"], "a")).toEqual(["b"]);
    expect(pesoLegible(0)).toBe("");
    expect(pesoLegible(2048)).toBe("2 KB");
    expect(pesoLegible(3 * 1024 * 1024)).toBe("3 MB");
  });
});
