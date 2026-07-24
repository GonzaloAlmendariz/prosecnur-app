import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EstudioPayload } from "../../api/client";
import BaseSelector from "./BaseSelector";

function multibaseStudy(): EstudioPayload {
  return {
    nombre: "Encuesta",
    n_bases: 2,
    max_bases: 16,
    bases: {
      hogares: {
        nombre: "hogares",
        xlsform_file_id: "xls-hogares",
        data_file_id: "data-hogares",
        data_ext: "sav",
        n_filas: 120,
        n_columnas: 24,
        added_at: "2026-07-24T00:00:00Z",
        source_alias: "Hogares",
      },
      personas: {
        nombre: "personas",
        xlsform_file_id: "xls-personas",
        data_file_id: "data-personas",
        data_ext: "sav",
        n_filas: 315,
        n_columnas: 18,
        added_at: "2026-07-24T00:00:00Z",
        source_alias: "Personas",
      },
    },
  };
}

describe("BaseSelector semantics", () => {
  it("exposes the active database as a pressed button group, not as tabs without a panel", () => {
    const html = renderToStaticMarkup(
      <BaseSelector
        estudio={multibaseStudy()}
        selected="hogares"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Base activa para validar"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain("aria-selected");
  });

  it("stays hidden when there is no database choice to make", () => {
    const estudio = multibaseStudy();
    estudio.n_bases = 1;
    estudio.bases = { hogares: estudio.bases.hogares };

    expect(renderToStaticMarkup(
      <BaseSelector
        estudio={estudio}
        selected="hogares"
        onChange={() => undefined}
      />,
    )).toBe("");
  });
});
