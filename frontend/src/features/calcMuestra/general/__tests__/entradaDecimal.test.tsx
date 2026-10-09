/**
 * L14 del loop de mejoras (2026-09-27): los <input type=number> de Parámetros
 * pintaban «0,5» y «0,03» junto a «z = 1.96». Chromium formatea esos campos
 * con el locale del sistema e ignora `lang` (medido con es-PE, es-419, es-MX y
 * en): el campo pasa a texto con teclado decimal y acepta coma o punto.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntradaDecimal } from "../EntradaDecimal";
import { leerDecimal } from "../modeloParametros";

describe("leerDecimal", () => {
  it("acepta punto y coma como separador decimal", () => {
    expect(leerDecimal("0.05")).toBe(0.05);
    expect(leerDecimal("0,05")).toBe(0.05);
    expect(leerDecimal(" 1.96 ")).toBe(1.96);
    expect(leerDecimal("30")).toBe(30);
  });

  it("lo incompleto o lo que no es número no emite", () => {
    expect(leerDecimal("")).toBeNull();
    expect(leerDecimal("0.")).toBeNull();
    expect(leerDecimal("0,")).toBeNull();
    expect(leerDecimal("abc")).toBeNull();
    expect(leerDecimal("1.2.3")).toBeNull();
  });
});

describe("EntradaDecimal", () => {
  it("se pinta con punto como el resto de la pantalla, con teclado decimal", () => {
    const html = renderToStaticMarkup(
      <EntradaDecimal id="cmg-param-x-p" valor={0.5} onNumero={() => undefined} />,
    );
    expect(html).toContain('value="0.5"');
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="decimal"');
  });

  it("sin valor queda vacío y deja ver el placeholder", () => {
    const html = renderToStaticMarkup(
      <EntradaDecimal id="cmg-param-x-cv" valor={null} placeholder="1" onNumero={() => undefined} />,
    );
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="1"');
  });
});
