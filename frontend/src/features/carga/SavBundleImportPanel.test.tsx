import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { EstudioBase } from "../../api/client";
import { SavBundleImportPanel, savFirstReviewableEntryName } from "./SavBundleImportPanel";

const base: EstudioBase = {
  nombre: "ingenieria_civil",
  source_alias: "Ingeniería Civil",
  xlsform_file_id: "xls-civil",
  data_file_id: "data-civil",
  data_ext: "sav",
  n_filas: 120,
  n_columnas: 50,
  added_at: "2026-07-21T00:00:00Z",
};

describe("SavBundleImportPanel", () => {
  test("auto-opens the first non-blocked file with a review contract", () => {
    expect(savFirstReviewableEntryName([
      { entry_name: "blocked.sav", blocking: true, normalization_review: {} },
      { entry_name: "legacy.sav", blocking: false, normalization_review: null },
      { entry_name: "reviewable.sav", blocking: false, normalization_review: {} },
    ])).toBe("reviewable.sav");
  });

  test("starts in strict mode and explains the explicit compatibility alternative", () => {
    const html = renderToStaticMarkup(
      <SavBundleImportPanel bases={[base]} onImported={async () => undefined} />,
    );

    expect(html).toContain("Variables obligatorias");
    expect(html).toContain('checked="" value="strict"');
    expect(html).toContain("Bloquea si falta una variable esperada.");
    expect(html).toContain("Compatibilidad explícita");
    expect(html).toContain("Completa faltantes en blanco y conserva advertencias.");
    expect(html).toContain("Inspecciona el SAV o ZIP antes de aplicar.");
    expect(html).toContain('aria-label="Importar y normalizar SAV"');
    expect(html).toContain('aria-disabled="true" aria-describedby="sav-import-apply-reason"');
    expect(html).toContain('id="sav-import-apply-reason"');
    expect(html).toContain('accept=".sav,.zip,application/x-spss-sav,application/octet-stream,application/zip,application/x-zip-compressed"');
  });
});
