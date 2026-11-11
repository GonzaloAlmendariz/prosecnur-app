import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const pageSource = leer("./CargaPage.tsx");
const panelSource = leer("./pestanas/PanelMonitoreoCarga.tsx");
// La página y todo lo que sacó a pestanas/: ningún efecto de montaje consulta Monitoreo.
const pestanasDir = fileURLToPath(new URL("./pestanas/", import.meta.url));
const source = [
  pageSource,
  ...fs.readdirSync(pestanasDir)
    .filter((f) => /\.tsx?$/u.test(f) && !/\.test\./u.test(f))
    .map((f) => leer(`./pestanas/${f}`)),
].join("\n");
const componentSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaMonitoringDiscovery.tsx", import.meta.url)),
  "utf8",
);

function reviewHandler(): string {
  const start = componentSource.indexOf("async function reviewMonitoring");
  const end = componentSource.indexOf("\n  const sources", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return componentSource.slice(start, end);
}

describe("descubrimiento consentido de Monitoreo", () => {
  it("no consulta sugerencias ni handoff desde efectos de montaje", () => {
    expect(source).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,1200}apiCargaMonitoreoHandoffStatus\(/u,
    );
    expect(source).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,1200}apiEstudioProcessingSuggestions\(/u,
    );
  });

  it("expone una acción explícita antes de montar el intake de Monitoreo", () => {
    // La página fija el rótulo de la acción; el panel monta el descubrimiento
    // antes que el intake y el corte de acreditación.
    expect(pageSource).toContain('monitoringReviewActionLabel = "Revisar Monitoreo"');
    const consent = panelSource.indexOf("<CargaMonitoringDiscovery");
    const intake = panelSource.indexOf("<ProcessingIntakePanel");
    const batch = panelSource.indexOf("<AcreditacionBatchPanel");

    expect(consent).toBeGreaterThan(-1);
    expect(intake).toBeGreaterThan(consent);
    expect(batch).toBeGreaterThan(consent);
  });

  it("ejecuta exactamente los dos GET tras el click y falla cerrado si cualquiera rechaza", () => {
    const handler = reviewHandler();

    expect(handler.match(/apiCargaMonitoreoHandoffStatus\(/gu)).toHaveLength(1);
    expect(handler.match(/apiEstudioProcessingSuggestions\(/gu)).toHaveLength(1);
    expect(handler).toMatch(
      /handoffResult\.status\s*!==\s*"fulfilled"\s*\|\|\s*suggestionsResult\.status\s*!==\s*"fulfilled"/u,
    );
    const failureGuard = handler.indexOf("handoffResult.status !==");
    const callback = handler.indexOf("onDiscovered(next)");
    expect(failureGuard).toBeGreaterThan(-1);
    expect(callback).toBeGreaterThan(failureGuard);
    expect(handler.slice(failureGuard, callback)).toContain("setError(");
    expect(handler.slice(failureGuard, callback)).toContain("return;");
    expect(componentSource).toContain('role="alert"');
  });
});
