import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingBlock } from "./States";

describe("LoadingBlock (lenguaje de la pantalla de carga, 6 nov 2026)", () => {
  it("panel: isotipo, rótulo y barra indeterminada; conserva su min-height", () => {
    const html = renderToStaticMarkup(<LoadingBlock label="Leyendo las campañas…" />);
    expect(html).toContain('class="pulso-loading-block pulso-loading-block--panel"');
    expect(html).toContain('class="boot-eq"');
    expect(html).toContain("Leyendo las campañas…");
    expect(html).toContain("pulso-barra-avance--indeterminada");
    expect(html).toContain("min-height:260px");
  });

  it("inline: el anillo pequeño y el rótulo, sin isotipo ni barra", () => {
    const html = renderToStaticMarkup(<LoadingBlock label="Cargando…" variant="inline" />);
    expect(html).toContain("pulso-states-spinner");
    expect(html).not.toContain("boot-eq");
    expect(html).toContain("min-height:60px");
  });
});
