import { describe, expect, it } from "vitest";

import { loQueFaltaParaCerrar } from "./loQueFaltaParaCerrar";

/**
 * «Lo que falta para cerrar» dice DE DÓNDE sale lo conseguido.
 *
 * El panel calcula la brecha como `meta − logrado`, y `logrado` sale de una
 * cadena de respaldo con los TRES numeradores que conviven en Monitoreo:
 *
 *   efectivas_obtenidas ?? effective_surveys ?? sent_total
 *      plataforma            el parte           la hoja del equipo
 *
 * El ADR 0082 fijó que sólo el primero es τ y que los otros dos «NO producen τ:
 * producen la reconciliación, y se muestran como cuadre, con su propio rótulo,
 * nunca junto a τ bajo el mismo nombre». Aquí viajaban los tres bajo un solo
 * número y el panel no decía cuál.
 *
 * No se retira la cadena —sin ella el panel se queda mudo cuando la plataforma
 * aún no trajo nada— sino que se declara, que es lo que el motor ya hace con
 * `meta_origen` para el otro lado de la resta.
 */
// `efectiva: false` no es adorno: es lo que hace que un aula cuente como «por
// cerrar». Sin ella el motor la descarta antes de mirar los numeradores y el
// panel sale vacío — que fue exactamente el primer rojo de este test.
const fila = (extra: Record<string, unknown>) => ({
  operational_code: "CH 1", faculty: "DERECHO", expected_valid: 20,
  efectiva: false, ...extra,
});

describe("la brecha declara el origen de lo conseguido", () => {
  it("cuenta cuántas aulas salieron de cada numerador", () => {
    const r = loQueFaltaParaCerrar([
      fila({ operational_code: "CH 1", efectivas_obtenidas: 5 }),
      fila({ operational_code: "CH 2", effective_surveys: 6 }),
      fila({ operational_code: "CH 3", sent_total: 7 }),
      fila({ operational_code: "CH 4", efectivas_obtenidas: 8 }),
    ] as never);
    expect(r.origenes).toEqual({ plataforma: 2, parte: 1, hoja: 1 });
  });

  it("la plataforma gana cuando están las tres", () => {
    // El orden de la cadena es el del ADR: la efectiva del estudio se define en
    // la plataforma. Si alguien invierte la cadena, este test lo caza.
    const r = loQueFaltaParaCerrar([
      fila({ efectivas_obtenidas: 5, effective_surveys: 99, sent_total: 99 }),
    ] as never);
    expect(r.origenes).toEqual({ plataforma: 1, parte: 0, hoja: 0 });
    expect(r.aulas[0].enviadas).toBe(5);
  });

  it("con todo de plataforma, el panel no tiene nada que advertir", () => {
    const r = loQueFaltaParaCerrar([
      fila({ operational_code: "CH 1", efectivas_obtenidas: 5 }),
      fila({ operational_code: "CH 2", efectivas_obtenidas: 6 }),
    ] as never);
    expect(r.origenes).toEqual({ plataforma: 2, parte: 0, hoja: 0 });
    expect(r.mezclaDeOrigenes).toBe(false);
  });

  it("con orígenes mezclados lo DECLARA, que es el punto", () => {
    const r = loQueFaltaParaCerrar([
      fila({ operational_code: "CH 1", efectivas_obtenidas: 5 }),
      fila({ operational_code: "CH 2", sent_total: 7 }),
    ] as never);
    expect(r.mezclaDeOrigenes).toBe(true);
  });
});

describe("los rótulos no prometen τ cuando miden otra cosa", () => {
  it("el alcance del banco nombra su numerador y lo distingue de la efectiva", async () => {
    // ADR 0082, cláusula 3: el parte y la Base de control NO producen τ,
    // producen el cuadre, y van «con su propio rótulo, nunca junto a τ bajo el
    // mismo nombre». Este panel proyecta con `sent_total` y decía «la tasa a la
    // que han respondido las aulas», que es la forma exacta de nombrar τ.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const fuente = fs.readFileSync(path.join(aqui, "AulasAlcanceDelBanco.tsx"), "utf8");
    // El cuerpo, sin comentarios: uno de ellos cita la frase vieja para
    // explicar por qué se cambió, y un detector ingenuo la contaría.
    const cuerpo = fuente.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(cuerpo).toContain("da por enviado");
    expect(cuerpo).not.toContain("han respondido las aulas aplicadas");
  });
});
