import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_EXPORT_PREFERENCE,
  columnsLabel,
  exportButtonTitle,
  logicLanguageLabel,
  questionnaireNumberLabel,
} from "./pdfExportPreference";

describe("pdfExportPreference", () => {
  it("default es dos columnas + saltos + N.º de cuestionario ON (comportamiento histórico)", () => {
    expect(DEFAULT_PDF_EXPORT_PREFERENCE).toEqual({
      columns: 2,
      logicLanguage: "saltos",
      showQuestionnaireNumber: true,
    });
  });

  it("etiqueta de columnas", () => {
    expect(columnsLabel(1)).toBe("una columna");
    expect(columnsLabel(2)).toBe("dos columnas");
  });

  it("etiqueta de lenguaje de lógica", () => {
    expect(logicLanguageLabel("saltos")).toBe("saltos");
    expect(logicLanguageLabel("condiciones")).toBe("condiciones");
  });

  it("etiqueta del N.º de cuestionario", () => {
    expect(questionnaireNumberLabel(true)).toBe("con N.º de cuestionario");
    expect(questionnaireNumberLabel(false)).toBe("sin N.º de cuestionario");
  });

  it("title del botón combina las tres dimensiones", () => {
    expect(
      exportButtonTitle({ columns: 1, logicLanguage: "condiciones", showQuestionnaireNumber: false }),
    ).toBe("Exportar PDF (una columna, condiciones, sin N.º de cuestionario)");
    expect(exportButtonTitle(DEFAULT_PDF_EXPORT_PREFERENCE)).toBe(
      "Exportar PDF (dos columnas, saltos, con N.º de cuestionario)",
    );
  });
});
