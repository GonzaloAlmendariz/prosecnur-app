import { describe, expect, test } from "vitest";
import { normalizeSmSugerenciasLogica } from "./xlsformSmSugerencias";

describe("normalizeSmSugerenciasLogica", () => {
  test("lee la sugerencia del consentimiento con escalares envueltos por R", () => {
    const r = normalizeSmSugerenciasLogica({
      ok: [true],
      survey_id: ["423593924"],
      logica_disponible_en_api: [false],
      aviso: ["SurveyMonkey no comparte la lógica de saltos por su API: el formulario se importa sin saltos."],
      sugerencias: [{
        tipo: ["fin_de_encuesta"],
        variable: ["p1"],
        etiqueta: ["¿Desea continuar con la encuesta?"],
        opciones_que_cortan: [{ codigo: ["2"], etiqueta: ["No"] }],
        motivo: ["Es la pregunta de consentimiento."],
      }],
    });
    expect(r.survey_id).toBe("423593924");
    expect(r.logica_disponible_en_api).toBe(false);
    expect(r.sugerencias).toEqual([{
      tipo: "fin_de_encuesta",
      variable: "p1",
      etiqueta: "¿Desea continuar con la encuesta?",
      opciones_que_cortan: [{ codigo: "2", etiqueta: "No" }],
      motivo: "Es la pregunta de consentimiento.",
    }]);
  });

  test("`{}` en lugar de lista vacía y payload nulo no rompen; el aviso nunca falta", () => {
    const vacio = normalizeSmSugerenciasLogica({ ok: true, sugerencias: {}, aviso: {} });
    expect(vacio.sugerencias).toEqual([]);
    expect(vacio.aviso).toMatch(/no comparte la lógica de saltos/);
    expect(normalizeSmSugerenciasLogica(null).sugerencias).toEqual([]);
  });

  test("descarta sugerencias sin variable u opciones, o de un tipo desconocido", () => {
    const r = normalizeSmSugerenciasLogica({
      sugerencias: [
        { tipo: "fin_de_encuesta", variable: "p1", opciones_que_cortan: {} },
        { tipo: "otra_cosa", variable: "p2", opciones_que_cortan: [{ codigo: "1", etiqueta: "No" }] },
        { tipo: "fin_de_encuesta", variable: "p3", opciones_que_cortan: { codigo: "2", etiqueta: "No" } },
      ],
    });
    expect(r.sugerencias.map((s) => s.variable)).toEqual(["p3"]);
  });
});
