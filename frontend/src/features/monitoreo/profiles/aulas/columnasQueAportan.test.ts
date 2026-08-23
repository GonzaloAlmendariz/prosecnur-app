import { describe, expect, it } from "vitest";
import { columnasSinDuplicados, columnasSinConstantesInertes } from "./columnasQueAportan";

describe("columnasSinDuplicados", () => {
  it("quita la columna que repite a otra en TODAS las filas", () => {
    // El caso medido: «Código titular» traía «CH n» igual que «Curso-horario»
    // en 193 de 193, porque la agenda sólo lista titulares.
    const filas = [
      { operational_code: "CH 1", titular_operational_code: "CH 1", teacher: "A" },
      { operational_code: "CH 2", titular_operational_code: "CH 2", teacher: "B" },
    ];
    expect(columnasSinDuplicados(filas, ["operational_code", "titular_operational_code", "teacher"]))
      .toEqual(["operational_code", "teacher"]);
  });

  it("conserva la primera del orden, que es la que la pantalla prioriza", () => {
    const filas = [{ a: "x", b: "x" }, { a: "y", b: "y" }];
    expect(columnasSinDuplicados(filas, ["a", "b"])).toEqual(["a"]);
    expect(columnasSinDuplicados(filas, ["b", "a"])).toEqual(["b"]);
  });

  it("NO las da por duplicadas si divergen en una sola fila", () => {
    // Comparar sólo la primera fila daría por iguales dos columnas que se
    // separan en la 40 — y esa fila es justo la que alguien necesita ver.
    const filas = [
      { a: "CH 1", b: "CH 1" },
      { a: "CH 2", b: "CH 2" },
      { a: "CH 3", b: "CH 9" },
    ];
    expect(columnasSinDuplicados(filas, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("sin filas no decide nada: devuelve las claves tal cual", () => {
    // Con la tabla vacía todas las columnas tienen la misma firma —ninguna— y
    // colapsarlas dejaría UNA sola columna en la cabecera.
    expect(columnasSinDuplicados([], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("no funde columnas distintas que sólo se parecen al mirarlas por encima", () => {
    const filas = [{ a: null, b: 0 }, { a: undefined, b: 0 }];
    expect(columnasSinDuplicados(filas, ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("columnasSinConstantesInertes", () => {
  const ESTADOS = new Set(["sample_status"]);

  it("quita las constantes que sólo describen la estructura", () => {
    // «Rol de muestra» = Titular, «Muestra» = M1, «Orden en la cadena» = 0, en
    // las 193 filas. Son ciertas y no informan de nada.
    const filas = [
      { code: "CH 1", sample_role: "titular", sample_label: "M1", replacement_order: 0 },
      { code: "CH 2", sample_role: "titular", sample_label: "M1", replacement_order: 0 },
    ];
    expect(columnasSinConstantesInertes(
      filas,
      ["code", "sample_role", "sample_label", "replacement_order"],
      ESTADOS,
    )).toEqual(["code"]);
  });

  it("conserva un estado constante, porque su valor único ES el dato", () => {
    // «Sin contactar» en las 193 dice que el operativo no ha empezado. Quitarla
    // dejaría la pantalla sin decirlo.
    const filas = [
      { code: "CH 1", sample_status: "Sin contactar" },
      { code: "CH 2", sample_status: "Sin contactar" },
    ];
    expect(columnasSinConstantesInertes(filas, ["code", "sample_status"], ESTADOS))
      .toEqual(["code", "sample_status"]);
  });

  it("conserva una columna vacía en todas: el hueco es el dato", () => {
    // «Fecha de aplicación» sin llenar en las 193 es justo lo que hay que ver.
    const filas = [
      { code: "CH 1", scheduled_date: "" },
      { code: "CH 2", scheduled_date: "" },
    ];
    expect(columnasSinConstantesInertes(filas, ["code", "scheduled_date"], ESTADOS))
      .toEqual(["code", "scheduled_date"]);
  });

  it("con una sola fila no concluye: todo es constante en una fila", () => {
    const filas = [{ code: "CH 1", sample_role: "titular" }];
    expect(columnasSinConstantesInertes(filas, ["code", "sample_role"], ESTADOS))
      .toEqual(["code", "sample_role"]);
  });

  it("conserva la que varía aunque casi siempre repita", () => {
    const filas = [
      { rol: "titular" }, { rol: "titular" }, { rol: "titular" }, { rol: "chain_reserve" },
    ];
    expect(columnasSinConstantesInertes(filas, ["rol"], ESTADOS)).toEqual(["rol"]);
  });
});
