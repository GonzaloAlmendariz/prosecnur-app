import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("../DefFuentesConsistenciaTab.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../fuentesConsistencia.css", import.meta.url), "utf8");

describe("Fuentes + Consistencia · contrato geométrico D10", () => {
  it("declara una sola composición en flujo de documento", () => {
    expect(component).toContain('data-qa-geometry-group="calc-muestra/fuentes-consistencia"');
    expect(component).toContain('data-qa-geometry-contract="intrinsic"');
    expect(component).toContain("data-qa-geometry-member");
    expect(component).toContain("<DefBasesTab");
    expect(component).toContain("<MarcoConsistenciaTab");
    expect(component).toContain('id="cmv2-local-def-consistencia"');
    expect(component).toContain("scrollIntoView");
  });

  it("no introduce un segundo dueño vertical ni una altura que encierre Consistencia", () => {
    expect(css).not.toMatch(/overflow-y\s*:/);
    expect(css).not.toMatch(/max-height\s*:/);
    expect(css).not.toMatch(/height\s*:\s*(?:100%|100vh|\d+px)/);
  });
});
