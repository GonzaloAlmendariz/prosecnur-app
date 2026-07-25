import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Hojas de ruta stage rail semantics", () => {
  it("exposes workflow stages as current pressed buttons driven by the navigation model", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "HojasRutaPage.tsx"),
      "utf8",
    );
    // Los marcadores cambiaron al migrar el módulo al chrome compartido: el
    // rail vive en la zona `secciones` del ModuleCommandBar, así que ya no hay
    // wrapper propio ni una zona de acciones hermana que lo cierre.
    const inicio = source.indexOf('<div className="pulso-phase-rail hojas-ruta-stage-rail"');
    const fin = source.indexOf("herramientas={", inicio);
    expect(inicio, "no encontré el rail de etapas en la página").toBeGreaterThan(-1);
    expect(fin, "no encontré el fin de la zona de secciones").toBeGreaterThan(inicio);
    const rail = source.slice(inicio, fin);

    expect(rail).toContain("hojasRutaNavigation.sections.map((step)");
    expect(rail).toContain('role="group"');
    expect(rail).toContain('mode="tabs"');
    expect(rail).toContain("aria-pressed={active}");
    expect(rail).toContain('aria-current={active ? "step" : undefined}');
    expect(rail).toContain("selectStage(step.key)");
    expect(rail).toContain("{step.label}");
    expect(rail).not.toContain('as="nav"');
    expect(rail).not.toContain('role="tablist"');
    expect(rail).not.toContain('role="tab"');
    expect(rail).not.toContain("aria-selected=");
  });
});
