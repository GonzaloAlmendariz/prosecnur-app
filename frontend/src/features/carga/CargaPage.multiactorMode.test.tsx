import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
const styles = fs.readFileSync(
  fileURLToPath(new URL("./carga-v2.css", import.meta.url)),
  "utf8",
);

describe("origen multiactor deliberado en Carga", () => {
  it("degrada el workbench multibase a un único scroll de página en modo short", () => {
    expect(source).toContain("pulso-carga-workbench--multibase");
    expect(styles).toContain(':root[data-pulso-layout-mode="short"] .pulso-main--viewport .pulso-carga-frame.pulso-page-frame--scroll-panels .pulso-page-frame-body.pulso-page-frame-body--fill');
    expect(styles).toMatch(/pulso-carga-scrollarea\s*\{[\s\S]*?overflow:\s*visible;/u);
  });

  it("mantiene el aviso específico fuera del toolbar", () => {
    expect(source).not.toContain("plannedPublics");
    expect(source).not.toContain("Bases separadas por público");
    expect(source).not.toContain("públicos detectados con bases separadas planificadas");
    expect(styles).not.toContain("pulso-multibase-toggle.is-planned");
  });

  it("mantiene el batch de Monitoreo alcanzable al reabrir un estudio multibase", () => {
    const multiStart = source.indexOf("{isMultiBase && estudio && (");
    const multiEnd = source.indexOf("{isMultiBase && !estudio && (", multiStart);
    expect(multiStart).toBeGreaterThan(-1);
    expect(multiEnd).toBeGreaterThan(multiStart);
    const multiBlock = source.slice(multiStart, multiEnd);
    expect(source).toContain('aria-label="Origen de carga"');
    expect(source).toContain("const monitoringSourcePanel");
    expect(multiBlock).toContain('sourceMode === "monitoring" ? monitoringSourcePanel : null');
    expect(source).toContain("<ProcessingIntakePanel");
    expect(source).toContain("<AcreditacionBatchPanel");
  });

  it("monta asignaciones y creación conjunta solo tras consentir la revisión", () => {
    expect(source.match(/sourceMode === "monitoring" \? monitoringSourcePanel : null/g)).toHaveLength(2);
    expect(source.match(/<ProcessingIntakePanel/g)).toHaveLength(1);
    expect(source.match(/<AcreditacionBatchPanel/g)).toHaveLength(1);
    expect(source).toContain('monitoringReviewed && monitoringProfile === "multi_actor"');
    expect(source).toContain('onRovingKeyChange={(key) => setSourceMode(key as SourceMode)}');
  });
});
