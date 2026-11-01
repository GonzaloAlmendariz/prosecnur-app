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
    mapa: [
      { numero: "1", pagina: 1, nombre: "p1", caja: { x: 0.06, y: 0.2, ancho: 0.4, alto: 0.1 } },
      { numero: "8.1", pagina: 2, nombre: "p8_1", caja: { x: 0.06, y: 0.3, ancho: 0.88, alto: 0.03 } },
      { numero: "9", pagina: null, nombre: "p9", caja: null },
    ],
  },
};

function render(previa: EstadoPrevia, extra: { bloqueElegido?: string | null; onElegirBloque?: (n: string) => void } = {}) {
  return renderToStaticMarkup(
    <PreviaImpreso
      {...extra}
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

  test("cada pregunta ubicada es un bloque sobre su página y el elegido queda marcado (DOC.3)", () => {
    const html = render(base, { bloqueElegido: "p8_1", onElegirBloque: () => undefined });
    expect(html.match(/pulso-xf-imp-word-bloque/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Pregunta 8.1: abrir sus ajustes de papel"');
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Pregunta 8\.1/);
    expect(html).toContain("left:6%;top:20%;width:40%;height:10%");
  });

  test("sin quien reciba la elección no se dibujan bloques", () => {
    expect(render(base)).not.toContain("pulso-xf-imp-word-bloque");
  });

  test("lo generado con la otra lectura no se muestra: queda el botón para generar esta", () => {
    const html = render({ ...base, lectura: "pdf" });
    expect(html).not.toContain("data-pagina=");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Previsualizar");
  });
});
