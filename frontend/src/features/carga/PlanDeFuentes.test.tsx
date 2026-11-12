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
const modeloSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/useModeloCarga.ts", import.meta.url)),
  "utf8",
);

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
    const start = modeloSource.indexOf("const materializedInputCount");
    const end = modeloSource.indexOf("return {", start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const countContract = modeloSource.slice(start, end);
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
});
