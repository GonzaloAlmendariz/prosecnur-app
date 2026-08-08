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

  test("mientras carga no afirma que la biblioteca está vacía", () => {
    // El doble homepage nacía acá: con localStorage frío el hub se pintaba
    // primero como "welcome" —hero de creación y diagrama de flujo— y un
    // instante después como biblioteca poblada con las tarjetas del .pulso.
    // En carga el marco debe ser el mismo que después: encabezado y grilla.
    const markup = renderToStaticMarkup(
      <FormsLibrary {...props({ loading: true })} />,
    );

    expect(markup).toContain("Espacio de formularios");
    expect(markup).toContain("pulso-xf-home-slot-skeleton");
    expect(markup).not.toContain("pulso-xf-home--welcome");
    expect(markup).not.toContain("Crea tu primer formulario");
    expect(markup).not.toContain("Cómo funciona");
    expect(markup).toContain('aria-busy="true"');
  });

  test("el QA visual no considera lista la superficie en carga", () => {
    const loading = renderToStaticMarkup(<FormsLibrary {...props({ loading: true })} />);
    const ready = renderToStaticMarkup(<FormsLibrary {...props()} />);

    expect(loading).toContain('data-audit-ready="false"');
    expect(ready).toContain('data-audit-ready="true"');
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
