import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../types";
import { buildXlsformIndex } from "./buildIndex";
import { buildDiagnostics } from "./diagnostics";

function workbookFromSurvey(rows: string[][]): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label"],
      rows,
    },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [] },
    settings: {
      name: "settings",
      columns: ["form_title", "form_id", "version", "default_language"],
      rows: [["Demo", "demo", "1", "es"]],
    },
  };
}

describe("buildDiagnostics — estructura de secciones", () => {
  test("una sección anidada dentro de otra genera un aviso informativo", () => {
    const workbook = workbookFromSurvey([
      ["begin_group", "externa", "Sección externa"],
      ["begin_group", "interna", "Sección interna"],
      ["text", "campo", "Un campo"],
      ["end_group", "", ""],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const nested = diagnostics.find((d) => d.id.startsWith("nested-section-"));
    expect(nested).toBeTruthy();
    expect(nested?.level).toBe("info");
    expect(nested?.title).toContain("Sección interna");
    expect(nested?.title).toContain("Sección externa");
  });

  test("dos secciones al mismo nivel (raíz) NO generan aviso de anidamiento", () => {
    const workbook = workbookFromSurvey([
      ["begin_group", "a", "Sección A"],
      ["text", "c1", "Campo 1"],
      ["end_group", "", ""],
      ["begin_group", "b", "Sección B"],
      ["text", "c2", "Campo 2"],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    expect(diagnostics.some((d) => d.id.startsWith("nested-section-"))).toBe(false);
  });

  test("una sección abierta sin cierre genera aviso de sección abierta", () => {
    // Escenario del desacople abrir/cerrar: un begin_group sin su end.
    const workbook = workbookFromSurvey([
      ["begin_group", "abierta", "Sección abierta"],
      ["text", "c1", "Campo 1"],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const unclosed = diagnostics.find((d) => d.id.startsWith("unclosed-"));
    expect(unclosed).toBeTruthy();
    expect(unclosed?.level).toBe("warn");
    expect(unclosed?.title).toContain("Sección abierta");
  });

  test("un cierre sin apertura previa genera aviso de cierre suelto", () => {
    const workbook = workbookFromSurvey([
      ["text", "c1", "Campo 1"],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const unmatched = diagnostics.find((d) => d.id.startsWith("unmatched-end-"));
    expect(unmatched).toBeTruthy();
    expect(unmatched?.level).toBe("warn");
  });
});
