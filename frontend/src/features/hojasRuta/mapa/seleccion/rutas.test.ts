import { describe, expect, it } from "vitest";
import type { SelectedBlock } from "../../../../api/hojasRuta";
import type { PiezaManzana } from "../lienzo/piezas";
import type { RevisionMarco } from "../../seleccion/revisionMarco";
import { estadosPorTitular, manzanaEnPunto, reemplazosDe, rutasPorDistrito, vecina } from "./rutas";

const t = (id: string, ubigeo: string, distrito: string, hoja: number, zona = "001") => ({ id_manzana: id, ubigeo, distrito, hoja_num: hoja, zona, viviendas: 40, entrevistas: 8, tipo_manzana: "titular" }) as unknown as SelectedBlock;
const r = (id: string, titular: string, orden: number) => ({ id_manzana: id, titular_id_manzana: titular, replacement_order: orden, tipo_manzana: "reemplazo" }) as unknown as SelectedBlock;
const titulares = [t("a", "150108", "CHORRILLOS", 2), t("b", "150103", "ATE", 1, "007"), t("c", "150108", "CHORRILLOS", 1)];
const reemplazos = [r("ra2", "a", 2), r("ra1", "a", 1), r("rc1", "c", 1)];
const revision = {
  grupos: [
    { tipo: "pocas_viviendas", tono: "aviso", titulo: "", detalle: "", umps: [{ idManzana: "b" }] },
    { tipo: "sin_viviendas", tono: "error", titulo: "", detalle: "", umps: [{ idManzana: "rc1" }] },
    { tipo: "atipica", tono: "info", titulo: "", detalle: "", umps: [{ idManzana: "a" }] },
  ],
} as unknown as RevisionMarco;

describe("rutas de la selección", () => {
  const estados = estadosPorTitular(titulares, reemplazos, revision);

  it("cada titular hereda el peor tono propio o de sus reemplazos", () => {
    expect(estados.get("a")).toBe("info");
    expect(estados.get("b")).toBe("aviso");
    expect(estados.get("c")).toBe("error");
  });

  it("agrupa por distrito en orden alfabético y ordena por número de hoja", () => {
    const g = rutasPorDistrito(titulares, reemplazos, estados, { soloPorRevisar: false, busqueda: "" });
    expect(g.map((x) => x.distrito)).toEqual(["ATE", "CHORRILLOS"]);
    expect(g[1].filas.map((f) => f.codigo)).toEqual(["UMP 1", "UMP 2"]);
    expect(g[1].filas[1].reemplazos).toBe(2);
  });

  it('"por revisar" deja sólo errores y avisos; la búsqueda mira código y zona', () => {
    const solo = rutasPorDistrito(titulares, reemplazos, estados, { soloPorRevisar: true, busqueda: "" });
    expect(solo.flatMap((g) => g.filas.map((f) => f.id))).toEqual(["b", "c"]);
    expect(rutasPorDistrito(titulares, reemplazos, estados, { soloPorRevisar: false, busqueda: "007" }).flatMap((g) => g.filas.map((f) => f.id))).toEqual(["b"]);
  });

  it("los reemplazos van en su orden", () => {
    expect(reemplazosDe("a", reemplazos).map((x) => x.id_manzana)).toEqual(["ra1", "ra2"]);
  });

  it("recorre la lista con vuelta al principio", () => {
    const g = rutasPorDistrito(titulares, reemplazos, estados, { soloPorRevisar: false, busqueda: "" });
    expect(vecina(g, null, 1)).toBe("b");
    expect(vecina(g, "a", 1)).toBe("b");
    expect(vecina(g, "b", -1)).toBe("a");
  });

  it("encuentra la manzana bajo el punto", () => {
    const m = { id: "m", caja: [0, 0, 10, 10], anillos: [[0, 0, 10, 0, 10, 10, 0, 10, 0, 0]] } as unknown as PiezaManzana;
    expect(manzanaEnPunto([m], 5, 5)?.id).toBe("m");
    expect(manzanaEnPunto([m], 15, 5)).toBeNull();
  });
});
