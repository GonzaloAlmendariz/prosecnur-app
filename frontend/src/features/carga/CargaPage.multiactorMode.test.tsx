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

function detectedModeStatusBlock(): string {
  const labelIndex = source.indexOf("Bases separadas por público");
  expect(labelIndex, "Falta el estado informativo del plan multiactor").toBeGreaterThan(-1);
  const prefix = source.slice(0, labelIndex);
  const statusIndex = Array.from(prefix.matchAll(/<div[^>]*role="status"[^>]*>/gu)).at(-1)?.index ?? -1;
  expect(statusIndex).toBeGreaterThan(-1);
  return source.slice(statusIndex, labelIndex);
}

describe("modo multiactor detectado en Carga", () => {
  it("degrada el workbench multibase a un único scroll de página en modo short", () => {
    expect(source).toContain("pulso-carga-workbench--multibase");
    expect(styles).toContain(':root[data-pulso-layout-mode="short"] .pulso-main--viewport .pulso-carga-frame.pulso-page-frame--scroll-panels .pulso-page-frame-body.pulso-page-frame-body--fill');
    expect(styles).toMatch(/pulso-carga-scrollarea\s*\{[\s\S]*?overflow:\s*visible;/u);
  });

  it("distingue el plan detectado del modo multibase activado por el usuario", () => {
    const countStart = source.indexOf("const plannedPublics");
    const countEnd = source.indexOf(";", countStart);
    expect(countStart).toBeGreaterThan(-1);
    const countExpression = source.slice(countStart, countEnd);
    expect(countExpression).toContain("processingSuggestions?.summary.actors_count");
    expect(countExpression).toContain("processingSuggestions?.groups.length");
    expect(source).toContain(
      "plannedPublics={!isMultiBase && plannedPublics > 1 ? plannedPublics : 0}",
    );
  });

  it("presenta el plan como status no interactivo, con conteo y criterio comprensibles", () => {
    const statusBlock = detectedModeStatusBlock();
    expect(statusBlock).toContain('role="status"');
    expect(statusBlock).not.toContain("<button");
    expect(statusBlock).not.toContain("<input");
    expect(statusBlock).not.toContain('role="switch"');

    expect(source).toContain("{plannedPublics} públicos detectados");
    expect(source).toMatch(
      /(?:las bases )?se crearán junt(?:as|os) al completar las asignaciones/iu,
    );
  });
});
