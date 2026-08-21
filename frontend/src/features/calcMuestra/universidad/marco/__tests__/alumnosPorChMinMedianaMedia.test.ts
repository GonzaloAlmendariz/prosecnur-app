/**
 * El cuarto estadístico de «Alumnos por CH»: mín(mediana, media).
 *
 * Es el que aplicó el diseño HSyVBG 2025 —su hoja «TD Estudiantes» nombra la
 * columna «Mínimo entre mediana y media»—. Se deriva de la distribución que el
 * snapshot ya publica, así que no toca el schema: una decisión firmada con
 * `p25` sigue normalizando igual.
 *
 * Este archivo fija las dos cosas que pueden salir mal en el frontend: que el
 * valor no espeje al motor, y que el id crudo se le muestre al analista.
 */
import { describe, expect, it } from "vitest";

import {
  alumnosPorChValue,
  normalizeCalcMuestraAlumnosPorChDecision,
  type CalcMuestraAlumnosPorChSnapshot,
} from "../../../../../api/calcMuestraAlumnosPorCh";
import {
  ALUMNOS_POR_CH_METHODS,
  esMetodoAlumnosPorChValido,
  etiquetaAlumnosPorChMetodo,
  metodoAlumnosPorChInicial,
} from "../alumnosPorChDecisionModel";

// Mismas dos facultades que el test de R, para que ambos lados se contrasten
// contra las mismas cifras:
//   FAC A  p25 15 · mediana 20 · media 30  ->  min = 20 (manda la mediana)
//   FAC B  p25 30 · mediana 50 · media 40  ->  min = 40 (manda la media)
const facA: CalcMuestraAlumnosPorChSnapshot = {
  n_ch: 3,
  n_ch_con_dato: 3,
  n_matriculas_elegibles: 90,
  distribution: { media: 30, p25: 15, p50: 20 },
};

const facB: CalcMuestraAlumnosPorChSnapshot = {
  n_ch: 3,
  n_ch_con_dato: 3,
  n_matriculas_elegibles: 120,
  distribution: { media: 40, p25: 30, p50: 50 },
};

describe("alumnosPorChValue con mín(mediana, media)", () => {
  it("toma la mediana cuando la mediana es la menor", () => {
    expect(alumnosPorChValue(facA, "min_mediana_media")).toBe(20);
  });

  it("toma la media cuando la media es la menor", () => {
    // La dirección contraria. Un cálculo que devolviera siempre la mediana pasa
    // el caso de arriba y cae aquí.
    expect(alumnosPorChValue(facB, "min_mediana_media")).toBe(40);
  });

  it("se distingue de los tres estadísticos de siempre", () => {
    expect(alumnosPorChValue(facA, "p25")).toBe(15);
    expect(alumnosPorChValue(facA, "mediana")).toBe(20);
    expect(alumnosPorChValue(facA, "media")).toBe(30);
    expect(alumnosPorChValue(facB, "p25")).toBe(30);
    expect(alumnosPorChValue(facB, "mediana")).toBe(50);
    expect(alumnosPorChValue(facB, "media")).toBe(40);
  });

  it("sin uno de los dos centros no hay mínimo", () => {
    // Espeja al motor, que resuelve el mínimo sin `na.rm`. Devolver el centro
    // que sí existe daría un divisor plausible y equivocado, y la superficie lo
    // pintaría como si estuviera decidido.
    const sinMedia = { ...facA, distribution: { ...facA.distribution, media: null } };
    const sinMediana = { ...facA, distribution: { ...facA.distribution, p50: null } };
    const vacio = { ...facA, distribution: { media: null, p25: null, p50: null } };
    expect(alumnosPorChValue(sinMedia, "min_mediana_media")).toBeNull();
    expect(alumnosPorChValue(sinMediana, "min_mediana_media")).toBeNull();
    expect(alumnosPorChValue(vacio, "min_mediana_media")).toBeNull();
  });
});

