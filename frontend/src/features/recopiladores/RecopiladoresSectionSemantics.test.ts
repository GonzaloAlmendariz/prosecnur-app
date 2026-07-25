import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Fichas QR section selector semantics", () => {
  it("announces stages as pressed buttons while preserving arrow-key roving", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresPage.tsx"), "utf8");
    // El corte cerraba en `<div className="rec-actions">`, que era el bloque de
    // acciones de la banda propia de esta página. La banda pasó a
    // `ModuleCommandBar` y ese div ya no existe: sus acciones son ahora datos
    // (`acciones`/`estado`), no marcado. El cierre del propio selector es un
    // ancla más honesta —lo que este test mide es el selector, no lo que venga
    // después— y no vuelve a romperse si la banda cambia de forma otra vez.
    const inicio = source.indexOf("<GlidingTabList", source.indexOf("Selector de etapas"));
    const sectionSelector = source.slice(
      inicio,
      source.indexOf("</GlidingTabList>", inicio) + "</GlidingTabList>".length,
    );

    expect(sectionSelector).toContain('role="group"');
    expect(sectionSelector).toContain('mode="tabs"');
    expect(sectionSelector).toContain("aria-pressed={active}");
    expect(sectionSelector).not.toContain('as="nav"');
    expect(sectionSelector).not.toContain('role="tablist"');
    expect(sectionSelector).not.toContain('role="tab"');
    expect(sectionSelector).not.toContain("aria-selected");
    expect(sectionSelector).not.toContain("aria-current");
  });

  it("keeps the nested local tabs associated with their real panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresPage.tsx"), "utf8");

    expect(source).toContain('aria-controls={active ? "rec-tabpanel" : undefined}');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-labelledby={`rec-tab-${activeTab}`}');
  });
});
