import { describe, expect, test } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { cuotasResumen } from "./cuotasResumen";

function celda(faculty: string, sex: string, target: number, observed: number): MonitoreoRow {
  return { faculty, sex, target, observed, missing: Math.max(0, target - observed), status: "" };
}

describe("cuotasResumen", () => {
  test("el general dice cuánta gente falta, no cuántas celdas", () => {
    // El KPI decía «2/12» y eso no distingue faltar una respuesta de faltar
    // doscientas. La lectura que sirve es en personas.
    const { general } = cuotasResumen([
      celda("Derecho", "F", 100, 40),
      celda("Derecho", "M", 100, 100),
      celda("Letras", "F", 50, 10),
    ]);
    expect(general.meta).toBe(250);
    expect(general.logrado).toBe(150);
    expect(general.faltan).toBe(100);
    expect(general.celdas).toBe(3);
    expect(general.celdasCumplidas).toBe(1);
  });

  test("pasarse en una celda NO cubre lo que falta en otra", () => {
    // Restar totales daría 0 y escondería que a Letras aún le faltan 30. La
    // cuota se cumple celda a celda, no en promedio.
    const { general } = cuotasResumen([
      celda("Derecho", "F", 100, 130),
      celda("Letras", "F", 100, 70),
    ]);
    expect(general.logrado).toBe(200);
    expect(general.meta).toBe(200);
    expect(general.faltan).toBe(30);
  });

  test("agrupa por facultad sumando sus sexos", () => {
    const { porFacultad } = cuotasResumen([
      celda("Derecho", "F", 100, 40),
      celda("Derecho", "M", 100, 60),
      celda("Letras", "F", 20, 20),
      celda("Letras", "M", 20, 20),
    ]);
    expect(porFacultad.map((c) => c.etiqueta)).toEqual(["Derecho", "Letras"]);
    expect(porFacultad[0]).toMatchObject({ meta: 200, logrado: 100, faltan: 100, celdas: 2 });
    expect(porFacultad[1]).toMatchObject({ faltan: 0, celdasCumplidas: 2 });
  });

  test("agrupa por sexo cruzando las facultades", () => {
    // Es la lectura que destapó que las celdas F van por debajo: sus metas son
    // mayores, no se recogen menos respuestas.
    const { porSexo } = cuotasResumen([
      celda("Derecho", "F", 444, 50),
      celda("Derecho", "M", 316, 50),
      celda("Letras", "F", 421, 51),
      celda("Letras", "M", 290, 48),
    ]);
    const porClave = Object.fromEntries(porSexo.map((c) => [c.etiqueta, c]));
    expect(porClave.F.meta).toBe(865);
    expect(porClave.M.meta).toBe(606);
    expect(porSexo[0].etiqueta).toBe("F");
  });

  test("una celda sin meta no entra en ningún corte", () => {
    const res = cuotasResumen([celda("Derecho", "F", 0, 0), celda("Letras", "M", 10, 4)]);
    expect(res.sinMeta).toBe(1);
    expect(res.general.celdas).toBe(1);
    expect(res.porFacultad).toHaveLength(1);
  });

  test("sin celdas no divide por cero", () => {
    const res = cuotasResumen([]);
    expect(res.general).toMatchObject({ meta: 0, logrado: 0, faltan: 0, avance: 0 });
    expect(res.porFacultad).toEqual([]);
  });
});
