// L36 · DOC.2 — la previa se lee como PDF o como las páginas reales del Word, y no muestra la lectura que no se generó.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DEFAULT_PDF_DIALOG_STATE } from "../shell/pdfExportPreference";
import { PreviaImpreso } from "./PreviaImpreso";
import type { EstadoPrevia } from "./storePrevia";

const base: EstadoPrevia = {
  formId: "f1", fase: "lista", detalle: "", url: null, cifras: { paginas: 2, preguntas: 9 }, firma: "x", workbook: null,
  error: "", lectura: "word", lecturaGenerada: "word",
  word: {
    paginas: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
    mapa: [{ numero: "1", pagina: 1 }, { numero: "8.1", pagina: 2 }, { numero: "9", pagina: null }],
  },
};

function render(previa: EstadoPrevia) {
  return renderToStaticMarkup(
    <PreviaImpreso
      previa={previa} vieja={false} motivo={null} onGenerar={() => undefined} onLectura={() => undefined}
      estado={{ ...DEFAULT_PDF_DIALOG_STATE, matrices: {} }} hayMatrices={false} pagina={null}
    />,
  );
}

describe("PreviaImpreso · páginas del Word", () => {
  test("dibuja cada página con su número y ofrece ir a una pregunta ubicada", () => {
    const html = render(base);
    expect(html.match(/data-pagina="/g)).toHaveLength(2);
    expect(html).toContain("Página 1 de 2 del Word");
    expect(html).toContain("Ir a la pregunta");
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("<iframe");
  });

  test("lo generado con la otra lectura no se muestra: queda el botón para generar esta", () => {
    const html = render({ ...base, lectura: "pdf" });
    expect(html).not.toContain("data-pagina=");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Previsualizar");
  });
});
