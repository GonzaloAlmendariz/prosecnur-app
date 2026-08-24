import { describe, expect, it } from "vitest";

import { avanceProyectado, celdasQuePidenAccion, porqueDeLaCelda } from "./avanceProyectado";

const celda = (over: Record<string, unknown> = {}) => ({
  faculty: "DERECHO", sex: "F", cuota: 200, logrado: 68, previsto: 80,
  aporte_pendiente: 60, proyeccion: 128, brecha: 72, calibracion: 0.85,
  estado: "deficit_proyectado", previsto_origen: "hoja_de_control",
  etiqueta: "No va a llegar: faltan 72 encuestas",
  etiqueta_calibracion: "El campo esta rindiendo un 15 % menos de lo previsto",
  ...over,
});

describe("avance proyectado por celda", () => {
  it("abre por lo que exige una decisión hoy, no por lo que está bien", () => {
    // Una lista que abre por lo verde obliga a buscar el problema, que es justo
    // lo que una pantalla de campo no puede pedir.
    const filas = avanceProyectado([
      celda({ faculty: "A", estado: "asegurada", brecha: 0 }),
      celda({ faculty: "B", estado: "deficit_proyectado", brecha: 3 }),
      celda({ faculty: "C", estado: "deficit_no_subsanable", brecha: 1 }),
      celda({ faculty: "D", estado: "ajustada", brecha: 0 }),
    ]);
    expect(filas.map((f) => f.facultad)).toEqual(["C", "B", "D", "A"]);
  });

  it("dentro del mismo estado manda la brecha", () => {
    const filas = avanceProyectado([
      celda({ faculty: "A", brecha: 3 }),
      celda({ faculty: "B", brecha: 40 }),
    ]);
    expect(filas.map((f) => f.facultad)).toEqual(["B", "A"]);
  });

  it("no redacta: si el motor no manda frase, la celda lo dice", () => {
    // Con dos redacciones vivas del mismo estado la pantalla acaba diciendo dos
    // cosas, y ningún test lo ve. Inventarse una que suene bien es peor.
    const [f] = avanceProyectado([celda({ etiqueta: undefined })]);
    expect(f.etiqueta).toBe("Sin estado");
  });

  it("la causa lleva las cifras, porque el estado solo no manda a nadie a un aula", () => {
    // «Derecho mujeres en déficit» no mueve a nadie; «lleva 68 de 200, faltan
    // 132 y las pendientes aportan 60» sí.
    const p = porqueDeLaCelda(celda());
    expect(p).toContain("68");
    expect(p).toContain("200");
    expect(p).toContain("132");
    expect(p).toContain("60");
  });

  it("cuando no quedan aulas, la causa lo dice", () => {
    const p = porqueDeLaCelda(celda({ estado: "deficit_no_subsanable", aporte_pendiente: 0 }));
    expect(p).toContain("no quedan aulas");
  });

  it("no explica lo que no necesita explicación", () => {
    // Repetir el titular con otras palabras es ruido: una celda asegurada no
    // lleva causa.
    expect(porqueDeLaCelda(celda({ estado: "asegurada" }))).toBe("");
    expect(porqueDeLaCelda(celda({ estado: "ajustada" }))).toBe("");
    expect(porqueDeLaCelda(celda({ estado: "sin_cuota", cuota: 0 }))).toBe("");
  });

  it("sin celdas no inventa una lista vacía que parezca calma", () => {
    expect(avanceProyectado([])).toEqual([]);
    expect(avanceProyectado(null)).toEqual([]);
    expect(avanceProyectado(undefined)).toEqual([]);
  });

  it("cuenta las celdas que piden acción, y cero es cero", () => {
    const filas = avanceProyectado([
      celda({ faculty: "A", estado: "asegurada" }),
      celda({ faculty: "B", estado: "deficit_proyectado" }),
      celda({ faculty: "C", estado: "deficit_no_subsanable" }),
    ]);
    expect(celdasQuePidenAccion(filas)).toBe(2);
    expect(celdasQuePidenAccion(avanceProyectado([celda({ estado: "asegurada" })]))).toBe(0);
  });

  it("el origen del previsto viaja hasta la fila", () => {
    // Una calibración sobre un previsto derivado mide el supuesto y el campo a
    // la vez, y quien lea tiene que poder saberlo.
    expect(avanceProyectado([celda()])[0].origen).toBe("hoja_de_control");
    expect(avanceProyectado([celda({ previsto_origen: "composicion_del_aula" })])[0].origen)
      .toBe("composicion_del_aula");
  });
});
