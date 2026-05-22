import { describe, expect, test } from "vitest";
import {
  shouldShowManualPageQuestionsInput,
  visualPagesFromEntries,
  visualQuestionsFromPages,
} from "./ImportSurveyMonkeyDialog";

describe("visualQuestionsFromPages", () => {
  test("incluye escalas SurveyMonkey de una sola fila como la variable XLSForm colapsada", () => {
    const questions = visualQuestionsFromPages([
      {
        id: "page-1",
        pageId: "1",
        questions: ["Q0017"],
        questionDetails: [
          {
            name: "Q0017",
            heading: "Satisfaccion general",
            family: "matrix",
            subtype: "rating",
            choices: [
              { code: "1", label: "Muy insatisfecho" },
              { code: "2", label: "Satisfecho" },
            ],
            children: [
              {
                name: "p17",
                heading: "Satisfaccion general",
                type: "select_one lst_p17",
                list_name: "lst_p17",
              },
            ],
          },
        ],
      },
    ]);

    expect(questions.map((q) => q.ref)).toEqual(["p17"]);
    expect(questions[0]?.label).toContain("p17");
    expect(questions[0]?.choices.map((choice) => choice.name)).toEqual(["1", "2"]);
  });

  test("no incluye select_multiple como origen de logica visual simple", () => {
    const questions = visualQuestionsFromPages([
      {
        id: "page-1",
        pageId: "1",
        questions: ["Q0007"],
        questionDetails: [
          {
            name: "Q0007",
            heading: "Servicios usados",
            family: "multiple_choice",
            subtype: null,
            choices: [
              { code: "1", label: "A" },
              { code: "2", label: "B" },
            ],
            children: [
              {
                name: "p7",
                heading: "Servicios usados",
                type: "select_multiple lst_p7",
                list_name: "lst_p7",
              },
            ],
          },
        ],
      },
    ]);

    expect(questions).toEqual([]);
  });
});

describe("visualPagesFromEntries", () => {
  test("expone preguntas XLSForm dentro de una pagina para saltos visuales", () => {
    const pages = visualPagesFromEntries([
      {
        id: "page-1",
        pageId: "12",
        title: "Atencion",
        questions: ["Q0017"],
        questionDetails: [
          {
            name: "Q0017",
            heading: "Satisfaccion general",
            family: "matrix",
            subtype: "rating",
            choices: [],
            children: [
              {
                name: "p17",
                heading: "Satisfaccion general",
                type: "select_one lst_p17",
                list_name: "lst_p17",
              },
            ],
          },
        ],
      },
    ]);

    expect(pages[0]?.pageId).toBe("12");
    expect(pages[0]?.questions).toEqual([
      { ref: "p17", label: "p17: Satisfaccion general" },
    ]);
  });
});

describe("shouldShowManualPageQuestionsInput", () => {
  test("oculta el campo editable para paginas traidas desde la API", () => {
    expect(shouldShowManualPageQuestionsInput({ questionDetails: [] })).toBe(false);
  });

  test("mantiene fallback avanzado en secciones manuales", () => {
    expect(shouldShowManualPageQuestionsInput({})).toBe(true);
  });
});
