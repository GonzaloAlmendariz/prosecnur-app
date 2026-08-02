import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(new URL("../CalculoDistribucionTab.tsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("../calculoDistribucionModel.ts", import.meta.url), "utf8");
const deskSource = readFileSync(new URL("../../UniversidadDesk.tsx", import.meta.url), "utf8");
const chSource = readFileSync(new URL("../CalculoCursosHorarioFacultadTab.tsx", import.meta.url), "utf8");
const calculationCss = readFileSync(new URL("../calculo.css", import.meta.url), "utf8");
const distributionCss = readFileSync(new URL("../calculoDistribucion.css", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../../../../../lib/navegacion/catalogos/calcMuestra.ts", import.meta.url), "utf8");
const objectiveSource = readFileSync(new URL("../../aulas/AulasObjetivoTab.tsx", import.meta.url), "utf8");
const legacyDistributionSource = readFileSync(new URL("../../../motor/pestanas/TabDistribucion.tsx", import.meta.url), "utf8");

describe("contrato I19 de Distribución", () => {
  it("no importa calculadoras, stores ni perfiles legacy en la superficie R-owned", () => {
    const sources = `${componentSource}\n${modelSource}`;
    expect(sources).not.toMatch(/escenario1|afijacion|calcNPreview|calcEPreview|useMotorStore/);
    expect(sources).not.toMatch(/TabDistribucion|motor\.e1|usePerfilEfectivo|perfilDesde|\bperfil\s*=/);
    expect(sources).toMatch(/normalizeCalcMuestraDistribucionI19/);
  });

  it("UniversidadDesk monta la superficie I19 y ya no el consumidor TS legacy", () => {
    expect(deskSource).toContain("<CalculoDistribucionTab");
    expect(deskSource).toContain("currentFrameHash={aulasState?.frame?.frame_hash}");
    expect(deskSource).toMatch(/<CalculoCursosHorarioFacultadTab[\s\S]*currentFrameHash=\{aulasState\?\.frame\?\.frame_hash\}/);
    expect(deskSource).not.toMatch(/TabDistribucion|motor\.e1/);
  });

  it("publica el nombre nuevo sin cambiar id, target ni referencias al hogar", () => {
    expect(catalogSource).toContain('"calculo-ch-facultad", "Cursos-horario requeridos"');
    expect(catalogSource).toContain('targetId: "cmv2-local-calculo-ch-facultad"');
    expect(catalogSource).not.toContain('"calculo-ch-facultad", "Cursos-horario por facultad"');
    expect(chSource).not.toContain("Cursos-horario por facultad");
    expect(objectiveSource).toContain('aria-label="Cursos-horario requeridos"');
    expect(legacyDistributionSource).not.toContain("«Cursos-horario por facultad»");
  });

  it("CH y Distribución declaran geometría y readiness en markup", () => {
    expect(chSource).toContain('data-qa-geometry-group="calc-muestra/calculo-cursos-horario"');
    expect(chSource).toContain('data-qa-geometry-group="calc-muestra/cursos-horario-totales"');
    expect(chSource).toContain('data-audit-ready="false"');
    expect(chSource).toContain('data-audit-ready={resultadoDesactualizado ? "false" : "true"}');
    expect(componentSource).toContain('data-qa-geometry-group="calc-muestra/calculo-distribucion"');
    expect(componentSource).toContain("data-audit-ready={ready ? \"true\" : \"false\"}");
  });

  it("CH no recupera el scroll vertical manual", () => {
    expect(calculationCss).not.toMatch(/\.cmv2-ch-tabla-wrap\s*\{[^}]*(?:max-height|overflow\s*:)/s);
  });

  it("el owner CSS nuevo usa solo tokens y pesos tipográficos canónicos", () => {
    expect(distributionCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(distributionCss).not.toContain("--cmv2-");
    expect(distributionCss).not.toMatch(/font-weight:\s*\d/);
    expect(distributionCss).toContain("var(--pulso-surface)");
    expect(distributionCss).toContain("font-variant-numeric: tabular-nums");
  });
});
