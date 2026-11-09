import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PulsoInput } from "./PulsoInput";

const noop = () => {};

describe("PulsoInput", () => {
  it("es un input de texto con la clase del kit y tamaño md por defecto", () => {
    const html = renderToStaticMarkup(<PulsoInput value="x" onChange={noop} aria-label="Etiqueta" />);
    expect(html).toContain('type="text"');
    expect(html).toContain('class="pulso-input"');
    expect(html).toContain('aria-label="Etiqueta"');
  });

  it("sm, numérico e inválido", () => {
    const html = renderToStaticMarkup(
      <PulsoInput size="sm" numeric invalid type="number" value={3} onChange={noop} aria-label="Mínimo" />,
    );
    expect(html).toContain('type="number"');
    expect(html).toContain("pulso-input pulso-input--sm is-numeric");
    expect(html).toContain('aria-invalid="true"');
  });

  it("conserva aria-describedby propio", () => {
    const html = renderToStaticMarkup(<PulsoInput aria-describedby="h1" defaultValue="" />);
    expect(html).toContain('aria-describedby="h1"');
  });

  it("W3: alturas 36/28 (familia de controles), radio de control; input y select con el mismo anillo único, sin halo (R11-14b)", () => {
    const css = fs.readFileSync(path.join(__dirname, "kit-inputs.css"), "utf8");
    expect(css).toMatch(/\.pulso-select-trigger \{\s*--pulso-field-height: 36px;/);
    expect(css).toMatch(/\.pulso-select-trigger\.pulso-select-trigger--sm \{\s*--pulso-field-height: var\(--pulso-control-height-sm\);/);
    expect(css).not.toContain("--pulso-field-height: 30px");
    expect(css).toContain("border-radius: var(--pulso-control-radius);");
    expect(css).toMatch(/\.pulso-input:focus \{[^}]*outline: var\(--mov-foco\);[^}]*box-shadow: none;/);
    expect(css).not.toContain("var(--pulso-primary-focus)");
    expect(css).toMatch(/\.pulso-select-trigger:focus-visible \{[^}]*outline: var\(--mov-foco\);[^}]*box-shadow: none;/);
  });
});
