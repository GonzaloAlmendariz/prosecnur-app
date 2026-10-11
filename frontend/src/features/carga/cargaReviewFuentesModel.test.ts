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
    ...partial,
  };
}

const q = (etiqueta: string, variable = "") => ({ variable, etiqueta });

describe("normalizeCargaReviewFuentes", () => {
  it("devuelve null cuando la base no junta encuestas", () => {
    expect(normalizeCargaReviewFuentes(null)).toBeNull();
    expect(normalizeCargaReviewFuentes({})).toBeNull();
    expect(normalizeCargaReviewFuentes({ fuentes: [] })).toBeNull();
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
    });
  });
});

describe("cargaReviewFuentesHallazgos", () => {
  it("una fuente sana y en orden no dice nada", () => {
    expect(cargaReviewFuentesHallazgos({ fuentes: [fuente({})] })).toEqual([]);
    expect(cargaReviewFuentesHallazgos(null)).toEqual([]);
  });

  it("una fuente solo reordenada es un dato neutro", () => {
    const [h] = cargaReviewFuentesHallazgos({ fuentes: [fuente({ reordenada: true })] });
    expect(h.tono).toBe("info");
    expect(h.titulo).toBe("Telefónico · 73 preguntas emparejadas por pregunta, en otro orden");
    expect(h.lineas).toEqual([]);
  });

  it("avisa lo que no entró con sus nombres, sin repetir rótulos innecesarios", () => {
    const [h] = cargaReviewFuentesHallazgos({
      fuentes: [fuente({
        reordenada: true,
        sin_par_fuente: [q("Cod Pulso"), q("Celular del egresado"), q("Enumerador")],
      })],
    });
    expect(h.tono).toBe("pending");
    expect(h.titulo).toBe("Telefónico · 3 preguntas no están en la base y no entraron");
    expect(h.lineas).toEqual([{ texto: "Cod Pulso, Celular del egresado, Enumerador" }]);
  });

  it("junta los dos lados y las opciones, y acota con +N", () => {
    const [h] = cargaReviewFuentesHallazgos({
      fuentes: [fuente({
        sin_par_fuente: [q("A"), q("B"), q("C"), q("", "p_d"), q("E")],
        sin_par_base: [q("Edad")],
        n_opciones_sin_par: 12,
      })],
    });
    expect(h.titulo).toBe(
      "Telefónico · 5 preguntas no están en la base y no entraron, y 1 pregunta de la base queda vacía para sus respuestas",
    );
    expect(h.lineas).toEqual([
      { texto: "No entraron: A, B, C +2", completo: "No entraron: A, B, C, p_d, E" },
      { texto: "Vacía: Edad" },
      { texto: "12 respuestas con una opción que no existe en la lista quedaron vacías." },
    ]);
  });

  it("solo opciones sin par: el título lo dice", () => {
    const [h] = cargaReviewFuentesHallazgos({ fuentes: [fuente({ n_opciones_sin_par: 1 })] });
    expect(h.titulo).toBe("Telefónico · 1 respuesta con una opción que no existe en la lista quedó vacía");
  });

  it("instrumento distinto va primero, como incompatibilidad, con la acción", () => {
    const hallazgos = cargaReviewFuentesHallazgos({
      fuentes: [
        fuente({ titulo: "Web", reordenada: true }),
        fuente({ titulo: "", survey_id: "s9", instrumento_distinto: true, n_emparejadas: 30 }),
      ],
    });
    expect(hallazgos.map((h) => h.tono)).toEqual(["incompatible", "info"]);
    expect(hallazgos[0].titulo).toBe("Fuente 2 · solo 30 de 74 preguntas coinciden con la base");
    expect(hallazgos[0].lineas[0].texto).toBe("Impórtala como base separada y relaciónala en Equivalencias.");
  });
});
