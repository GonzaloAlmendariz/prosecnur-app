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

  it("alturas 36/30, radio 9 y foco con --pulso-primary-focus", () => {
    const css = fs.readFileSync(path.join(__dirname, "kit-inputs.css"), "utf8");
    expect(css).toMatch(/\.pulso-select-trigger \{\s*--pulso-field-height: 36px;/);
    expect(css).toMatch(/\.pulso-select-trigger\.pulso-select-trigger--sm \{\s*--pulso-field-height: 30px;/);
    expect(css).toContain("border-radius: 9px;");
    expect(css).toContain("box-shadow: 0 0 0 3px var(--pulso-primary-focus);");
  });
});
