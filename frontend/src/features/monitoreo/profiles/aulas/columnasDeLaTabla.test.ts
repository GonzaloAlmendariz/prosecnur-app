import { describe, expect, it } from "vitest";
import { columnasDeLaTabla } from "./columnasDeLaTabla";

const resumen = (conDato: string[]) =>
  ({
    aulas: 152,
    grupos: [
      { clave: "cuenta", aulas_con_dato: conDato.includes("cuenta") ? 102 : 0 },
      { clave: "cuotas", aulas_con_dato: conDato.includes("cuotas") ? 100 : 0 },
      { clave: "duracion", aulas_con_dato: conDato.includes("duracion") ? 88 : 0 },
    ],
  }) as never;

describe("columnasDeLaTabla", () => {
  it("dice de qué son las columnas, no sólo cuántas", () => {
    // El defecto: «26 columnas» pegado a «152 filas de la hoja» se lee como el
    // ancho de la hoja, que es otro número (39).
    expect(columnasDeLaTabla(resumen(["cuenta"]))).toContain("en la tabla");
  });

  it("cuenta las de los grupos CON dato, no todas las que conoce", () => {
    const unGrupo = columnasDeLaTabla(resumen(["cuenta"]));
    const dos = columnasDeLaTabla(resumen(["cuenta", "cuotas"]));
    const n = (t: string) => Number(t.match(/\d+/)![0]);
    // El control: si contara todas las que conoce, las dos cifras serían iguales
    // y la vista prometería columnas que no pinta.
    expect(n(dos)).toBeGreaterThan(n(unGrupo));
  });

  it("sin resumen no inventa un ancho, y dice de que columnas habla", () => {
    // Era «sin columnas» a secas y, pegado a «190 filas de la hoja», se leia
    // como que la HOJA no tiene columnas: tiene 39, y lo que falta es que el
    // equipo las llene. Es el mismo equivoco que esta funcion existe para
    // evitar, cometido en su propia rama vacia.
    expect(columnasDeLaTabla(null)).toBe("sin columnas de control llenas");
    expect(columnasDeLaTabla({ aulas: 0, grupos: [] } as never))
      .toBe("sin columnas de control llenas");
  });
});
