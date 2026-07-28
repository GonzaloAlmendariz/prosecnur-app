import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./BasesPanel.tsx", import.meta.url)),
  "utf8",
);
const pageSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
const platformSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaPlatformImportPanel.tsx", import.meta.url)),
  "utf8",
);

function componentOpeningTag(component: string): string {
  const start = pageSource.indexOf(`<${component}`);
  const end = pageSource.indexOf(">", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return pageSource.slice(start, end);
}

describe("estrategia de Plan dentro de Fuentes", () => {
  it("activa una mesa vacía sin materializar ni revalidar archivos legacy", () => {
    const start = pageSource.indexOf("async function onEnableMultiBase");
    const end = pageSource.indexOf("\n  function onTopologyIntentChange", start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const activationHandler = pageSource.slice(start, end);
    expect(activationHandler).toContain("apiEstudioInit(");
    expect(activationHandler).not.toContain("apiEstudioFromSession(");
  });

  it("no cuenta archivos legacy sueltos como entradas de un plan multibase", () => {
    const start = pageSource.indexOf("const materializedInputCount");
    const end = pageSource.indexOf("const reviewHasIssues", start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const countContract = pageSource.slice(start, end);
    expect(countContract).toContain('topologyResolution.mode === "multi"');
    expect(countContract).toMatch(/topologyResolution\.mode\s*===\s*"multi"\s*\?\s*0/u);
  });

  it("la presenta como contexto bloqueado y no como un segundo selector", () => {
    const start = source.indexOf('aria-label="Forma de trabajar varias bases"');
    const end = source.indexOf('{strategy === "integrated"', start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const strategyBlock = source.slice(start, end);
    expect(strategyBlock).toContain('role="status"');
    expect(strategyBlock).not.toContain("<button");
    expect(strategyBlock).not.toContain("requestStrategyChange");
  });

  it("propaga plannedInputCount a las superficies multibase y de plataforma", () => {
    expect(componentOpeningTag("BasesPanel")).toContain(
      "plannedInputCount={plannedInputCount}",
    );
    expect(componentOpeningTag("CargaPlatformImportPanel")).toContain(
      "plannedInputCount={plannedInputCount}",
    );
    expect(platformSource).toContain("plannedInputCount");
    expect(platformSource).toMatch(/entradas|destinos|cupos|capacidad/iu);
  });

  it("usa el plan de entradas para capacidad integrada e independiente", () => {
    const integratedStart = source.indexOf('{strategy === "integrated"');
    const independentStart = source.indexOf('{strategy === "independent"', integratedStart);
    const separateStart = source.indexOf('{strategy === "separate"', independentStart);

    expect(integratedStart).toBeGreaterThan(-1);
    expect(independentStart).toBeGreaterThan(integratedStart);
    expect(separateStart).toBeGreaterThan(independentStart);
    expect(source.slice(integratedStart, independentStart)).toContain(
      "plannedInputCount={plannedInputCount}",
    );
    expect(source.slice(independentStart, separateStart)).toContain(
      "plannedInputCount={plannedInputCount}",
    );
  });

  it("declara N destinos separados y bloquea el importador single de Plataforma", () => {
    const start = pageSource.indexOf(
      '{sourceMode === "platform" && sourceStrategy === "separate"',
    );
    const end = pageSource.indexOf('{(sourceMode === "files"', start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const separatePlatform = pageSource.slice(start, end);
    expect(separatePlatform).toContain("plannedInputCount");
    expect(separatePlatform).toMatch(/entradas|destinos|slots|cupos/iu);
    expect(separatePlatform).not.toContain("<PlatformImportPanel");
  });
});
