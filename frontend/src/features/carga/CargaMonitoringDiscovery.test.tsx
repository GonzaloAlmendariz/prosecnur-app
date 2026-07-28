import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
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
    const consent = source.indexOf("Revisar Monitoreo");
    const intake = source.indexOf("<ProcessingIntakePanel");
    const batch = source.indexOf("<AcreditacionBatchPanel");

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
