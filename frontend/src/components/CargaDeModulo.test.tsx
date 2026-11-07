import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CargaDeModulo } from "./CargaDeModulo";

describe("CargaDeModulo (salto corto, lenguaje de PantallaDeCarga)", () => {
  it("lleva el isotipo, la ceja del módulo en su tono, el rótulo y la barra indeterminada", () => {
    const html = renderToStaticMarkup(<CargaDeModulo label="Abriendo Avance…" modulo="monitoreo" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('class="pulso-isotipo-carga"');
    expect(html).toContain("pulso-carga-modulo-ceja");
    expect(html).toContain("--module-accent:");
    expect(html).toContain("Abriendo Avance…");
    expect(html).toContain("pulso-barra-avance--indeterminada");
  });

  it("sin módulo no inventa una ceja", () => {
    const html = renderToStaticMarkup(<CargaDeModulo label="Abriendo el módulo…" />);
    expect(html).not.toContain("pulso-carga-modulo-ceja");
  });
});
