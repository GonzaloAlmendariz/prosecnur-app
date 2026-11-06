import { describe, expect, it } from "vitest";

import { normalizarImportacionAsignacion } from "../../../api/materialTerritorial";

describe("lectura del Excel de asignación de campo", () => {
  it("normaliza la propuesta, los problemas por fila y el conteo por encuestador", () => {
    const r = normalizarImportacionAsignacion({
      propuesta: [{ id_manzana: ["a"], codigo: "P844" }, { id_manzana: "b", codigo: "" }],
      problemas: { fila: 6, id_manzana: "c", valor: "Juan Pérez", motivo: "No está en la lista de encuestadores de Monitoreo" },
      resumen: { titulares: 150, titulares_con_encuestador: 142, filas_sin_encuestador: 8 },
      por_encuestador: [{ codigo: "P844", nombre: "Encuestador Ejemplo Uno", umps: 38 }],
      otra_muestra: [true],
      nota: "Sólo se lee el encuestador.",
    });
    expect(r.propuesta).toEqual([{ id_manzana: "a", codigo: "P844" }]);
    expect(r.problemas).toEqual([{ fila: 6, id_manzana: "c", valor: "Juan Pérez", motivo: "No está en la lista de encuestadores de Monitoreo" }]);
    expect(r.titulares_con_encuestador).toBe(142);
    expect(r.por_encuestador[0].umps).toBe(38);
    expect(r.otra_muestra).toBe(true);
  });
  it("rechaza un payload que no es objeto", () => {
    expect(() => normalizarImportacionAsignacion([])).toThrow();
  });
});
