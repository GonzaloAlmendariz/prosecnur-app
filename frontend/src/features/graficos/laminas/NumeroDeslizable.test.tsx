// Ítem 11 (2026-11-08): el número acotado como slider. Lo que se ve: la pista y la cifra con el valor que rige, el «Auto»
// marcado mientras no hay valor y la cifra tenue en ese estado. El borrador y la confirmación única los prueba
// useCifraEnVivo.test.tsx.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NumeroDeslizable } from "./NumeroDeslizable";

const RANGO = { min: 8, max: 20, paso: 0.5, grande: 1 };
const pintar = (valor: unknown) => renderToStaticMarkup(
  <NumeroDeslizable id="letra" rotulo="Letra de las categorías (pt)" rango={RANGO} valor={valor} porDefecto={12} vacio="Auto" onCambio={() => undefined} />,
);

describe("NumeroDeslizable", () => {
  it("sin valor: la pista en el de por defecto, «Auto» marcado y la cifra tenue", () => {
    const html = pintar(undefined);
    expect(html).toMatch(/type="range"[^>]*min="8" max="20"[^>]*value="12"/);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("pulso-f6-numdesl is-vacio");
  });
  it("con valor: la cifra es la guardada, acotada al tramo, y «Auto» queda para volver", () => {
    const html = pintar(24);
    expect(html).toMatch(/type="range"[^>]*value="20"/);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Volver a auto en letra de las categorías (pt)"');
    expect(html).not.toContain("is-vacio");
  });
});
