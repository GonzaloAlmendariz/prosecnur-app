import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");
const leer = (archivo: string) => fs.readFileSync(path.join(__dirname, "pestanas", archivo), "utf8");
const modelo = leer("useModeloCarga.ts");
const revisionPestana = leer("PestanaRevision.tsx");
const datosPestana = leer("HojaBaseCarga.tsx");
const pestanasTodas = fs.readdirSync(path.join(__dirname, "pestanas"))
  .filter((archivo) => /\.tsx?$/u.test(archivo) && !/\.test\./u.test(archivo))
  .map(leer)
  .join("\n");

function sourceBetween(start: string, end: string, desde: string = source): string {
  const startIndex = desde.indexOf(start);
  const endIndex = desde.indexOf(end, startIndex + start.length);

  expect(startIndex, `No se encontró el inicio del contrato: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `No se encontró el fin del contrato: ${end}`).toBeGreaterThan(startIndex);
  return desde.slice(startIndex, endIndex);
}

describe("CargaPage truthfulness contracts", () => {
  it("calcula la cobertura del rail con bases primarias y no con repeats derivados", () => {
    // El modelo (conteos y cobertura) vive en useModeloCarga; el contexto del
    // rail, en la página.
    const coverage = sourceBetween(
      "const cargaBaseOptions",
      "const cargaBaseSignature",
      modelo,
    );
    const readiness = sourceBetween(
      "const workspaceAllReady",
      "const topologyHasStudy",
      modelo,
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

  it("entrega solo bases primarias a los conteos de Revisión y al contexto de las pestañas", () => {
    // ADR 0142: Plan se fundió en Bases y su resumen de cobertura salió de la vista.
    expect.soft(source).toMatch(
      /const basesPrimarias = topologyBases\.map\(\(base\) => base\.nombre\);/,
    );
    expect.soft(source).toMatch(
      /<PestanaRevision[\s\S]*?basesPrimarias=\{topologyBases\.map\(/,
    );
    // P4b R4: la mesa de Revisión recibe las bases primarias para su selector y su resumen.
    expect.soft(revisionPestana).toMatch(
      /<MesaDeRevision[\s\S]*?basesPrimarias=\{basesPrimarias\}/,
    );
  });

  it("no habilita Datos si la base multibase seleccionada carece de respuestas", () => {
    const dataPane = datosPestana;

    expect.soft(dataPane).toMatch(
      /const activeBaseHasData = Boolean\(activeBase\?\.data_file_id\)/,
    );
    expect.soft(dataPane).toMatch(
      /const enabled = isMultiBase\s*\?\s*hasMultiBase && activeBaseHasData && !busy && !error/,
    );
  });

  it("no renderiza la franja CargaSuiteBar en ningún branch de Carga", () => {
    expect((source + pestanasTodas).match(/<CargaSuiteBar\b/g) ?? []).toHaveLength(0);
  });
});
