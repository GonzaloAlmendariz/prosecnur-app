import { describe, expect, it } from "vitest";

import { alumnosQueFaltanEnTotal } from "./AulasEfectividadSeguimiento";

/**
 * La cabecera y la columna tienen que dar el mismo número.
 *
 * Medido el 2026-08-29 en `avance/efectividad`: la cabecera decía «528 alumnos
 * en riesgo en 12 facultades» y la columna «Alumnos» de esas doce sumaba 535.
 * Ninguno estaba mal —el motor suma los déficits crudos y cada fila los
 * redondea hacia arriba en magnitud, a propósito— pero quien suma la columna
 * encuentra el hueco y desconfía de las dos cifras.
 */

const f = (riesgo: string, margen_restante: number | null) => ({ riesgo, margen_restante });

describe("los alumnos que faltan en total", () => {
  it("suma los techos, no el techo de la suma", () => {
    // Tres facultades a −22,4: el crudo da 67,2 → 67, y la suma de techos 69.
    // El número bueno es 69: cada facultad hay que cubrirla por separado.
    const filas = [f("riesgo", -22.4), f("riesgo", -22.4), f("riesgo_firme", -22.4)];
    expect(alumnosQueFaltanEnTotal(filas)).toBe(69);
    expect(alumnosQueFaltanEnTotal(filas)).not.toBe(Math.round(22.4 * 3));
  });

  it("sólo cuentan las facultades en riesgo", () => {
    // Una holgada con margen negativo no existe, pero una «ajustada» sí puede
    // rozar el cero y no está en riesgo: contarla inflaría la alarma.
    expect(alumnosQueFaltanEnTotal([
      f("riesgo", -10), f("ajustado", -3), f("holgado", -1), f("sin_campo", null),
    ])).toBe(10);
  });

  it("el excedente NO descuenta lo que falta en otra facultad", () => {
    // ADR 0079. Si se netearan, +50 en Derecho taparía −10 en Letras y la
    // pantalla diría que no falta nadie.
    expect(alumnosQueFaltanEnTotal([f("riesgo", -10), f("holgado", 50)])).toBe(10);
  });

  it("un margen que no es número no suma ni rompe", () => {
    // `NaN` colandose sumaria `NaN` y la cabecera diria «NaN alumnos en riesgo».
    expect(alumnosQueFaltanEnTotal([
      f("riesgo", Number.NaN), f("riesgo", null), f("riesgo", -5),
    ])).toBe(5);
  });

  it("sin facultades en riesgo da cero, no NaN", () => {
    expect(alumnosQueFaltanEnTotal([])).toBe(0);
  });
});
