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
  test("el marco no cambia entre biblioteca vacía y poblada", () => {
    // La definición del homepage único: encabezado, grilla y pie son los
    // mismos con 0 o con N formularios; lo único que cambia es qué celdas hay
    // dentro de la grilla. Antes el vacío traía un hero a fila completa, un
    // pie expandido y un diagrama de cuatro pasos, así que crear el primer
    // formulario reconstruía la pantalla en vez de agregarle una celda.
    const vacia = renderToStaticMarkup(<FormsLibrary {...props()} />);
    const poblada = renderToStaticMarkup(
      <FormsLibrary
        {...props({
          forms: [{ id: "form-1", name: "Encuesta docentes", savedAt: Date.now(), source: null }],
        })}
      />,
    );

    for (const markup of [vacia, poblada]) {
      // Mismo encabezado, mismo pie, misma celda de creación.
      expect(markup).toContain("Espacio de formularios");
      expect(markup).toContain("Cómo funciona");
      expect(markup).toContain("pulso-xf-home-add--tile");
      expect(markup).toContain("Origen, lógica y público preparan una revisión estable");
      // Nada de hero, diagrama ni slots fantasma.
      expect(markup).not.toContain("pulso-xf-home-add--hero");
      expect(markup).not.toContain("pulso-hub-flow");
      expect(markup).not.toContain("pulso-xf-home-slot-ghost");
      expect(markup).not.toContain("Crea tu primer formulario");
    }
    // Y la diferencia real: la tarjeta del formulario.
    expect(vacia).not.toContain("Encuesta docentes");
    expect(poblada).toContain("Encuesta docentes");
  });

  test("la clase welcome ya no se emite en ningún estado", () => {
    // No tenía ninguna regla CSS asociada: se aplicaba y se testeaba sin hacer
    // nada, y sostenía la idea de que había dos homepages.
    const estados = [
      props(),
      props({ loading: true }),
      props({ loadFailed: true, onRetryLoad: vi.fn() }),
      props({ forms: [{ id: "f", name: "F", savedAt: Date.now(), source: null }] }),
    ];
    for (const estado of estados) {
      expect(renderToStaticMarkup(<FormsLibrary {...estado} />))
        .not.toContain("pulso-xf-home--welcome");
    }
  });

  test("mientras carga no afirma que la biblioteca está vacía", () => {
    // En carga el marco es el mismo que después —encabezado y grilla— y las
    // celdas son placeholders. Nunca se afirma el vacío antes de saberlo.
    const markup = renderToStaticMarkup(
      <FormsLibrary {...props({ loading: true })} />,
    );

    expect(markup).toContain("Espacio de formularios");
    expect(markup).toContain("pulso-xf-home-slot-skeleton");
    expect(markup).not.toContain("Cómo funciona");
    expect(markup).toContain('aria-busy="true"');
  });

  test("el QA visual no considera lista la superficie en carga", () => {
    const loading = renderToStaticMarkup(<FormsLibrary {...props({ loading: true })} />);
    const ready = renderToStaticMarkup(<FormsLibrary {...props()} />);

    expect(loading).toContain('data-audit-ready="false"');
    expect(ready).toContain('data-audit-ready="true"');
  });

  test("con el índice caído y sin copia local no afirma que no hay formularios", () => {
    // "No pudimos leer" y "no tienes ninguno" son cosas distintas: no podemos
    // invitar a crear el primero delante de un proyecto que quizá ya tiene
    // seis, sin haber podido leerlo.
    const markup = renderToStaticMarkup(
      <FormsLibrary {...props({ loadFailed: true, onRetryLoad: vi.fn() })} />,
    );

    expect(markup).toMatch(/no pudimos leer la biblioteca/i);
    expect(markup).toContain("Reintentar");
  });

  test("con formularios locales el fallo se reporta sin ocultarlos", () => {
    const markup = renderToStaticMarkup(
      <FormsLibrary
        {...props({
          loadFailed: true,
          forms: [{ id: "form-1", name: "Encuesta docentes", savedAt: Date.now(), source: null }],
        })}
      />,
    );

    expect(markup).toContain("Encuesta docentes");
    expect(markup).toMatch(/guardados en este equipo/i);
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
