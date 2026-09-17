import { describe, expect, it } from "vitest";

import { esFocoDelEje, focoDesdeTexto, textoDesdeFoco } from "./AulasCuotasResumen";

/**
 * El foco apunta al EJE, no a «facultad».
 *
 * Cuatro sitios del perfil preguntaban `foco.tipo === "facultad"` para saber si
 * el foco era el del eje de cuotas. Con el eje declarable esa comparación es una
 * respuesta cableada: en un estudio cuyas metas son por NIVEL el foco llega como
 * `nivel:7` y esos cuatro sitios lo daban por «no es el eje» — la sección entera
 * dejaba de obedecer al foco sin que nada fallara.
 *
 * La decisión de forma que esto protege: **el foco se ESCRIBE con la clave del
 * eje del estudio**, no con un literal ni con un alias genérico. Así los enlaces
 * de HSVG siguen diciendo `facultad:` byte a byte —son enlaces que la gente
 * comparte— y un estudio por nivel dice `nivel:`.
 */
describe("esFocoDelEje", () => {
  it("reconoce el foco del eje de cada estudio", () => {
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" }, "facultad")).toBe(true);
    expect(esFocoDelEje({ tipo: "nivel", valor: "7" }, "nivel")).toBe(true);
  });

  it("NO confunde el eje de un estudio con el del otro", () => {
    // Es el fallo concreto: un foco `nivel:7` en un estudio por nivel se leía
    // como «no es el eje» porque la pregunta era por «facultad».
    expect(esFocoDelEje({ tipo: "nivel", valor: "7" }, "facultad")).toBe(false);
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" }, "nivel")).toBe(false);
  });

  it("sin eje declarado, el eje es facultad — que es lo que era", () => {
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" })).toBe(true);
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" }, null)).toBe(true);
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" }, "")).toBe(true);
    // Y una clave que no es un eje declarable tampoco inventa uno nuevo: cae a
    // facultad en vez de dejar la sección sin foco posible.
    expect(esFocoDelEje({ tipo: "facultad", valor: "DERECHO" }, "carrera")).toBe(true);
  });

  it("las dimensiones descriptivas no son el eje", () => {
    // `sexo` y `carrera` acotan lo que se ve; `aula` no acota nada, abre una
    // ficha. Ninguna es la cuota.
    for (const tipo of ["sexo", "carrera", "aula"] as const) {
      expect(esFocoDelEje({ tipo, valor: "x" }, "facultad")).toBe(false);
      expect(esFocoDelEje({ tipo, valor: "x" }, "nivel")).toBe(false);
    }
  });

  it("sin foco no hay foco del eje", () => {
    expect(esFocoDelEje(null, "facultad")).toBe(false);
    expect(esFocoDelEje(null)).toBe(false);
  });
});

describe("focoDesdeTexto con el eje declarable", () => {
  it("lee las cinco dimensiones y nada más", () => {
    expect(focoDesdeTexto("facultad:DERECHO")).toEqual({ tipo: "facultad", valor: "DERECHO" });
    expect(focoDesdeTexto("nivel:7")).toEqual({ tipo: "nivel", valor: "7" });
    expect(focoDesdeTexto("carrera:ECONOMÍA")).toEqual({ tipo: "carrera", valor: "ECONOMÍA" });
    expect(focoDesdeTexto("sexo:F")).toEqual({ tipo: "sexo", valor: "F" });
    expect(focoDesdeTexto("aula:CH 31")).toEqual({ tipo: "aula", valor: "CH 31" });
    // La lista es cerrada a propósito: una cadena libre dejaría pasar `facutlad`
    // sin que nada chille, y el foco se perdería en silencio.
    expect(focoDesdeTexto("facutlad:DERECHO")).toBeNull();
    expect(focoDesdeTexto("eje:7")).toBeNull();
  });

  it("el enlace da la vuelta sin cambiar", () => {
    // Lo que protege a los enlaces que el equipo ya tiene compartidos.
    for (const texto of ["facultad:DERECHO", "nivel:7", "aula:CH 31", "carrera:ECONOMÍA"]) {
      expect(textoDesdeFoco(focoDesdeTexto(texto))).toBe(texto);
    }
  });

  it("un valor con dos puntos dentro no se parte", () => {
    // Pasa de verdad con nombres de curso y con horas.
    expect(focoDesdeTexto("aula:CH 31: TEORÍA")).toEqual({ tipo: "aula", valor: "CH 31: TEORÍA" });
  });

  it("sin valor no hay foco", () => {
    expect(focoDesdeTexto("nivel:")).toBeNull();
    expect(focoDesdeTexto("")).toBeNull();
    expect(focoDesdeTexto(null)).toBeNull();
  });
});
