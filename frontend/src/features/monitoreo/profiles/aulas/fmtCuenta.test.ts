import { describe, expect, it } from "vitest";
import { fmt, fmtCuenta } from "./kpisDeAulas";

/**
 * Medido en Avance el 2026-08-23: «meta 3,491.4», «576.5 respuestas faltan»,
 * «543.6», «456.6»… diez cifras con decimal en una pantalla que cuenta
 * respuestas. La meta sale de dividir la cuota entre la tasa de efectividad,
 * así que llega fraccionaria del motor.
 */
describe("fmtCuenta", () => {
  it("no parte una respuesta", () => {
    expect(fmtCuenta(576.5)).toBe("577");
    expect(fmtCuenta(3491.4)).toBe("3,492");
  });

  it("redondea hacia ARRIBA, no al más cercano", () => {
    // Con 576 no se cumple una meta de 576,5. El techo es el criterio de algo
    // que hay que alcanzar; `Math.round` daría 576 y diría que ya está.
    expect(fmtCuenta(576.1)).toBe("577");
    expect(fmtCuenta(576.9)).toBe("577");
  });

  it("deja en paz a los enteros", () => {
    // Sin la tolerancia, `Math.ceil` sobre un entero que viene de una división
    // en coma flotante lo subiría uno.
    expect(fmtCuenta(577)).toBe("577");
    expect(fmtCuenta(0)).toBe("0");
    expect(fmtCuenta(2616)).toBe("2,616");
  });

  it("separa los miles como el resto de la pantalla", () => {
    expect(fmtCuenta(3491.4)).toBe("3,492");
    expect(fmtCuenta(1916)).toBe("1,916");
  });

  it("un sobrante negativo no baja un entero de más, ni se pinta «-0»", () => {
    // «-0 respuestas» no lo escribe nadie.
    expect(fmtCuenta(-0.4)).toBe("0");
    expect(fmtCuenta(-3)).toBe("-3");
  });

  it("sin dato devuelve el fallback y no «NaN»", () => {
    expect(fmtCuenta(null)).toBe("0");
    expect(fmtCuenta("")).toBe("0");
    expect(fmtCuenta(undefined, "—")).toBe("—");
    expect(fmtCuenta("hola")).toBe("hola");
  });

  it("`fmt` sigue conservando los decimales, que es lo suyo para una tasa", () => {
    // Las dos funciones conviven a propósito: un 41,3 % no puede volverse 42 %.
    expect(fmt(41.3)).toBe("41.3");
  });
});

import { presentAulasRow } from "./aulasPresentation";

describe("presentAulasRow · las columnas que cuentan cosas", () => {
  it("redondea «válidas esperadas» hacia arriba", () => {
    // Medido en «Avance por curso-horario»: 27.8 respuestas esperadas de un
    // aula. La meta sale de dividir la cuota entre la tasa.
    expect(presentAulasRow({ expected_valid: 27.8 }).expected_valid).toBe(28);
    expect(presentAulasRow({ efectivas_esperadas: 12.1 }).efectivas_esperadas).toBe(13);
  });

  it("deja intactos los enteros", () => {
    expect(presentAulasRow({ expected_valid: 28 }).expected_valid).toBe(28);
    expect(presentAulasRow({ expected_valid: 0 }).expected_valid).toBe(0);
  });

  it("no toca una columna que NO es una cuenta", () => {
    // Una tasa de 0,41 redondeada a 1 diría que el aula rinde el 100%.
    expect(presentAulasRow({ tasa_efectividad_aula: 0.41 }).tasa_efectividad_aula).toBe(0.41);
  });

  it("un valor no numérico se devuelve tal cual, no como NaN", () => {
    expect(presentAulasRow({ expected_valid: "sin dato" }).expected_valid).toBe("sin dato");
  });
});
