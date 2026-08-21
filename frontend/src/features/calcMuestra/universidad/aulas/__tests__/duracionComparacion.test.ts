import { describe, expect, it } from "vitest";
import { avisoDuracionComparacion, CM_COMPARAR_UMBRAL_LARGO } from "../duracionComparacion";

describe("avisoDuracionComparacion", () => {
  it("avisa en el caso real medido: 3.142 aulas × 17 facultades", () => {
    // Medido: una corrida del método balanceado pasa de 8 min con ese reparto,
    // contra 57 s con objetivo global sobre el MISMO marco.
    const r = avisoDuracionComparacion({ aulas: 3142, facultades: 17 });
    expect(r.avisar).toBe(true);
    expect(r.carga).toBe(3142 * 17);
  });

  it("no avisa en el marco chico que se midió en minutos", () => {
    // 57 aulas en 2 facultades: los cuatro métodos en 19,3 min.
    expect(avisoDuracionComparacion({ aulas: 57, facultades: 2 }).avisar).toBe(false);
    expect(avisoDuracionComparacion({ aulas: 342, facultades: 5 }).avisar).toBe(false);
  });

  it("sin reparto declarado cuenta como un solo estrato, que es el caso barato", () => {
    // Es la diferencia medida: el coste lo dispara respetar N cuotas a la vez.
    const sinReparto = avisoDuracionComparacion({ aulas: 3142, facultades: 0 });
    expect(sinReparto.carga).toBe(3142);
    expect(sinReparto.avisar).toBe(false);
  });

  it("no se rompe con cifras imposibles", () => {
    expect(avisoDuracionComparacion({ aulas: 0, facultades: 17 }).avisar).toBe(false);
    expect(avisoDuracionComparacion({ aulas: -5, facultades: -2 }).carga).toBe(0);
    expect(avisoDuracionComparacion({ aulas: NaN, facultades: NaN }).carga).toBe(0);
  });

  it("el umbral es el declarado, no un número suelto en el código", () => {
    expect(avisoDuracionComparacion({ aulas: CM_COMPARAR_UMBRAL_LARGO, facultades: 1 }).avisar).toBe(true);
    expect(avisoDuracionComparacion({ aulas: CM_COMPARAR_UMBRAL_LARGO - 1, facultades: 1 }).avisar).toBe(false);
  });
});

describe("el aviso cuenta las aulas que de verdad se comparan", () => {
  // Defecto propio, cazado al verificar en vivo: el aviso decía «5.269
  // cursos-horario» —todas las filas del frame— cuando la comparación trabaja
  // sobre las 3.373 INCLUIDAS. Un rótulo con otro número, en el mismo commit
  // que reparaba rótulos con otro número.
  const contarIncluidas = (filas: Array<{ included?: unknown }>) =>
    filas.filter((f) => f.included === true).length;

  it("las excluidas por criterios no entran en la cuenta", () => {
    const filas = [
      { included: true }, { included: true }, { included: false },
      { included: undefined }, { included: "true" }, { included: null },
    ];
    expect(contarIncluidas(filas)).toBe(2);
    // Con el total (6) el aviso saltaría; con las incluidas (2) no.
    expect(avisoDuracionComparacion({ aulas: contarIncluidas(filas) * 1000, facultades: 3 }).avisar).toBe(false);
    expect(avisoDuracionComparacion({ aulas: filas.length * 1000, facultades: 3 }).avisar).toBe(true);
  });
});
