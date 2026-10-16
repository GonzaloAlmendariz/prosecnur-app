import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Material de campo: semántica de secciones", () => {
  it("usa el rail de secciones compartido: navegación con aria-current, sin numeral", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresShell.tsx"), "utf8");
    const inicio = source.indexOf("<SectionPillbar");
    expect(inicio).toBeGreaterThan(-1);
    const sectionSelector = source.slice(inicio, source.indexOf("/>\n  );", inicio));

    // `SectionPillbar` emite enlaces con `aria-current="page"` en la activa;
    // el selector no repite roles ni estados de botón o de tab.
    expect(sectionSelector).toContain("seccionActiva={direction.seccion}");
    expect(sectionSelector).toContain('ariaLabel="Secciones de Material de campo"');
    expect(sectionSelector).not.toContain("progreso=");
    // La dirección es la canónica: `seccion` y su primera pestaña.
    expect(sectionSelector).toContain("searchFor(location.search, id, PESTANAS_POR_SECCION[id][0]");
    expect(source).not.toContain("pulso-phase-pill-number");
    expect(source).not.toContain("aria-pressed");
    expect(source).not.toContain('aria-current={active ? "step"');
  });

  it("keeps the nested local tabs associated with their real panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "RecopiladoresShell.tsx"), "utf8");

    // Las pestañas viven en el rail compartido de la casa: él pone role="tab",
    // aria-selected y aria-controls a partir de estos dos ids.
    expect(source).toContain("<ContextTabRail");
    expect(source).toContain("panelId={(key) => `rec-tab-panel-${key}`}");
    expect(source).toContain("tabId={(key) => `rec-tab-${key}`}");
    expect(source).toContain('id={tabs.length > 1 ? `rec-tab-panel-${direction.pestana}` : undefined}');
    expect(source).toContain('role={tabs.length > 1 ? "tabpanel" : undefined}');
    expect(source).toContain('aria-labelledby={tabs.length > 1 ? `rec-tab-${direction.pestana}` : undefined}');
  });
});
