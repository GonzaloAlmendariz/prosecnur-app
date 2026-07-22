import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { FormsLibrary, type FormsLibraryProps } from "./FormsLibrary";

function props(
  overrides: Partial<FormsLibraryProps> = {},
): FormsLibraryProps {
  return {
    forms: [],
    activeFormId: null,
    scope: null,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onNewBlank: vi.fn(),
    onImportXls: vi.fn(),
    onImportSurveyMonkey: vi.fn(),
    publications: {},
    publishingFormId: null,
    confirmingLogicFormId: null,
    publicationErrors: {},
    onPublish: vi.fn(),
    onConfirmLogic: vi.fn(),
    actorOptions: [],
    onActorChange: vi.fn(),
    ...overrides,
  };
}

describe("FormsLibrary", () => {
  test("the empty library renders only the real creation surface", () => {
    const markup = renderToStaticMarkup(<FormsLibrary {...props()} />);

    expect(markup).toContain("Crea tu primer formulario");
    expect(markup).not.toContain("pulso-xf-home-slot-ghost");
  });

  test("a form without publication data is shown as loading, not as a draft", () => {
    const markup = renderToStaticMarkup(
      <FormsLibrary
        {...props({
          forms: [{
            id: "form-docentes",
            name: "Encuesta docentes",
            savedAt: Date.now(),
            source: null,
          }],
        })}
      />,
    );

    expect(markup).toContain("Consultando revisión…");
    expect(markup).not.toContain(">Borrador<");
  });
});
