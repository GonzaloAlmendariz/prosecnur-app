import { describe, expect, it } from "vitest";
import type { HojasRutaWorkspaceOutputs, SelectedBlock } from "../../../../api/hojasRuta";
import { porDia } from "./PlanCampo";
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


it("el plan se agrupa por día y, dentro del día, por encuestador (B20)", () => {
  const j = (id: string, dia: number, encuestador: number) => ({ id, ubigeo: "1", distrito: "d", rutas: ["a"], visitas: 10, km: 1, excede_jornada: false, jornadas_equivalentes: 1, encuestador, dia });
  const dias = porDia([j("J03", 2, 1), j("J02", 1, 2), j("J01", 1, 1)]);
  expect(dias.map(([d, js]) => [d, js.map((x) => x.id)])).toEqual([[1, ["J01", "J02"]], [2, ["J03"]]]);
});

describe("conteosPorDistrito", () => {
  it("cuenta fichas y hojas por zona de cada distrito, y suma lo mismo que el total", async () => {
    const { conteosPorDistrito, conteosDelPaquete } = await import("./salidas");
    const b = (ubigeo: string, zona: string) => ({ ubigeo, distrito: ubigeo === "1" ? "ATE" : "LIMA", zona } as unknown as import("../../../../api/hojasRuta").SelectedBlock);
    const t = [b("1", "a"), b("1", "b"), b("2", "a")];
    const r = [b("1", "c"), b("2", "a")];
    const d = conteosPorDistrito(t, r);
    expect(d).toEqual([{ ubigeo: "1", distrito: "ATE", titulares: 2, reemplazos: 1, zonas: 3 }, { ubigeo: "2", distrito: "LIMA", titulares: 1, reemplazos: 1, zonas: 1 }]);
    expect(d.reduce((a, x) => a + x.zonas, 0)).toBe(conteosDelPaquete(t, r).zonas);
  });
});
