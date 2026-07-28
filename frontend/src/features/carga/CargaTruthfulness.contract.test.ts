import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `No se encontró el inicio del contrato: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `No se encontró el fin del contrato: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("CargaPage truthfulness contracts", () => {
  it("calcula la cobertura del rail con bases primarias y no con repeats derivados", () => {
    const coverage = sourceBetween(
      "const cargaBaseOptions",
      "const cargaBaseSignature",
    );
    const readiness = sourceBetween(
      "const workspaceAllReady",
      "const topologyHasStudy",
    );
    const workspaceContext = sourceBetween(
      "const workspaceContext",
      "const activeCargaTab",
    );

    expect.soft(coverage).toMatch(
      /const multiBaseInstrumentCount = topologyBases\.filter/,
    );
    expect.soft(coverage).toMatch(
      /const multiBaseDataCount = topologyBases\.filter/,
    );
    expect.soft(readiness).toMatch(
      /const workspaceAllReady = isMultiBase[\s\S]*?topologyBases\.length > 0[\s\S]*?multiBaseInstrumentCount === topologyBases\.length[\s\S]*?multiBaseDataCount === topologyBases\.length/,
    );
    expect.soft(workspaceContext).toMatch(
      /hasBase:\s*isMultiBase\s*\?\s*topologyBases\.length > 0/,
    );
    expect.soft(workspaceContext).toMatch(
      /baseCount:\s*isMultiBase\s*\?\s*topologyBases\.length/,
    );
  });

  it("entrega solo bases primarias a los conteos de Plan y Revisión", () => {
    const plan = sourceBetween(
      'activeCargaTab === "plan" ? (',
      ') : activeCargaTab === "fuentes" ? (',
    );
    const review = sourceBetween(
      ') : activeCargaTab === "revision" ? (',
      ') : activeCargaTab === "estructura" ? (',
    );

    expect.soft(plan).toMatch(
      /<CargaPlanOverview[\s\S]*?bases=\{topologyBases\}/,
    );
    expect.soft(review).toMatch(
      /<CargaReviewSummary[\s\S]*?bases=\{topologyBases\.length\}/,
    );
  });

  it("no habilita Datos si la base multibase seleccionada carece de respuestas", () => {
    const dataPane = sourceBetween(
      "function CargaBaseSheetPane",
      "function cargaBaseLabel",
    );

    expect.soft(dataPane).toMatch(
      /const activeBaseHasData = Boolean\(activeBase\?\.data_file_id\)/,
    );
    expect.soft(dataPane).toMatch(
      /const enabled = isMultiBase\s*\?\s*hasMultiBase && activeBaseHasData && !busy && !error/,
    );
  });

  it("no renderiza la franja CargaSuiteBar en ningún branch de Carga", () => {
    expect(source.match(/<CargaSuiteBar\b/g) ?? []).toHaveLength(0);
  });
});
