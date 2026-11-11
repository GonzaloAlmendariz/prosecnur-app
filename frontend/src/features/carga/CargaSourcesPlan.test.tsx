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
const variasSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/FuentesVariasBases.tsx", import.meta.url)),
  "utf8",
);
const unaSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/FuentesUnaBase.tsx", import.meta.url)),
  "utf8",
);
const importSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/usePlataformaCarga.tsx", import.meta.url)),
  "utf8",
);
const platformSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaPlatformImportPanel.tsx", import.meta.url)),
  "utf8",
);

function componentOpeningTag(fuente: string, component: string): string {
  const start = fuente.indexOf(`<${component}`);
  const end = fuente.indexOf(">", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return fuente.slice(start, end);
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

  it("propaga plannedInputCount a las superficies multibase y de plataforma", () => {
    expect(componentOpeningTag(variasSource, "BasesPanel")).toContain(
      "plannedInputCount={plannedInputCount}",
    );
    expect(componentOpeningTag(unaSource, "CargaPlatformImportPanel")).toContain(
      "plannedInputCount={plannedInputCount}",
    );
    expect(platformSource).toContain("plannedInputCount");
    expect(platformSource).toMatch(/entradas|destinos|cupos|capacidad|base nueva/iu);
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

  it('en "Bases separadas" Plataforma muestra el catálogo y cada import entra como una base nueva', () => {
    // Antes Plataforma bloqueaba este caso y mandaba a Manual (sólo archivos): no había cómo traer las encuestas de
    // SurveyMonkey de un estudio de acreditación (Arte y Diseño, 2026-10-11). Ahora el catálogo se muestra y el import
    // va por `import-separate` con un nombre corto por actor.
    // Con "Bases separadas" Fuentes es la lista de bases del estudio: el catálogo
    // de plataforma entra como origen de "Agregar base" y como catálogo de la
    // fuente que se suma a una base.
    expect(variasSource).toContain("renderCatalogo={() => panelPlataforma}");
    expect(variasSource).toMatch(/renderOrigen=\{\(o\) => \(o === "surveymonkey" \|\| o === "kobo" \? panelPlataforma/u);
    // L5b: el import va por el importador único (job en el store, cancelable).
    expect(importSource).toContain('importsPlataforma.lanzar("surveymonkey", "separada"');
    expect(importSource).toContain('importsPlataforma.lanzar("kobo", "separada"');
    expect(importSource).toMatch(/estrategia === "separate"\) \{\s*const baseName = nombreLibreDeBase\(nombreCortoDeEncuesta/);
  });
});
