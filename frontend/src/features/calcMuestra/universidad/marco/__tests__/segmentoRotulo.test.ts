import { describe, expect, it } from "vitest";

import { rotuloSegmento } from "../segmentoRotulo";

/**
 * F108 · Copy dentro de un artefacto persistido.
 *
 * Medido en la app: la superficie decía «Regla efectiva» **48 veces**. Ese texto
 * no estaba en `frontend/src` ni en `api/R` —F71 lo había renombrado— y el
 * proceso R vivo había arrancado *después* de la reparación. Venía en el dato:
 * `segment_label` se calcula al construir el marco y se persiste dentro de él.
 *
 * Cada `.pulso` guardado lleva, por tanto, el vocabulario del día en que se
 * construyó su marco. `segment_key` sí es contrato, así que el rótulo se
 * resuelve por llave en la capa de presentación.
 */
describe("rotuloSegmento", () => {
  it("un marco viejo se re-rotula con la palabra vigente", () => {
    expect(rotuloSegmento("global", "Regla efectiva", "ch")).toBe("Cursos-horario que cumplen");
    expect(rotuloSegmento("global", "Regla efectiva", "alumnos")).toBe("Estudiantes que cumplen");
  });

  it("un marco nuevo pasa igual: la llave manda, no el texto", () => {
    expect(rotuloSegmento("global", "Cursos-horario que cumplen", "ch")).toBe(
      "Cursos-horario que cumplen",
    );
  });

  it("una llave que el mapa no conoce cae al rótulo del payload", () => {
    // Preferimos una palabra vieja a un hueco: así el mapa puede ir por detrás
    // del motor sin dejar la superficie muda cuando aparezca un segmento nuevo.
    expect(rotuloSegmento("tipo_docente", "Docentes ordinarios", "ch")).toBe("Docentes ordinarios");
  });

  it("sin llave ni rótulo no inventa texto", () => {
    expect(rotuloSegmento(null, null, "ch")).toBe("");
    expect(rotuloSegmento(undefined, undefined, "alumnos")).toBe("");
  });

  it("sin llave pero con rótulo, respeta el que vino", () => {
    expect(rotuloSegmento(null, "Regla efectiva", "ch")).toBe("Regla efectiva");
  });
});
