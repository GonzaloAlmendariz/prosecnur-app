import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { EstudioBase } from "../../api/estudio";
import { InstrumentRevisionBindingNotice } from "./InstrumentRevisionBindingNotice";

function base(overrides: Partial<EstudioBase> = {}): EstudioBase {
  return {
    nombre: "default",
    xlsform_file_id: "file-x",
    data_file_id: "file-d",
    data_ext: "xlsx",
    n_filas: 100,
    n_columnas: 20,
    added_at: "2026-08-08T12:00:00Z",
    ...overrides,
  } as EstudioBase;
}

describe("InstrumentRevisionBindingNotice", () => {
  test("lee el estado suelto, que es la única fuente en un estudio de una base", () => {
    // CargaPage solo consulta /api/estudio en modo multibase, así que en un
    // estudio de una sola base —justo donde este aviso hace falta— no hay
    // objeto `base` que pasarle. El estado llega por `session/state`.
    const markup = renderToStaticMarkup(
      <InstrumentRevisionBindingNotice binding="matched" />,
    );

    expect(markup).toContain("is-ok");
    expect(markup).toMatch(/revisión publicada en el Editor/);
  });

  test("el estado suelto tiene precedencia sobre la base", () => {
    const markup = renderToStaticMarkup(
      <InstrumentRevisionBindingNotice
        binding="no_match"
        base={base({ instrument_revision_binding: "matched" })}
      />,
    );

    expect(markup).toContain("is-warn");
  });

  test("calla cuando el proyecto no publica revisiones", () => {
    // Un proyecto que no usa el Editor no tiene nada que explicar; el aviso
    // sería ruido en la tarjeta del formulario.
    expect(renderToStaticMarkup(
      <InstrumentRevisionBindingNotice base={base({ instrument_revision_binding: "none_published" })} />,
    )).toBe("");
    expect(renderToStaticMarkup(
      <InstrumentRevisionBindingNotice base={base()} />,
    )).toBe("");
    expect(renderToStaticMarkup(
      <InstrumentRevisionBindingNotice base={null} />,
    )).toBe("");
  });

  test("confirma el enlace cuando el instrumento es el publicado", () => {
    const markup = renderToStaticMarkup(
      <InstrumentRevisionBindingNotice
        base={base({ instrument_revision_binding: "matched", instrument_revision_id: "rev-1" })}
      />,
    );

    expect(markup).toContain("is-ok");
    expect(markup).toMatch(/revisión publicada en el Editor/);
  });

  test("explica el caso que antes era invisible: hay revisiones y ninguna calza", () => {
    const markup = renderToStaticMarkup(
      <InstrumentRevisionBindingNotice base={base({ instrument_revision_binding: "no_match" })} />,
    );

    expect(markup).toContain("is-warn");
    expect(markup).toMatch(/no coincide con ninguna revisión publicada/i);
    expect(markup).toMatch(/exporta el instrumento desde el editor/i);
  });

  test("un XLSForm ilegible se distingue de uno que simplemente no calza", () => {
    const markup = renderToStaticMarkup(
      <InstrumentRevisionBindingNotice base={base({ instrument_revision_binding: "unreadable" })} />,
    );

    expect(markup).toContain("is-warn");
    expect(markup).toMatch(/no pudimos leer este archivo/i);
  });
});
