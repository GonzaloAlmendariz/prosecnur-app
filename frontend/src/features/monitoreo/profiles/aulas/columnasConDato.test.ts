import { describe, expect, it } from "vitest";

import { columnasConDato } from "./columnasConDato";

/**
 * El caso real: la tabla de reemplazos gastaba una columna en «Corrida de
 * selección», vacía en las 50 filas, mientras el hecho —que el plan vino del
 * libro y no de una corrida— ya se contaba en «Operación del plan».
 */
describe("columnasConDato", () => {
  const filas = [
    { operational_code: "CH 1", selection_run_id: "", replacement_order: 0, motivo: "" },
    { operational_code: "CH 2", selection_run_id: "", replacement_order: 1, motivo: "El aula no existe" },
  ];

  it("quita la columna vacía en todas las filas", () => {
    expect(columnasConDato(filas, ["operational_code", "selection_run_id", "motivo"]))
      .toEqual(["operational_code", "motivo"]);
  });

  it("conserva la que tiene dato en una sola fila", () => {
    // `motivo` está vacío en la primera. Una columna con UN dato sigue diciendo
    // algo; el criterio es «ninguna fila», no «la mayoría».
    expect(columnasConDato(filas, ["motivo"])).toEqual(["motivo"]);
  });

  it("no confunde el cero con vacío", () => {
    // `replacement_order` vale 0 en la primera fila y 0 es un dato: es el
    // titular de la cadena. Tratarlo como vacío borraría la columna entera en
    // una tabla que sólo tuviera titulares.
    expect(columnasConDato([filas[0]], ["replacement_order"])).toEqual(["replacement_order"]);
  });

  it("trata el guion del presentador como vacío", () => {
    expect(columnasConDato([{ a: "—" }, { a: "—" }], ["a"])).toEqual(["a"]);
  });

  it("devuelve todas si ninguna tiene dato, antes que dejar la tabla sin encabezados", () => {
    expect(columnasConDato([{ a: "", b: "" }], ["a", "b"])).toEqual(["a", "b"]);
  });
});
