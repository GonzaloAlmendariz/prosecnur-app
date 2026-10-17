// El esquema de página responde a cada opción. Mata: un esquema decorativo que no cambia con las opciones.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PDF_DIALOG_STATE as D, type PdfDialogState } from "../shell/pdfExportPreference";
import { MaquetaPagina } from "./MaquetaPagina";

const html = (e: Partial<PdfDialogState>, hayMatrices = true) => renderToStaticMarkup(<MaquetaPagina estado={{ ...D, ...e }} hayMatrices={hayMatrices} />);
const recuadrosNumero = (h: string) => (h.match(/width="7" height="8"/g) ?? []).length;

describe("esquema de la primera página", () => {
  it("cada opción cambia el dibujo", () => {
    const base = html({});
    expect(html({ columns: 1 })).not.toBe(base);
    expect(html({ columns: "auto" })).not.toBe(base);
    expect(html({ matrixLayout: "column" })).not.toBe(base);
    expect(html({ defaultIntro: false })).not.toBe(base);
    expect(html({}, false)).not.toBe(base);
  });

  it("los recuadros de N.° aparecen sólo con el número de cuestionario", () => {
    expect(recuadrosNumero(html({ showQuestionnaireNumber: true }))).toBe(4);
    expect(recuadrosNumero(html({ showQuestionnaireNumber: false }))).toBe(0);
  });
});
