import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas selected-block tabs semantics", () => {
  test("links Titulares and Reemplazos to the active table panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const sampleList = source.slice(
      source.indexOf('aria-label="Tipo de manzanas seleccionadas"'),
      source.indexOf('className="hojas-ruta-action-row hojas-ruta-sample-next"'),
    );

    expect(sampleList).toContain('id={hojasSampleListTabId("titulares")}');
    expect(sampleList).toContain('id={hojasSampleListTabId("reemplazos")}');
    expect(sampleList.match(/aria-controls=\{HOJAS_SAMPLE_LIST_PANEL_ID\}/g)).toHaveLength(2);
    expect(sampleList).toContain("id={HOJAS_SAMPLE_LIST_PANEL_ID}");
    expect(sampleList).toContain('role="tabpanel"');
    expect(sampleList).toContain("aria-labelledby={hojasSampleListTabId(sampleListTab)}");
    expect(sampleList).toContain("tabIndex={0}");
  });
});
