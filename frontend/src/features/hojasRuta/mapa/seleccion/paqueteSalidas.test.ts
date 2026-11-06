import { describe, expect, test } from "vitest";
import type { SelectedBlock } from "../../../../api/hojasRuta";
import { conteosDelPaquete, sugeridasParaReemplazo } from "./salidas";

const b = (id: string, ubigeo: string, zona: string, viviendas: number) => ({ id_manzana: id, ubigeo, zona, viviendas }) as unknown as SelectedBlock;

describe("paquete de salidas (B22)", () => {
  test("cuenta fichas, carpetas por distrito, reemplazos y hojas por zona (también las zonas que sólo tienen reemplazos)", () => {
    const tit = [b("1", "150103", "001", 20), b("2", "150103", "001", 10), b("3", "150103", "002", 15), b("4", "150132", "010", 30)];
    expect(conteosDelPaquete(tit, [b("r1", "150103", "003", 9)])).toEqual({ titulares: 4, distritos: 2, reemplazos: 1, zonas: 4 });
  });

  test("sugiere para reemplazo puntual sólo las titulares sin viviendas en el marco", () => {
    expect(sugeridasParaReemplazo([b("1", "x", "1", 0), b("2", "x", "1", 5), b("3", "x", "1", 0)])).toEqual(["1", "3"]);
  });
});
