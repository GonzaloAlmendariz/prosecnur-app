import { describe, expect, test } from "vitest";
import { smFechaCorta, smSurveyMetaParts } from "./surveyMonkeySurveySearch";

describe("smSurveyMetaParts (U5)", () => {
  test("distingue dos encuestas hermanas por respuestas, preguntas y fecha", () => {
    const estudiantes = smSurveyMetaParts({
      id: "1", title: "Estudiantes", nickname: null, date_modified: "2026-10-12T15:01:00",
      response_count: 307, question_count: 28,
    });
    const correo = smSurveyMetaParts({
      id: "2", title: "Estudiantes (correo)", nickname: null, date_modified: "2026-10-01",
      response_count: 0, question_count: 27,
    });
    expect(estudiantes).toEqual(["307 respuestas", "28 preguntas", "modificada 12 oct 2026"]);
    expect(correo).toEqual(["0 respuestas", "27 preguntas", "modificada 1 oct 2026"]);
  });

  test("un conteo que el catálogo no trae se omite, no se pinta como cero", () => {
    expect(smSurveyMetaParts({ id: "1", title: "x", nickname: null, date_modified: null })).toEqual([]);
    expect(smSurveyMetaParts({ id: "1", title: "x", nickname: null, date_modified: null, response_count: 1234, question_count: 1 }))
      .toEqual(["1,234 respuestas", "1 pregunta"]);
  });

  test("fecha corta sin depender del ICU", () => {
    expect(smFechaCorta("2026-01-05")).toBe("5 ene 2026");
    expect(smFechaCorta("no es fecha")).toBe("");
  });
});
