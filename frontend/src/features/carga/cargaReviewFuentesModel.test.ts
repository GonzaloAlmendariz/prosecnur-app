import { describe, expect, it } from "vitest";
import { normalizeCargaReviewFuentes, type CargaReviewFuente } from "../../api/client";
import { cargaReviewFuentesHallazgos } from "./cargaReviewFuentesModel";

function fuente(partial: Partial<CargaReviewFuente>): CargaReviewFuente {
  return {
    survey_id: "s2",
    titulo: "Telefónico",
    n_emparejadas: 73,
    n_preguntas_base: 74,
    reordenada: false,
    instrumento_distinto: false,
    sin_par_fuente: [],
    sin_par_base: [],
    n_opciones_sin_par: 0,
    excluida: false,
    n_filas_excluidas: 0,
    ambiguas: [],
    consentimiento_sin_par: false,
    n_excluidas_consentimiento: 0,
    ...partial,
  };
}

const q = (etiqueta: string, variable = "") => ({ variable, etiqueta });

describe("normalizeCargaReviewFuentes", () => {
  it("devuelve null cuando la base no junta encuestas", () => {
    expect(normalizeCargaReviewFuentes(null)).toBeNull();
    expect(normalizeCargaReviewFuentes({})).toBeNull();
    expect(normalizeCargaReviewFuentes({ principal: null, fuentes: [] })).toBeNull();
  });

  it("acepta escalares en vector y data.frames por filas o por columnas", () => {
    const out = normalizeCargaReviewFuentes({
      fuentes: [{
        survey_id: ["123"],
        titulo: ["Telefónico"],
        n_emparejadas: [70],
        n_preguntas_base: "73",
        reordenada: [true],
        instrumento_distinto: false,
        sin_par_fuente: [{ variable: "p3", etiqueta: "Cod Pulso" }, { variable: "", etiqueta: "" }],
        sin_par_base: { variable: ["p9", "p10"], etiqueta: ["Edad", null] },
        n_opciones_sin_par: null,
      }],
    });
    expect(out?.fuentes[0]).toEqual({
      survey_id: "123",
      titulo: "Telefónico",
      n_emparejadas: 70,
      n_preguntas_base: 73,
      reordenada: true,
      instrumento_distinto: false,
      sin_par_fuente: [{ variable: "p3", etiqueta: "Cod Pulso" }],
      sin_par_base: [{ variable: "p9", etiqueta: "Edad" }, { variable: "p10", etiqueta: "" }],
      n_opciones_sin_par: 0,
      excluida: false,
      n_filas_excluidas: 0,
      ambiguas: [],
      consentimiento_sin_par: false,
      n_excluidas_consentimiento: 0,
    });
  });
});

