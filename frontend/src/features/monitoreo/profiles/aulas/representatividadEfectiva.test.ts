import { describe, expect, test } from "vitest";

import { representatividadEfectiva } from "./representatividadEfectiva";

/**
 * El bloque `representativity` lo calculaba el motor en cada refresco del estado
 * y NINGÚN archivo del frontend lo leía (censo del 2026-09-08). Estos tests
 * fijan la lectura antes de que exista la pantalla, porque el contrato lo pone
 * R —`.monitoreo_aulas_effective_representativity()`— y lo que se rompe en
 * silencio es la frontera, no el render.
 */

function fila(sobre: Partial<Record<string, unknown>> = {}) {
  return {
    variable: "stratum",
    categoria: "DERECHO / F / g3",
    planned_n: 100,
    effective_n: 90,
    planned_prop: 0.25,
    effective_prop: 0.22,
    abs_error: 0.03,
    ...sobre,
  };
}

function bloque(sobre: Partial<Record<string, unknown>> = {}) {
  return {
    planned_score: 92.4,
    effective_score: 88.1,
    effective_distance: 0.0215,
    score_loss: 4.3,
    planned_aulas: 174,
    effective_aulas: 168,
    warning: "",
    distribution: [fila()],
    ...sobre,
  };
}

describe("representatividad efectiva", () => {
  test("la desviación se publica en puntos porcentuales y con signo", () => {
    const vista = representatividadEfectiva(bloque());
    expect(vista.vacio).toBeNull();
    // 0.22 − 0.25 = −0.03 → −3 pp. El signo importa: dice si ese estrato SOBRA
    // o FALTA en lo que se está aplicando, y son dos remedios distintos.
    expect(vista.desvios[0].desvio).toBe(-3);
    expect(vista.desvios[0].magnitud).toBe(3);
    // La distancia media también, para que las dos cifras se lean en la misma
    // unidad: 0.0215 → 2.2 pp.
    expect(vista.desvioMedio).toBe(2.2);
  });

  test("la clave del estrato se traduce, y la cruda se conserva para emparejar", () => {
    const vista = representatividadEfectiva(bloque());
    expect(vista.desvios[0].clave).toBe("DERECHO / F / g3");
    // `F` es el sexo PREDOMINANTE del curso-horario, no «mujeres», y `g3` es un
    // tramo de tamaño: los dos se dicen en palabras.
    expect(vista.desvios[0].etiqueta).toContain("mayoría mujeres");
    expect(vista.desvios[0].etiqueta).toContain("31-40 alumnos");
  });

  test("ordena por magnitud, no por signo: lo que más se movió va primero", () => {
    const vista = representatividadEfectiva(bloque({
      distribution: [
        fila({ categoria: "A / F / g1", planned_prop: 0.10, effective_prop: 0.12 }),
        fila({ categoria: "B / M / g2", planned_prop: 0.30, effective_prop: 0.22 }),
        fila({ categoria: "C / F / g3", planned_prop: 0.20, effective_prop: 0.23 }),
      ],
    }));
    expect(vista.desvios.map((d) => d.desvio)).toEqual([-8, 3, 2]);
  });

  test("los estratos que no se movieron se CUENTAN, no se esconden", () => {
    // Sin esta cifra, «dos estratos desviados» no distingue dos de tres de dos
    // de setenta, que es la diferencia entre un problema y una anécdota.
    const vista = representatividadEfectiva(bloque({
      distribution: [
        fila({ categoria: "A / F / g1", planned_prop: 0.25, effective_prop: 0.25 }),
        fila({ categoria: "B / M / g2", planned_prop: 0.25, effective_prop: 0.25 }),
        fila({ categoria: "C / F / g3", planned_prop: 0.25, effective_prop: 0.20 }),
      ],
    }));
    expect(vista.desvios).toHaveLength(1);
    expect(vista.sinMoverse).toBe(2);
  });

  test("sin ninguna desviación el vacío dice que la composición se conserva, con su cifra", () => {
    const vista = representatividadEfectiva(bloque({
      distribution: [fila({ planned_prop: 0.25, effective_prop: 0.25 })],
    }));
    expect(vista.vacio).toContain("conserva la composición del sorteo");
    expect(vista.vacio).toContain("1 estratos");
  });

  test("sin distribución se REPITE el vacío del motor, no se inventa otro", () => {
    // Quien decide por qué no se puede medir es el motor. Dos redacciones del
    // mismo hueco acaban diciendo cosas distintas.
    const vista = representatividadEfectiva(bloque({
      distribution: [],
      warning: "Sin datos suficientes para distancia efectiva.",
    }));
    expect(vista.vacio).toBe("Sin datos suficientes para distancia efectiva.");
  });

  test("sin bloque el vacío nombra su causa y no revienta", () => {
    const vista = representatividadEfectiva(undefined);
    expect(vista.vacio).toContain("plan del sorteo");
    expect(vista.desvios).toEqual([]);
  });

  test("el NULL de R que llega como objeto vacío no se lee como número", () => {
    // `jsonlite` serializa un NULL dentro de una lista como `{}`. Ya publicó un
    // «[object Object]» en pantalla el 2026-09-08; aquí produciría un NaN.
    const vista = representatividadEfectiva(bloque({
      effective_score: {},
      effective_distance: {},
      distribution: [fila({ abs_error: {} })],
    }));
    expect(vista.efectivo).toBeNull();
    expect(vista.desvioMedio).toBeNull();
    expect(vista.desvios[0].desvio).toBe(-3);
  });

  test("`score_loss` NO se publica: resta dos escalas distintas", () => {
    // `planned_score` mide el DISEÑO contra el marco de la universidad (72,4 en
    // HSVG2026) y `effective_score` mide la muestra efectiva contra el DISEÑO
    // (99,9). Su resta —«score_loss»— da −27,5 y en pantalla diría «ganamos 27,5
    // puntos de representatividad», que no significa nada.
    //
    // Este test no comprueba un cálculo: comprueba una AUSENCIA deliberada, para
    // que nadie lo reintroduzca leyendo el payload y viendo el campo ahí.
    const vista = representatividadEfectiva(bloque({
      planned_score: 72.4, effective_score: 99.9, score_loss: -27.5,
    }));
    expect(vista.efectivo).toBe(99.9);
    expect(Object.keys(vista)).not.toContain("perdida");
    expect(Object.keys(vista)).not.toContain("disenado");
  });

  test("una fila sin proporciones se descarta en vez de contarse como cero", () => {
    // Una fila sin denominador no es un estrato que no se movió: es un estrato
    // que no se pudo medir, y contarlo entre los quietos mentiría sobre el total.
    const vista = representatividadEfectiva(bloque({
      distribution: [
        fila({ categoria: "A / F / g1", planned_prop: null, effective_prop: null }),
        fila({ categoria: "B / M / g2", planned_prop: 0.30, effective_prop: 0.22 }),
      ],
    }));
    expect(vista.desvios).toHaveLength(1);
    expect(vista.sinMoverse).toBe(0);
  });

  test("el aviso del motor viaja tal cual", () => {
    const vista = representatividadEfectiva(bloque({
      warning: "La muestra efectiva se aleja más de 10 pp en al menos un grupo de facultad y sexo.",
    }));
    expect(vista.aviso).toContain("10 pp");
  });
});
