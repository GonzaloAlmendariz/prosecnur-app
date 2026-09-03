import { describe, expect, it } from "vitest";

import {
  BORDE_CAMPUS,
  PABELLONES_CAMPUS,
  PUERTAS_CAMPUS,
  letrasDeVenue,
  lugaresDeVenue,
  proyectar,
} from "./croquisDeCampus";

/**
 * B32, mitad de app: los datos del croquis del campus son el GEMELO del motor
 * de fichas (api/R/collection_render_croquis.R) — mismas 21 letras, mismas
 * coordenadas con fuente documentada en docs/qa/croquis-campus-pucp-fuentes.md,
 * mismo parser de venues multi-aula. Si una capa mueve un pabellón sin la
 * otra, el papel y la pantalla señalan edificios distintos y nadie avisa.
 */
describe("la tabla de pabellones del croquis", () => {
  it("trae las 21 letras del campus, con Y declarada como derivada", () => {
    const letras = PABELLONES_CAMPUS.map((p) => p.letra);
    expect(letras).toHaveLength(21);
    for (const l of ["A", "D", "E", "G", "H", "I", "J", "L", "M", "N", "O", "P", "Q", "R", "V", "X", "Y", "Z"]) {
      expect(letras, `letra del operativo ${l}`).toContain(l);
    }
    const y = PABELLONES_CAMPUS.find((p) => p.letra === "Y");
    // Y no tiene marcador propio en ninguna fuente: su posición es un
    // centroide de vecinos y el dato lo DICE, igual que en el motor R.
    expect(y?.fuente).toBe("derivada");
  });

  it("la proyección respeta la geografía: norte arriba, este a la derecha", () => {
    const en = (letra: string) => {
      const p = PABELLONES_CAMPUS.find((x) => x.letra === letra)!;
      return proyectar(p.lat, p.lng);
    };
    // X es el extremo norte y O el sur: en SVG la y crece hacia abajo.
    expect(en("X").y).toBeLessThan(en("O").y);
    // P está al este de O.
    expect(en("P").x).toBeGreaterThan(en("O").x);
    // Todo dentro del lienzo.
    for (const p of PABELLONES_CAMPUS) {
      const { x, y } = proyectar(p.lat, p.lng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it("el marco trae borde y las cinco puertas", () => {
    expect(BORDE_CAMPUS.length).toBeGreaterThanOrEqual(7);
    expect(PUERTAS_CAMPUS.map((p) => p.nombre)).toContain("Principal");
    expect(PUERTAS_CAMPUS).toHaveLength(5);
  });
});

describe("el venue multi-aula se parte igual que en el motor de fichas", () => {
  it("dos aulas con «·» son dos lugares; las letras no se repiten", () => {
    // Medido en ULT2: 301/1.392 venues traen dos aulas y 73 cruzan pabellón.
    expect(lugaresDeVenue("H404 · A608")).toEqual(["H404", "A608"]);
    expect(lugaresDeVenue("A206")).toEqual(["A206"]);
    expect(lugaresDeVenue("")).toEqual([]);
    expect(letrasDeVenue("A204 · A206")).toEqual(["A"]);
    expect(letrasDeVenue("H404 · A608")).toEqual(["H", "A"]);
    // El token sin edificio conserva su letra: quién decide si existe es el
    // componente, que lo declara — el parser no se traga nada.
    expect(letrasDeVenue("TAMB · Z111")).toEqual(["T", "Z"]);
  });
});
