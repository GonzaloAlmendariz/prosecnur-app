import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CargaPlanOverview } from "./CargaPlanOverview";
import { resolveCargaTopology } from "./CargaTopologyModel";

function readSibling(name: string) {
  const file = fileURLToPath(new URL(name, import.meta.url));
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const pageSource = readSibling("./CargaPage.tsx");
const planSource = readSibling("./CargaPlanOverview.tsx");
const reviewSource = readSibling("./CargaReviewSummary.tsx");
const structureSource = readSibling("./CargaStructureWorkbench.tsx");

const emptyTopology = resolveCargaTopology({
  intent: null,
  hasStudy: false,
  baseCount: 0,
  hasInstrument: false,
  hasData: false,
  processingMode: null,
  integratedBaseCount: 0,
});

describe("superficies conceptuales de Carga", () => {
  it("separa en Plan la decisión de topología de la cobertura de bases", () => {
    expect(pageSource.includes('from "./CargaPlanOverview"')).toBe(true);
    expect(pageSource.includes("<CargaPlanOverview")).toBe(true);
    expect(planSource.includes('data-carga-surface="plan"')).toBe(true);
    expect(planSource.includes('data-carga-plan-region="topology"')).toBe(true);
    expect(planSource.includes('data-carga-plan-region="coverage"')).toBe(true);
  });

  it("no presenta una base virtual como decisión confirmada en el estado vacío", () => {
    const html = renderToStaticMarkup(
      <CargaPlanOverview
        topology={emptyTopology}
        bases={[]}
        hasInstrument={false}
        hasData={false}
        pendingChoiceMapping={false}
        allReady={false}
      />,
    );

    expect(html).toContain("Topología por definir");
    expect(html).toContain("<dt>Bases</dt><dd>0</dd>");
    expect(html).toContain("<dt>Formularios</dt><dd>—</dd>");
    expect(html).toContain("Aún no hay una base definida");
    expect(html).not.toContain("Una base de análisis");
  });

  it("rotula como hermanas independientes el estudio materializado por separado", () => {
    const topology = resolveCargaTopology({
      intent: null,
      hasStudy: true,
      baseCount: 2,
      hasInstrument: true,
      hasData: true,
      processingMode: "independent_siblings",
      integratedBaseCount: 0,
    });
    const html = renderToStaticMarkup(
      <CargaPlanOverview
        topology={topology}
        bases={[
          {
            nombre: "Encuesta urbana",
            xlsform_file_id: "form-1",
            data_file_id: "data-1",
            data_ext: "csv",
            n_filas: 120,
            n_columnas: 18,
            added_at: "2026-07-25T00:00:00Z",
          },
          {
            nombre: "Encuesta rural",
            xlsform_file_id: "form-2",
            data_file_id: "data-2",
            data_ext: "csv",
            n_filas: 80,
            n_columnas: 18,
            added_at: "2026-07-25T00:00:00Z",
          },
        ]}
        hasInstrument
        hasData
        pendingChoiceMapping={false}
        allReady
      />,
    );

    expect(html).toMatch(/hermanas independientes/iu);
    expect(html).toContain("<dt>Bases</dt><dd>2</dd>");
  });

  it("usa en Revisión un resumen compacto en lugar del tablero completo de Plan", () => {
    expect(pageSource.includes('from "./CargaReviewSummary"')).toBe(true);
    expect(pageSource.includes("<CargaReviewSummary")).toBe(true);
    expect(reviewSource.includes('data-carga-surface="review"')).toBe(true);
    expect(reviewSource.includes("CargaReadinessBoard")).toBe(false);
  });

  it("presenta Secciones y Preguntas como vistas excluyentes y accesibles", () => {
    expect(pageSource.includes('from "./CargaStructureWorkbench"')).toBe(true);
    expect(pageSource.includes("<CargaStructureWorkbench")).toBe(true);
    expect(structureSource.includes('data-carga-surface="structure"')).toBe(true);
    expect(structureSource.includes('role="tablist"')).toBe(true);
    expect(structureSource.includes('aria-label="Vista del instrumento"')).toBe(true);
    expect(
      /(?:activeView|activeMode)\s*===\s*"sections"[\s\S]*?<SeccionesPanel[\s\S]*?:[\s\S]*?<PreguntasPanel/u.test(
        structureSource,
      ),
    ).toBe(true);
  });

  it("omite el selector redundante con una base y lo conserva con varias", () => {
    expect(
      /baseOptions\.length\s*>\s*1\s*&&\s*\([\s\S]{0,500}?pulso-carga-base-picker/u.test(
        pageSource,
      ),
    ).toBe(true);
  });
});
