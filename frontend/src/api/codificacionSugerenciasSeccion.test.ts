// GET /api/codificacion/sugerencias-seccion (TXT-3): la propuesta de módulo del formulario para cada comentario. Es sólo
// lectura y el payload llega de R con vectores de uno desempacados o no, listas vacías como `{}` y `por_modulo` con
// nombres numéricos; el normalizador no debe romperse ni dar por confirmada una propuesta.
import { describe, expect, it } from "vitest";
import { normalizeCodifSugerenciasSeccion } from "./codificacion";

describe("normalizeCodifSugerenciasSeccion", () => {
  it("lee el payload canónico", () => {
    const out = normalizeCodifSugerenciasSeccion({
      ok: true, base_name: "ccss", variable: "coment", estado: "propuesta", requiere_confirmacion: true,
      modulos: [{ codigo: "10", seccion: "modulo_a", etiqueta: "A. Información general", n_terminos: 40 },
        { codigo: "20", seccion: "modulo_b", etiqueta: "B. Experiencia universitaria", n_terminos: 120 }],
      otro: { codigo: "80", etiqueta: "Otro" },
      respuestas: [
        { id_caso: "r1", fila: 3, texto: "Más espacios de estudio", no_respuesta: false, candidato_otro: false,
          propuestas: [{ codigo: "20", seccion: "modulo_b", etiqueta: "B. Experiencia universitaria", puntaje: 2.31, palabras: ["espacios", "estudio"] }] },
        { id_caso: "r2", fila: 4, texto: "ninguno", no_respuesta: true, candidato_otro: false, propuestas: [] },
        { id_caso: "r3", fila: 7, texto: "Gracias por la encuesta", no_respuesta: false, candidato_otro: true, propuestas: [] },
      ],
      resumen: { escribieron: 3, con_contenido: 2, con_propuesta: 1, candidatos_otro: 1, por_modulo: { "10": 0, "20": 1 } },
    });
    expect(out.variable).toBe("coment");
    expect(out.requiereConfirmacion).toBe(true);
    expect(out.modulos.map((m) => m.codigo)).toEqual(["10", "20"]);
    expect(out.otro).toEqual({ codigo: "80", etiqueta: "Otro" });
    expect(out.respuestas[0].propuestas[0]).toEqual({ codigo: "20", seccion: "modulo_b", etiqueta: "B. Experiencia universitaria", puntaje: 2.31, palabras: ["espacios", "estudio"] });
    expect(out.respuestas[1]).toMatchObject({ noRespuesta: true, candidatoOtro: false, propuestas: [] });
    expect(out.respuestas[2]).toMatchObject({ candidatoOtro: true });
    expect(out.resumen).toEqual({ escribieron: 3, conContenido: 2, conPropuesta: 1, candidatosOtro: 1, porModulo: { "10": 0, "20": 1 } });
  });

  it("tolera escalares en caja, listas vacías como {} y una palabra desempacada", () => {
    const out = normalizeCodifSugerenciasSeccion({
      variable: ["coment"], requiere_confirmacion: [true],
      modulos: { codigo: ["10"], seccion: ["modulo_a"], etiqueta: ["A"], n_terminos: [3] },
      respuestas: [{ id_caso: ["7"], fila: [7], texto: ["Hola"], no_respuesta: [false], candidato_otro: [false],
        propuestas: { codigo: "10", seccion: "modulo_a", etiqueta: "A", puntaje: [1.5], palabras: "crianza" } }],
      resumen: {},
    });
    expect(out.modulos).toHaveLength(1);
    expect(out.respuestas[0].propuestas).toEqual([{ codigo: "10", seccion: "modulo_a", etiqueta: "A", puntaje: 1.5, palabras: ["crianza"] }]);
    expect(out.resumen.escribieron).toBe(0);
    expect(out.otro.codigo).toBe("80");
  });

  it("una propuesta a un módulo que no está en la lista se descarta; sin respuesta no hay propuestas", () => {
    const out = normalizeCodifSugerenciasSeccion({
      modulos: [{ codigo: "10", seccion: "a", etiqueta: "A" }],
      respuestas: [
        { id_caso: "1", texto: "x", propuestas: [{ codigo: "99", etiqueta: "Fantasma" }, { codigo: "10", etiqueta: "A" }] },
        { id_caso: "2", texto: "no", no_respuesta: true, propuestas: [{ codigo: "10", etiqueta: "A" }] },
        { texto: "sin id" },
      ],
    });
    expect(out.respuestas).toHaveLength(2);
    expect(out.respuestas[0].propuestas.map((p) => p.codigo)).toEqual(["10"]);
    expect(out.respuestas[1].propuestas).toEqual([]);
    // Nunca llega como confirmada: el endpoint propone, no asigna.
    expect(normalizeCodifSugerenciasSeccion(null).requiereConfirmacion).toBe(true);
  });
});

// TXT-11/17: un módulo partido trae sus subtemas con `padre`; las propuestas a un subtema también. El front los agrupa
// bajo su módulo y los nombra con la letra del módulo.
describe("normalizeCodifSugerenciasSeccion: subtemas", () => {
  it("lleva `padre` y la etiqueta del módulo padre a los subtemas y a sus propuestas", () => {
    const out = normalizeCodifSugerenciasSeccion({
      modulos: [
        { codigo: "20", seccion: "modulo_b", etiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA", n_terminos: 9 },
        { codigo: "22", seccion: "redes", etiqueta: "¿Con qué frecuencia utilizas las siguientes redes sociales?", padre: "20", n_terminos: 4 },
      ],
      respuestas: [{ id_caso: "1", texto: "x", propuestas: [{ codigo: "22", etiqueta: "¿Con qué frecuencia utilizas las siguientes redes sociales?", padre: "20", subtema: "22", puntaje: 1 }] }],
    });
    expect(out.modulos[0].padre).toBeUndefined();
    expect(out.modulos[1]).toMatchObject({ padre: "20", padreEtiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" });
    expect(out.respuestas[0].propuestas[0]).toMatchObject({ codigo: "22", padre: "20", padreEtiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA" });
  });
});
