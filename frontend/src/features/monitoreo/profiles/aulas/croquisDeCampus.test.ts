import { describe, expect, it } from "vitest";

import {
  BASE_PULSO,
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
    expect(letras).toHaveLength(22);
    for (const l of ["A", "D", "E", "G", "H", "I", "J", "L", "M", "N", "O", "P", "Q", "R", "V", "X", "Y", "Z"]) {
      expect(letras, `letra del operativo ${l}`).toContain(l);
    }
    // K entro por el barrido de Google Maps (Sec. Mecatronica) y lo dice.
    expect(PABELLONES_CAMPUS.find((p) => p.letra === "K")?.fuente).toBe("google");
    const y = PABELLONES_CAMPUS.find((p) => p.letra === "Y");
    // Y no tiene marcador propio en ninguna fuente: su posición es un
    // centroide de vecinos y el dato lo DICE, igual que en el motor R.
    expect(y?.fuente).toBe("derivada");
  });

  it("la proyección está girada 180 grados: sur arriba, este a la izquierda", () => {
    // Dictado de Gonzalo (2026-09-03): «inviertas el mapa 180 grados» — el
    // gemelo de pantalla gira con el papel o dejan de ser el mismo croquis.
    const en = (letra: string) => {
      const p = PABELLONES_CAMPUS.find((x) => x.letra === letra)!;
      return proyectar(p.lat, p.lng);
    };
    // X es el extremo norte: tras el giro queda ABAJO (y SVG crece hacia abajo).
    expect(en("X").y).toBeGreaterThan(en("O").y);
    // P está al este: tras el giro queda a la izquierda.
    expect(en("P").x).toBeLessThan(en("O").x);
    // Todo dentro del lienzo.
    for (const p of PABELLONES_CAMPUS) {
      const { x, y } = proyectar(p.lat, p.lng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it("la base PULSO PUCP está en su punto confirmado, en el barrio del L", () => {
    // Dictado (2026-09-03): «resalta dónde está PULSO PUCP siempre». El dueño
    // corrigió la primera derivación con captura; la coordenada es la del
    // place público de Google Maps (junto a CIGA) — fuente CONFIRMADA,
    // gemela del motor R.
    expect(BASE_PULSO.nombre).toBe("PULSO PUCP");
    expect(BASE_PULSO.fuente).toBe("confirmada");
    const ele = PABELLONES_CAMPUS.find((p) => p.letra === "L")!;
    const dLat = (BASE_PULSO.lat - ele.lat) * 110574;
    const dLng = (BASE_PULSO.lng - ele.lng) * 111320 * Math.cos((12.07 * Math.PI) / 180);
    expect(Math.hypot(dLat, dLng)).toBeLessThan(120);
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
