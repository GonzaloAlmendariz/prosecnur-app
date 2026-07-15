import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_EXPORT_PREFERENCE,
  buildMatrixGroups,
  columnsLabel,
  exportButtonTitle,
  logicLanguageLabel,
  questionnaireNumberLabel,
} from "./pdfExportPreference";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";

function candidate(id: string, members: string[]): MatrixCandidate {
  return {
    id,
    sectionLabel: "Formulario",
    listName: "escala",
    count: members.length,
    memberNames: members,
    questionLabels: members.map((m) => m.toUpperCase()),
  };
}

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

describe("buildMatrixGroups", () => {
  const c1 = candidate("matrix_0", ["p1", "p2"]);
  const c2 = candidate("matrix_5", ["p4", "p5"]);

  it("candidato con tenor produce { members, tenor }", () => {
    const groups = buildMatrixGroups([c1], new Set(), {
      matrix_0: "  A continuación, indique…  ",
    });
    expect(groups).toEqual([
      { members: ["p1", "p2"], tenor: "A continuación, indique…" },
    ]);
  });

  it("candidato sin tenor (o solo espacios) produce { members } sin tenor", () => {
    const groups = buildMatrixGroups([c1, c2], new Set(), { matrix_5: "   " });
    expect(groups).toEqual([{ members: ["p1", "p2"] }, { members: ["p4", "p5"] }]);
    expect(groups[0]).not.toHaveProperty("tenor");
    expect(groups[1]).not.toHaveProperty("tenor");
  });

  it("candidato desactivado no aparece en la salida", () => {
    const groups = buildMatrixGroups([c1, c2], new Set(["matrix_0"]), {
      matrix_0: "no debería salir",
      matrix_5: "sí sale",
    });
    expect(groups).toEqual([{ members: ["p4", "p5"], tenor: "sí sale" }]);
  });

  it("sin candidatos devuelve []", () => {
    expect(buildMatrixGroups([], new Set(), {})).toEqual([]);
  });
});