describe("cargaReviewFuentesHallazgos", () => {
  it("una fuente sana y en orden tiene su tarjeta neutra, para poder ver sus preguntas", () => {
    const [h] = cargaReviewFuentesHallazgos({ principal: null, fuentes: [fuente({})] });
    expect(h.tono).toBe("info");
    expect(h.titulo).toBe("Telefónico · 73 de 74 preguntas emparejadas");
    expect(h.lineas).toEqual([]);
    expect(cargaReviewFuentesHallazgos(null)).toEqual([]);
  });

  it("una fuente solo reordenada es un dato neutro", () => {
    const [h] = cargaReviewFuentesHallazgos({ principal: null, fuentes: [fuente({ reordenada: true })] });
    expect(h.tono).toBe("info");
    expect(h.titulo).toBe("Telefónico · 73 de 74 preguntas emparejadas, en otro orden");
    expect(h.lineas).toEqual([]);
  });

  it("el titular da la cifra y el detalle dice qué no entró", () => {
    const [h] = cargaReviewFuentesHallazgos({
      principal: null,
      fuentes: [fuente({
        reordenada: true,
        sin_par_fuente: [q("Cod Pulso"), q("Celular del egresado"), q("Enumerador")],
      })],
    });
    expect(h.tono).toBe("pending");
    expect(h.titulo).toBe("Telefónico · 73 de 74 preguntas emparejadas");
    expect(h.lineas).toEqual([{ texto: "No entraron: Cod Pulso, Celular del egresado, Enumerador" }]);
  });

  it("junta los dos lados y las opciones, y acota con +N", () => {
    const [h] = cargaReviewFuentesHallazgos({
      principal: null,
      fuentes: [fuente({
        sin_par_fuente: [q("A"), q("B"), q("C"), q("", "p_d"), q("E")],
        sin_par_base: [q("Edad")],
        n_opciones_sin_par: 12,
      })],
    });
    expect(h.titulo).toBe("Telefónico · 73 de 74 preguntas emparejadas");
    expect(h.lineas).toEqual([
      { texto: "No entraron: A, B, C +2", completo: "No entraron: A, B, C, p_d, E" },
      { texto: "Sin respuesta en esta fuente: Edad" },
      { texto: "12 respuestas quedaron vacías por una opción que no existe en la lista." },
    ]);
  });

  it("solo opciones sin par: avisa con la cifra en el detalle", () => {
    const [h] = cargaReviewFuentesHallazgos({ principal: null, fuentes: [fuente({ n_opciones_sin_par: 1 })] });
    expect(h.tono).toBe("pending");
    expect(h.lineas).toEqual([{ texto: "1 respuesta quedó vacía por una opción que no existe en la lista." }]);
  });

  it("instrumento distinto va primero, como incompatibilidad, con la acción", () => {
    const hallazgos = cargaReviewFuentesHallazgos({
      principal: null,
      fuentes: [
        fuente({ titulo: "Web", reordenada: true }),
        fuente({ titulo: "", survey_id: "s9", instrumento_distinto: true, n_emparejadas: 30 }),
      ],
    });
    expect(hallazgos.map((h) => h.tono)).toEqual(["incompatible", "info"]);
    expect(hallazgos[0].titulo).toBe("Fuente 2 · es otro instrumento");
    expect(hallazgos[0].lineas.map((l) => l.texto)).toEqual([
      "Solo coinciden 30 de 74 preguntas con la base.",
      "Impórtala como base separada y relaciónala en Equivalencias.",
    ]);
  });

  it("una fuente rechazada dice que no entró y cuántas respuestas quedaron fuera", () => {
    const [h] = cargaReviewFuentesHallazgos({
      principal: null,
      fuentes: [fuente({ titulo: "Docentes", instrumento_distinto: true, excluida: true, n_emparejadas: 28, n_preguntas_base: 73, n_filas_excluidas: 48 })],
    });
    expect(h.tono).toBe("incompatible");
    expect(h.titulo).toBe("Docentes · no entró a la base");
    expect(h.lineas[0].texto).toBe("Solo coinciden 28 de 73 preguntas con la base. 48 respuestas quedaron fuera.");
  });

  it("las ambiguas y el consentimiento sin par se dicen en el detalle", () => {
    const [h] = cargaReviewFuentesHallazgos({
      principal: null,
      fuentes: [fuente({ ambiguas: [q("Servicio de salud", "p19_1")], consentimiento_sin_par: true })],
    });
    expect(h.tono).toBe("pending");
    expect(h.lineas.map((l) => l.texto)).toEqual([
      "Ambiguas, sin emparejar: Servicio de salud",
      "Su pregunta de consentimiento no calza con la de la base: sus respuestas completas entraron.",
    ]);
  });

  it("las opciones sin par de la encuesta principal se avisan aunque no haya fuentes", () => {
    const norm = normalizeCargaReviewFuentes({
      fuentes: [],
      principal: { opciones_sin_par: [{ variable: ["p5"], n: [3] }, { variable: "p9", n: 1 }], n_opciones_sin_par: 4 },
    });
    expect(norm?.principal?.n_opciones_sin_par).toBe(4);
    const [h] = cargaReviewFuentesHallazgos(norm);
    expect(h.tono).toBe("pending");
    expect(h.titulo).toBe("4 respuestas quedaron vacías por una opción que no existe en la lista");
    expect(h.lineas[0].texto).toBe("Por variable: p5 (3), p9 (1)");
  });
});