describe("el método se ofrece y se persiste", () => {
  it("está entre las opciones que la superficie publica", () => {
    const ids = ALUMNOS_POR_CH_METHODS.map((method) => method.id);
    expect(ids).toContain("min_mediana_media");
    // MUDADO 2026-08-21 — el default vuelve a `p25`. Gonzalo: «el valor por
    // defecto que calculamos aquí es el primer cuartil, es el P25 y SIEMPRE es
    // el P25, a menos que una persona decida utilizar otro indicador». El
    // default anterior contradecía a la propia pantalla, que marca P25 como
    // RECOMENDADO y ofrece «Restablecer P25»: quien no tocaba nada se llevaba
    // otro estadístico. El método sigue OFRECIÉNDOSE; lo que cambia es cuál
    // arranca elegido.
    expect(metodoAlumnosPorChInicial(undefined)).toBe("p25");
    // Un estudio que ya guardó el suyo lo conserva: el default no lo pisa.
    expect(metodoAlumnosPorChInicial("min_mediana_media")).toBe("min_mediana_media");
    expect(esMetodoAlumnosPorChValido("min_mediana_media")).toBe(true);
  });

  it("sobrevive la normalización de la decisión que viene de R", () => {
    // Si el normalizador no lo conociera, la decisión entera se caería a null y
    // la pantalla diría «sin decisión» sobre una decisión firmada.
    const decision = normalizeCalcMuestraAlumnosPorChDecision({
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: "frame-min-1",
      denominador: "elegible",
      estadistico_default: "min_mediana_media",
      por_facultad: { fac_b: "min_mediana_media" },
      confirmado_at: "2026-08-16T12:00:00Z",
    });
    expect(decision?.estadistico_default).toBe("min_mediana_media");
    expect(decision?.por_facultad.fac_b).toBe("min_mediana_media");
  });

  it("un estadístico inventado sigue tumbando la decisión", () => {
    // La whitelist creció en uno, no se abrió. `min_media_mediana` es el nombre
    // que usa el OTRO contrato —el estadístico de conglomerado del Recorrido—,
    // con los dos términos invertidos: aquí no es válido.
    expect(normalizeCalcMuestraAlumnosPorChDecision({
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: "frame-min-1",
      denominador: "elegible",
      estadistico_default: "min_media_mediana",
      por_facultad: {},
      confirmado_at: "2026-08-16T12:00:00Z",
    })).toBeNull();
    expect(esMetodoAlumnosPorChValido("min_media_mediana")).toBe(false);
  });
});

describe("el id del motor no viaja a la pantalla", () => {
  it("cada método se nombra como se lee", () => {
    // Gonzalo: «el título debería ser mínimo entre media y mediana», sin la
    // fórmula abreviada y sin apoyarse en «lo que se aplicó en 2025».
    expect(etiquetaAlumnosPorChMetodo("min_mediana_media")).toBe("Mínimo entre media y mediana");
    expect(etiquetaAlumnosPorChMetodo("p25")).toBe("P25");
    expect(etiquetaAlumnosPorChMetodo("mediana")).toBe("Mediana");
    expect(etiquetaAlumnosPorChMetodo("media")).toBe("Media");
    // Ninguna etiqueta puede quedarse en jerga de motor.
    for (const method of ALUMNOS_POR_CH_METHODS) {
      expect(etiquetaAlumnosPorChMetodo(method.id)).not.toBe(method.id);
    }
  });

  it("un id desconocido se muestra tal cual en vez de desaparecer", () => {
    // La auditoría llega de R y podría traer un método de una versión futura.
    // Preferimos un id feo a una celda vacía que borre la trazabilidad.
    expect(etiquetaAlumnosPorChMetodo("estadistico_de_2027")).toBe("estadistico_de_2027");
  });

  it("un id ausente deja la celda como estaba, no dice 'undefined'", () => {
    // `estadistico_usado` es opcional en el resultado; la celda ya se pintaba
    // vacía y traducirlo no puede empeorarla.
    expect(etiquetaAlumnosPorChMetodo(undefined)).toBe("");
    expect(etiquetaAlumnosPorChMetodo(null)).toBe("");
    expect(etiquetaAlumnosPorChMetodo("")).toBe("");
  });
});
