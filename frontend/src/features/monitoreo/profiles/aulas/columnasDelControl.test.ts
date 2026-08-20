import { describe, expect, test } from "vitest";

import { columnasDelControl } from "./AulasControlDelLibro";

describe("cuántas columnas pinta la tabla del libro", () => {
  test("cuenta el identificador más los campos de los grupos con dato", () => {
    // Medido en pantalla sobre el corte real: 26 columnas en 2 677 px dentro de
    // un marco de 892. El encabezado tiene que decir el mismo número que la
    // tabla pinta, no uno calculado aparte.
    const n = columnasDelControl({
      aulas: 152,
      grupos: [
        { clave: "cuenta", aulas_con_dato: 102 },
        { clave: "duracion", aulas_con_dato: 0 },
        { clave: "cuotas", aulas_con_dato: 102 },
        { clave: "rango_horario", aulas_con_dato: 102 },
      ],
    } as never);
    expect(n).toBeGreaterThan(1);
  });

  test("un grupo sin dato no aporta columnas", () => {
    const con = columnasDelControl({
      aulas: 10,
      grupos: [{ clave: "cuenta", aulas_con_dato: 10 }, { clave: "cuotas", aulas_con_dato: 10 }],
    } as never);
    const sin = columnasDelControl({
      aulas: 10,
      grupos: [{ clave: "cuenta", aulas_con_dato: 10 }, { clave: "cuotas", aulas_con_dato: 0 }],
    } as never);
    expect(sin).toBeLessThan(con);
  });

  test("sin grupos con dato no hay tabla y no se cuenta el identificador solo", () => {
    // Un «1 columna» en el encabezado de una tabla que no se pinta seria peor
    // que no decir nada.
    expect(columnasDelControl({ aulas: 0, grupos: [] } as never)).toBe(0);
    expect(columnasDelControl(null)).toBe(0);
    expect(columnasDelControl({
      aulas: 5, grupos: [{ clave: "cuenta", aulas_con_dato: 0 }],
    } as never)).toBe(0);
  });
});
