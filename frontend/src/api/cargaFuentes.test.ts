import { describe, expect, it } from "vitest";
import { normalizeCargaFuentesEmparejamiento } from "./cargaFuentes";

describe("normalizeCargaFuentesEmparejamiento", () => {
  it("lee el contrato con escalares de largo uno y filas por filas", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      base_nombre: ["egresados"],
      equivalencias: { disponible: [false], motivo: ["El estudio tiene una sola base."] },
      fuentes: [{
        survey_id: ["123"],
        titulo: ["Telefónico"],
        estado: ["incorporada"],
        n_emparejadas: [2],
        n_preguntas_base: [3],
        n_filas_incorporadas: [40],
        n_filas_excluidas: [0],
        detalle_disponible: [true],
        filas: [
          { seccion: "Perfil", etiqueta: "¿Cuántos años tiene?", variable_base: "p4", variable_fuente: "p3", estado: "otro_nombre" },
          { seccion: "Perfil", etiqueta: "Género", variable_base: "p5", variable_fuente: "p5", estado: "emparejada" },
        ],
      }],
    });
    expect(out.base_nombre).toBe("egresados");
    expect(out.equivalencias).toEqual({ disponible: false, motivo: "El estudio tiene una sola base." });
    expect(out.fuentes).toHaveLength(1);
    expect(out.fuentes[0]).toMatchObject({
      survey_id: "123",
      titulo: "Telefónico",
      estado: "incorporada",
      n_emparejadas: 2,
      n_preguntas_base: 3,
      n_filas_incorporadas: 40,
      detalle_disponible: true,
    });
    expect(out.fuentes[0].filas.map((f) => f.estado)).toEqual(["otro_nombre", "emparejada"]);
  });

  it("acepta un data.frame serializado por columnas", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      fuentes: [{
        survey_id: "9",
        titulo: "Web",
        filas: {
          seccion: ["A", "Solo en la fuente"],
          etiqueta: ["Pregunta uno", "Cod Pulso"],
          variable_base: ["p1", null],
          variable_fuente: ["p1", "p2"],
          estado: ["emparejada", "no_entro"],
        },
      }],
    });
    expect(out.fuentes[0].filas).toEqual([
      { seccion: "A", enunciado: "", etiqueta: "Pregunta uno", variable_base: "p1", variable_fuente: "p1", estado: "emparejada" },
      { seccion: "Solo en la fuente", enunciado: "", etiqueta: "Cod Pulso", variable_base: "", variable_fuente: "p2", estado: "no_entro" },
    ]);
    // Sin la marca, el detalle cuenta como disponible porque trae filas.
    expect(out.fuentes[0].detalle_disponible).toBe(true);
  });

  it("un estado desconocido es «emparejada» solo con las dos variables; si no, se descarta", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      fuentes: [{
        survey_id: "1",
        titulo: "X",
        filas: [
          { etiqueta: "Con las dos", variable_base: "p1", variable_fuente: "q1", estado: "otra_cosa" },
          { etiqueta: "Solo base", variable_base: "p2", variable_fuente: "", estado: "otra_cosa" },
          { etiqueta: "Sin estado", variable_fuente: "q3" },
        ],
      }],
    });
    expect(out.fuentes[0].filas).toEqual([
      { seccion: "", enunciado: "", etiqueta: "Con las dos", variable_base: "p1", variable_fuente: "q1", estado: "emparejada" },
    ]);
  });

  it("estado de fuente desconocido se lee como incorporada; disponible borra el motivo", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      equivalencias: { disponible: true, motivo: "no debería verse" },
      fuentes: [
        { survey_id: "1", titulo: "A", estado: "rara", detalle_disponible: false },
        { survey_id: "2", titulo: "B", estado: "excluida", n_filas_excluidas: "12" },
        {},
        "basura",
      ],
    });
    expect(out.equivalencias).toEqual({ disponible: true, motivo: "" });
    expect(out.fuentes.map((f) => [f.survey_id, f.estado, f.detalle_disponible])).toEqual([
      ["1", "incorporada", false],
      ["2", "excluida", false],
    ]);
    expect(out.fuentes[1].n_filas_excluidas).toBe(12);
  });

  it("un payload vacío o roto no revienta", () => {
    for (const raw of [null, undefined, "x", 3, [], {}]) {
      const out = normalizeCargaFuentesEmparejamiento(raw);
      expect(out).toEqual({ base_nombre: null, equivalencias: { disponible: false, motivo: "" }, fuentes: [] });
    }
  });

  it("lee el enunciado de las filas de matriz; si falta queda vacío", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      fuentes: [{
        survey_id: "1",
        titulo: "X",
        filas: {
          seccion: ["Servicios", "Servicios", "Perfil"],
          enunciado: [["¿Ha utilizado los siguientes servicios?"], "¿Ha utilizado los siguientes servicios?", null],
          etiqueta: ["Servicio de salud", "Comunicación visual", "Edad"],
          variable_base: ["p11_1", "p11_2", "p4"],
          variable_fuente: ["p11_1", "p11_2", "p3"],
          estado: ["emparejada", "emparejada", "otro_nombre"],
        },
      }],
    });
    expect(out.fuentes[0].filas.map((f) => f.enunciado)).toEqual([
      "¿Ha utilizado los siguientes servicios?",
      "¿Ha utilizado los siguientes servicios?",
      "",
    ]);
    const sinCampo = normalizeCargaFuentesEmparejamiento({
      fuentes: [{ survey_id: "1", titulo: "X", filas: [{ etiqueta: "Edad", variable_base: "p4", variable_fuente: "p4", estado: "emparejada" }] }],
    });
    expect(sinCampo.fuentes[0].filas[0].enunciado).toBe("");
  });

  it("n_filas_incorporadas distingue cero de ausente", () => {
    const out = normalizeCargaFuentesEmparejamiento({
      fuentes: [
        { survey_id: "a", titulo: "A", n_filas_incorporadas: [0] },
        { survey_id: "b", titulo: "B", n_filas_incorporadas: 52 },
        { survey_id: "c", titulo: "C" },
      ],
    });
    expect(out.fuentes.map((f) => f.n_filas_incorporadas)).toEqual([0, 52, null]);
  });

  it("una fuente sola que R desenrolló como objeto se acepta", () => {
    const out = normalizeCargaFuentesEmparejamiento({ fuentes: { survey_id: "7", titulo: "Única", filas: [] } });
    expect(out.fuentes.map((f) => f.survey_id)).toEqual(["7"]);
  });
});
