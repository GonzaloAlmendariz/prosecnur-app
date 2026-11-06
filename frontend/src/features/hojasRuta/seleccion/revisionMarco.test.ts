import { describe, expect, test } from "vitest";
import type { SelectedBlock } from "../../../api/hojasRuta";
import { codigoDeUmp, revisarSeleccion } from "./revisionMarco";

// Las 25 titulares de Ate y sus reemplazos, tal como salen de la corrida de
// campo de acnur_acg (proyecto de referencia anonimizado): id, viviendas, zona.
const T: Array<[string, number, string]> = [
  ["150103001000390", 34, "00100"], ["150103003000200", 81, "00300"], ["150103006000530", 72, "00600"], ["150103008000320", 132, "00800"],
  ["150103011000260", 81, "01100"], ["150103012000070", 54, "01200"], ["150103014000020", 108, "01400"], ["150103019000110", 76, "01900"],
  ["15010302000054A", 84, "02000"], ["150103021000330", 69, "02100"], ["150103022000180", 65, "02200"], ["150103023000350", 178, "02300"],
  ["150103024000100", 197, "02400"], ["150103025000110", 71, "02500"], ["150103026000230", 73, "02600"], ["150103027000390", 88, "02700"],
  ["150103028000390", 101, "02800"], ["150103030000100", 41, "03000"], ["150103031000090", 23, "03100"], ["15010303800053F", 14, "03800"],
  ["150103041010090", 38, "04101"], ["150103042000580", 1071, "04200"], ["15010304400055T", 8, "04400"], ["15010304700014F", 19, "04700"],
  ["150103054000030", 65, "05400"],
];
const R: Array<[string, number, string]> = [
  ["150103033000650", 0, "03300"], ["15010304802037A", 27, "04802"], ["150103005000110", 45, "00500"], ["150103048030150", 20, "04803"],
  ["150103002000130", 26, "00200"], ["150103039000200", 12, "03900"], ["150103056000270", 13, "05600"], ["150103034000290", 35, "03400"],
  ["150103069000980", 21, "06900"], ["150103009000420", 83, "00900"], ["150103043000310", 346, "04300"], ["150103018000060", 29, "01800"],
  ["15010307800029A", 4, "07800"], ["150103007000550", 62, "00700"], ["15010304600052E", 23, "04600"], ["150103057000550", 20, "05700"],
  ["150103004000180", 20, "00400"], ["150103063000780", 12, "06300"], ["150103083000280", 20, "08300"], ["150103029000260", 21, "02900"],
  ["150103052000100", 20, "05200"], ["15010306200026D", 19, "06200"], ["150103058000390", 9, "05800"], ["150103064000170", 20, "06400"],
  ["150103059000300", 12, "05900"],
];

function bloque(parcial: Partial<SelectedBlock>): SelectedBlock {
  return {
    id_manzana: "", departamento: "LIMA", provincia: "LIMA", distrito: "ATE", ubigeo: "150103", zona: "", manzana: "",
    viviendas: 0, poblacion: 0, territorio_muestral: "", metodo: "pps", orden_seleccion: 1, entrevistas: 8,
    medida_tamano: 0, lat: null, lon: null, ...parcial,
  } as SelectedBlock;
}

const titulares = T.map(([id, viv, zona], i) => bloque({ id_manzana: id, viviendas: viv, zona, hoja_num: i + 1, tipo_manzana: "titular" }));
const reemplazos = R.map(([id, viv, zona], i) => bloque({
  id_manzana: id, viviendas: viv, zona, tipo_manzana: "reemplazo", titular_id_manzana: T[i][0], titular_hoja_num: i + 1, replacement_order: 1,
}));

describe("revisarSeleccion con Ate (acnur_acg)", () => {
  const revision = revisarSeleccion(titulares, reemplazos);
  const grupo = (tipo: string) => revision.grupos.find((g) => g.tipo === tipo);

  test("el reemplazo de UMP 1 no tiene viviendas y abre la lista como error", () => {
    expect(revision.grupos[0].tipo).toBe("reemplazo-sin-viviendas");
    expect(grupo("reemplazo-sin-viviendas")?.umps).toEqual([
      expect.objectContaining({ idManzana: "150103033000650", codigo: "R 1", titular: "UMP 1", viviendas: 0, entrevistas: 8 }),
    ]);
  });

  test("el reemplazo de UMP 13 tiene 4 viviendas para 8 entrevistas", () => {
    expect(grupo("reemplazo-corto")?.umps.map((u) => [u.codigo, u.viviendas])).toEqual([["R 13", 4]]);
  });

  test("UMP 23 no tiene margen y UMP 22 es atípica frente a la mediana de Ate (72)", () => {
    expect(grupo("titular-sin-margen")?.umps.map((u) => u.codigo)).toEqual(["UMP 23"]);
    expect(grupo("titular-atipica")?.umps.map((u) => [u.codigo, u.viviendas])).toEqual([["UMP 22", 1071]]);
  });

  test("cuenta por tono, por distrito y la referencia de 8 entrevistas por ruta", () => {
    expect(revision.conteo).toEqual({ error: 1, aviso: 2, info: 1 });
    expect(revision.porRevisar).toBe(3);
    expect(revision.distritos).toEqual([{ distrito: "ATE", titulares: 25, reemplazos: 25, observaciones: 4, errores: 1 }]);
    expect(revision.entrevistasPorRuta).toBe(8);
    expect(grupo("titular-sin-reemplazo")).toBeUndefined();
  });
});

describe("revisarSeleccion sin observaciones", () => {
  test("una muestra sana no produce grupos", () => {
    const sana = [bloque({ id_manzana: "a", viviendas: 40, hoja_num: 1 }), bloque({ id_manzana: "b", viviendas: 60, hoja_num: 2 })];
    expect(revisarSeleccion(sana, []).grupos).toEqual([]);
  });

  test("el código de un reemplazo de segundo orden lleva el orden", () => {
    expect(codigoDeUmp(bloque({ tipo_manzana: "reemplazo", titular_hoja_num: 4, replacement_order: 2 }))).toBe("R 4.2");
  });
});
