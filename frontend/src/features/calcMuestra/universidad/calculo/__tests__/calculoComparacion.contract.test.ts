import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const comparisonSource = readFileSync(new URL("../CalculoComparacionEscenarios.tsx", import.meta.url), "utf8");
const comparisonCss = readFileSync(new URL("../calculoComparacionEscenarios.css", import.meta.url), "utf8");
const distributionSource = readFileSync(new URL("../CalculoDistribucionTab.tsx", import.meta.url), "utf8");
const normalizerSource = readFileSync(new URL("../../../../../api/calcMuestraComparacionI20.ts", import.meta.url), "utf8");

describe("contrato I20 P1 frente a P2", () => {
  it("absorbe el selector I19 y monta el comparador antes del detalle", () => {
    expect(distributionSource).toContain("<CalculoComparacionEscenarios");
    expect(distributionSource.indexOf("<CalculoComparacionEscenarios")).toBeLessThan(
      distributionSource.indexOf('className="cmv2-dist-toolbar"'),
    );
    expect(distributionSource).not.toContain("function ScenarioSelector");
    expect(distributionSource).not.toContain('role="radiogroup"');
    expect(comparisonSource.match(/role="radiogroup"/g)).toHaveLength(1);
    expect(comparisonSource).toContain('data-detail-scenario="e1"');
    expect(comparisonSource).toContain('onClick={() => onEscenario("e1")}');
    expect(comparisonSource).toContain('data-detail-scenario="e2"');
    expect(comparisonSource).toContain('onClick={() => onEscenario("e2")}');
  });

  it("mantiene el owner I19 sin crecimiento neto", () => {
    expect(distributionSource.split("\n").length).toBeLessThanOrEqual(372);
  });

  it("presenta solo valores y deltas recibidos del owner R", () => {
    expect(comparisonSource).toContain("normalizeCalcMuestraComparacionI20");
    expect(comparisonSource).toContain("deltas_p2_minus_p1.values.sample_n");
    expect(comparisonSource).toContain("deltas_p2_minus_p1.values.ch_base_required");
    expect(comparisonSource).toContain("deltas_p2_minus_p1.values.ch_reserve_policy_dependent");
    expect(comparisonSource).toContain("deltas_p2_minus_p1.values.ch_total_operational");
    expect(comparisonSource).not.toMatch(/sample_n\s*-\s*|base_required\s*-\s*|reserve_required\s*-\s*|total_operational\s*-\s*/);
    expect(normalizerSource).toContain('"calc_muestra_comparacion_escenarios_v1"');
    expect(normalizerSource).toContain('raw.owner !== "engine_r"');
    expect(normalizerSource).not.toMatch(/calcNPreview|calcEPreview|useMotorStore|TabDistribucion/);
  });

  it("mantiene copy neutral y sin claims prohibidos", () => {
    const copy = `${comparisonSource}\n${distributionSource}`.toLocaleLowerCase("es-PE");
    [
      "mejor",
      "gana",
      "cuesta precisión",
      "ahorra reservas",
      "margen por sexo",
      "observada",
      "precision_delta",
    ].forEach((forbidden) => expect(copy).not.toContain(forbidden));
  });

  it("declara columnas iguales, apilado compacto y ningún dueño de scroll vertical", () => {
    expect(comparisonSource).toContain('data-qa-geometry-contract="equal"');
    expect(comparisonSource).toContain('data-stack-order="p1-p2-delta"');
    expect(comparisonCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(comparisonCss).toContain("@media (max-width: 1100px)");
    expect(comparisonCss).toContain('.cmv2-compare-pair [data-scenario="p1"]');
    expect(comparisonCss).toContain('.cmv2-compare-pair [data-scenario="p2"]');
    expect(comparisonCss).not.toMatch(/(?:max-height|overflow-y|overflow:\s*(?:auto|scroll))/);
  });

  it("usa únicamente tokens y pesos tipográficos canónicos", () => {
    expect(comparisonCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(comparisonCss).not.toContain("--cmv2-");
    expect(comparisonCss).not.toMatch(/font-weight:\s*\d/);
    expect(comparisonCss).toContain("var(--pulso-surface)");
    expect(comparisonCss).toContain("font-variant-numeric: tabular-nums");
  });
});
