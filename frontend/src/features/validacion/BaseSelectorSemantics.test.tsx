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
  /**
   * El modelo cambió: antes era un grupo de botones segmentados, uno por base,
   * dentro de la banda del módulo —con dos bases ya ocupaba ~380px y cada base
   * nueva le comía ancho al rail—. Ahora es un disparador de ancho acotado que
   * abre el desglose compartido.
   *
   * Lo que este test sigue cuidando es lo mismo en espíritu: que sea un botón de
   * verdad, que diga cuál es la base activa, y que NO finja ser un tablist —un
   * `role="tab"` sin `tabpanel` es una promesa falsa al lector de pantalla.
   */
  it("es un botón que nombra la base activa, no un tablist sin panel", () => {
    const html = renderToStaticMarkup(
      <BaseSelector
        estudio={multibaseStudy()}
        selected="hogares"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('type="button"');
    // El nombre de la base activa se lee en el disparador, sin abrir nada.
    expect(html).toContain("Hogares");
    // Y cuántas hay en total, que es la otra mitad del contexto.
    expect(html).toContain("2");
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
