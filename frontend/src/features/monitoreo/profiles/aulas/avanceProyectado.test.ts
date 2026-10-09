import { describe, expect, it } from "vitest";

import { avanceProyectado, celdasEvaluables, celdasQuePidenAccion, porqueDeLaCelda } from "./avanceProyectado";

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
    expect(p).toContain("no quedan cursos-horario");
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

describe("el denominador del titular", () => {
  const celda = (over: Record<string, unknown> = {}) => ({
    faculty: "A", sex: "F", cuota: 200, logrado: 68, proyeccion: 128, brecha: 72,
    estado: "deficit_proyectado", etiqueta: "x", ...over,
  });

  it("cuenta sólo las celdas con objetivo declarado", () => {
    // Visto en la app: el KPI decía «10 de 30 cierran» y este panel «10 de 30 no
    // van a llegar», los dos ciertos y sobre el mismo 30, porque 10 de esas
    // celdas no tienen objetivo y no son ninguna de las dos cosas. Juntos se
    // leían como una contradicción.
    const filas = avanceProyectado([
      celda({ faculty: "A", estado: "deficit_proyectado" }),
      celda({ faculty: "B", estado: "asegurada" }),
      celda({ faculty: "C", estado: "sin_cuota" }),
      celda({ faculty: "D", estado: "sin_cuota" }),
    ]);
    expect(filas.length).toBe(4);
    expect(celdasEvaluables(filas)).toBe(2);
    expect(celdasQuePidenAccion(filas)).toBe(1);
  });

  it("sin ninguna celda evaluable, el denominador es cero y no uno inventado", () => {
    const filas = avanceProyectado([celda({ estado: "sin_cuota" })]);
    expect(celdasEvaluables(filas)).toBe(0);
  });
});

describe("la resta de la lectura cuadra a la vista", () => {
  /**
   * Medido con `HSVG2026_sem15_como_2025.pulso`: EDUCACION · Hombres decía
   * «No va a llegar: falta 1 encuesta» junto a «Lleva 1 de 4: faltan 3 y las
   * aulas que faltan por aplicar aportan 3». 3 − 3 = 0, no 1.
   *
   * El aporte real era 2,1 y se publicaba con `fmtCuenta`, que redondea HACIA
   * ARRIBA: la regla de una meta que hay que cumplir, no la de un aporte
   * esperado. Prometer 3 cuando se esperan 2,1 es prometer de más, y el repo ya
   * lo tenía escrito en `.mard_personas()`.
   */
  const enDeficit = (p: Record<string, unknown>) =>
    ({ estado: "deficit_proyectado", faculty: "Educacion", sex: "M", ...p }) as never;

  it("el aporte se redondea hacia abajo y la resta cuadra", () => {
    const p = porqueDeLaCelda(enDeficit({ cuota: 4, logrado: 1, aporte_pendiente: 2.1 }));
    expect(p).toContain("faltan 3");
    expect(p).toContain("aportan 2");
    expect(p).not.toContain("aportan 3");
  });

  it("un aporte entero no se toca", () => {
    expect(porqueDeLaCelda(enDeficit({ cuota: 10, logrado: 2, aporte_pendiente: 5 })))
      .toContain("aportan 5");
  });

  it("un 3 con error binario sigue siendo 3, con la tolerancia de la casa", () => {
    // El control del epsilon: sin él, el redondeo hacia abajo se comería una
    // persona entera por un error de coma flotante.
    //
    // La tolerancia es `1e-9`, la MISMA que usa `.mard_personas()` en R. El
    // primer intento de este test usó 2,9999999 —que se aparta `1e-7`— y falló:
    // el equivocado era el test. Un 2,9999999 de verdad se redondea a 2, y está
    // bien que así sea; lo que se tolera es el ruido binario, no un decimal
    // real.
    expect(porqueDeLaCelda(enDeficit({ cuota: 10, logrado: 2, aporte_pendiente: 3 - 1e-12 })))
      .toContain("aportan 3");
    expect(porqueDeLaCelda(enDeficit({ cuota: 10, logrado: 2, aporte_pendiente: 2.9999999 })))
      .toContain("aportan 2");
  });
});
