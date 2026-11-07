import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert } from "./Alert";

describe("Alert con acciones (kit, 6 nov 2026)", () => {
  it("las acciones van en su ranura, al costado del texto", () => {
    const html = renderToStaticMarkup(<Alert kind="warn" acciones={<button type="button">Ir</button>}><p>Falta algo.</p></Alert>);
    expect(html).toContain('class="pulso-alert pulso-alert-warn has-acciones"');
    expect(html).toMatch(/pulso-alert-content"><p>Falta algo\.<\/p><\/div><div class="pulso-alert-acciones"><button/);
  });

  it("sin acciones el marcado es el de siempre", () => {
    const html = renderToStaticMarkup(<Alert>Hola</Alert>);
    expect(html).toContain('class="pulso-alert pulso-alert-info"');
    expect(html).not.toContain("pulso-alert-acciones");
  });
});
