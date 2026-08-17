import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { parteDeCampo } from "./parteDeCampo";

/**
 * El parte de campo no se veía en ninguna tabla de la app.
 *
 * El control «Cuadre del parte de campo» nombraba las aulas que no cuadran y no
 * había dónde ir a mirarlas; y lo que el equipo anota en el aula —asistentes,
 * rechazos, duplicados, efectivas— sólo se podía editar de una en una en el
 * formulario del registro.
 */

function parte(codigo: string, extra: Partial<MonitoreoRow> = {}): MonitoreoRow {
  return {
    operational_code: codigo,
    observed_students: 26,
    refusals: 1,
    duplicates: 3,
    effective_surveys: 22,
    esperado: 22,
    diferencia: 0,
    cuadra: true,
    ...extra,
  } as unknown as MonitoreoRow;
}

describe("el parte de campo", () => {
  it("pone delante lo que no cuadra", () => {
    const res = parteDeCampo([
      parte("CH 1"),
      parte("CH 31", { effective_surveys: 21, esperado: 22, diferencia: -1, cuadra: false }),
      parte("CH 2"),
    ]);
    expect(res.filas[0].operational_code).toBe("CH 31");
    expect(res.descuadrados).toBe(1);
  });

  it("entre los descuadrados, primero el que más se aleja", () => {
    const res = parteDeCampo([
      parte("CH 31", { diferencia: -1, cuadra: false }),
      parte("CH 112", { diferencia: 7, cuadra: false }),
    ]);
    expect(res.filas.map((f) => f.operational_code)).toEqual(["CH 112", "CH 31"]);
  });

  it("los que cuadran van por código, en orden natural", () => {
    // «CH 2» antes que «CH 10»: sin orden numérico la lista quedaría CH 1,
    // CH 10, CH 2, que no es como nadie busca un aula.
    const res = parteDeCampo([parte("CH 10"), parte("CH 2"), parte("CH 1")]);
    expect(res.filas.map((f) => f.operational_code)).toEqual(["CH 1", "CH 2", "CH 10"]);
  });

  it("«no se pudo comprobar» no es «no cuadra»", () => {
    // Un parte sin asistentes ni efectivas no falla: no declara lo suficiente.
    // Contarlo como descuadre inventaría un problema que nadie declaró.
    const res = parteDeCampo([parte("CH 9", { cuadra: null, diferencia: null })]);
    expect(res.descuadrados).toBe(0);
    expect(res.sinComprobar).toBe(1);
    expect(res.label).toContain("sin comprobar");
  });

  it("dice cuántos hay y cuántos fallan", () => {
    const todos = parteDeCampo([parte("CH 1"), parte("CH 2")]);
    expect(todos.label).toBe("2 partes · todos cuadran");

    const conFallo = parteDeCampo([parte("CH 1"), parte("CH 31", { cuadra: false })]);
    expect(conFallo.label).toBe("2 partes · 1 sin cuadrar");
  });

  it("sin partes lo dice y no inventa filas", () => {
    const res = parteDeCampo([]);
    expect(res.filas).toEqual([]);
    expect(res.label).toBe("sin partes");
  });
});
