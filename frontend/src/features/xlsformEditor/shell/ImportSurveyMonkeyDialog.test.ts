import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import {
  FinalImportReviewModal,
  ImportSurveyMonkeyDialog,
  shouldShowManualPageQuestionsInput,
  surveyMonkeyTokenUiState,
  visualPagesFromEntries,
  visualQuestionsFromPages,
} from "./ImportSurveyMonkeyDialog";

describe("FinalImportReviewModal", () => {
  test("describe el resultado como borrador y no como aprobación", () => {
    const markup = renderToStaticMarkup(createElement(FinalImportReviewModal, {
      surveyId: "123456789",
      sectionCount: 2,
      questionCount: 12,
      visualRuleCount: 1,
      advancedRuleCount: 0,
      overrideCount: 0,
      checked: false,
      submitting: false,
      onCheckedChange: vi.fn(),
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    }));

    expect(markup).toContain("borrador editable");
    expect(markup).toContain("no publica");
    expect(markup).toContain("no confirma");
    expect(markup).toContain('autofocus=""');
    expect(markup).not.toMatch(/aprobad[oa]/i);
  });
});

describe("ImportSurveyMonkeyDialog", () => {
  test("se renderiza por encima del chrome fijo del editor", () => {
    const markup = renderToStaticMarkup(createElement(ImportSurveyMonkeyDialog, {
      fileName: "",
      onCancel: vi.fn(),
      onComplete: vi.fn(),
    }));

    expect(markup).toContain("z-index:2300");
  });

  test("escapa de los contextos de apilado del editor mediante un portal", () => {
    const source = readFileSync(new URL("./ImportSurveyMonkeyDialog.tsx", import.meta.url), "utf8");

    expect(source).toContain("createPortal(dialog, document.body)");
  });
});

describe("surveyMonkeyTokenUiState", () => {
  test("muestra máscara de backend sin repoblar el input con texto plano", () => {
    const ui = surveyMonkeyTokenUiState({
      ok: true,
      has_token: true,
      masked_token: "sm_1...abcdef",
      persisted: true,
      ephemeral: false,
    }, "");

    expect(ui.inputValue).toBe("");
    expect(ui.hasUsableToken).toBe(true);
    expect(ui.displayMask).toBe("sm_1...abcdef");
    expect(ui.storageLabel).toBe("cifrado en este equipo");
  });
});

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
