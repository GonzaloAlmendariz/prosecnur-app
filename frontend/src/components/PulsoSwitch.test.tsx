import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PulsoField } from "./PulsoField";
import { PulsoSwitch, nextSwitchValue, type PulsoSwitchProps } from "./PulsoSwitch";
import { Switch } from "./Switch";

const noop = () => {};

describe("PulsoSwitch (K1)", () => {
  it("es un button nativo role=switch con aria-checked: Espacio y Enter lo activan por HTML", () => {
    const html = renderToStaticMarkup(
      <PulsoSwitch checked ariaLabel="Solo editadas" onCheckedChange={noop} />,
    );
    expect(html).toMatch(/^<button type="button" role="switch"/);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Solo editadas"');
    expect(html).toContain('class="pulso-switch"');
    expect(html).not.toContain("checkbox");
  });

  it("una activación conmuta y disabled la ignora (click y teclado comparten el handler)", () => {
    expect(nextSwitchValue(false, false)).toBe(true);
    expect(nextSwitchValue(true, false)).toBe(false);
    expect(nextSwitchValue(true, true)).toBeNull();
  });

  it("con label pinta la etiqueta AL LADO y la asocia por aria-labelledby y for", () => {
    const html = renderToStaticMarkup(
      <PulsoSwitch id="sw" checked={false} label="Solo editadas" onCheckedChange={noop} />,
    );
    expect(html).toContain('aria-labelledby="sw-label"');
    expect(html).toContain('<label id="sw-label" for="sw" class="pulso-switch-field-label">Solo editadas</label>');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('data-checked="false"');
  });

  it("chica 30×17 y chip con conteo en píldora", () => {
    const sm = renderToStaticMarkup(
      <PulsoSwitch size="sm" checked ariaLabel="Incluir" onCheckedChange={noop} />,
    );
    expect(sm).toContain("pulso-switch pulso-switch--sm");
    const chip = renderToStaticMarkup(
      <PulsoSwitch variant="chip" checked label="Pregrado" count="106,013" onCheckedChange={noop} />,
    );
    expect(chip).toContain("pulso-switch-field is-sm is-chip");
    expect(chip).toContain("pulso-switch--sm");
    expect(chip).toContain('<small class="pulso-switch-field-count">106,013</small>');
    expect(chip).toContain('data-checked="true"');
  });

  it("disabled y description viajan al botón", () => {
    const html = renderToStaticMarkup(
      <PulsoSwitch id="g" disabled checked={false} label="Grupos" description="Rangos" onCheckedChange={noop} />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain('aria-describedby="g-description"');
    expect(html).toContain("is-disabled");
  });

  it("dentro de un PulsoField toma su id y su hint", () => {
    const html = renderToStaticMarkup(
      <PulsoField id="f" label="Mostrar" hint="Filtra la tabla">
        <PulsoSwitch checked={false} label="Solo editadas" onCheckedChange={noop} />
      </PulsoField>,
    );
    expect(html).toContain('id="f" aria-checked="false"');
    expect(html).toContain('aria-describedby="f-message"');
  });

  it("exige nombre accesible sin etiqueta visible (compile time)", () => {
    // @ts-expect-error Sin label el switch necesita ariaLabel.
    const invalid: PulsoSwitchProps = { checked: true, onCheckedChange: noop };
    expect(invalid.checked).toBe(true);
  });

  it("el Switch heredado sigue rindiendo el mismo botón", () => {
    const html = renderToStaticMarkup(<Switch checked ariaLabel="Concentración" onToggle={noop} id="c" />);
    expect(html).toBe(
      '<button type="button" role="switch" id="c" aria-checked="true" aria-label="Concentración" class="pulso-switch"><span class="pulso-switch-thumb" aria-hidden="true"></span></button>',
    );
  });

  it("la geometría de la chica cuadra: perilla 13 px dentro de 30×17 con borde de 1 px", () => {
    const css = fs.readFileSync(path.join(__dirname, "kit-inputs.css"), "utf8");
    expect(css).toMatch(/\.pulso-switch\.pulso-switch--sm \{[^}]*width: 30px;[^}]*height: 17px;/);
    expect(css).toMatch(/\.pulso-switch\.pulso-switch--sm\[aria-checked="true"\] \.pulso-switch-thumb \{\s*left: 14px;/);
    expect(css).toMatch(/\.pulso-switch:focus-visible \{\s*outline: 2px solid/);
  });

  it("el borde de la pista apagada llega a 3:1 sobre la fila gris y sobre blanco (1.4.11)", () => {
    const css = fs.readFileSync(path.join(__dirname, "kit-inputs.css"), "utf8");
    const tokens = fs.readFileSync(path.resolve(__dirname, "..", "app", "tokens.css"), "utf8");
    const regla = css.match(
      /\.pulso-switch:not\(\[aria-checked="true"\]\) \{\s*border-color: color-mix\(in srgb, var\(--pulso-text-faint\) (\d+)%, var\(--pulso-border-strong\)\);/,
    );
    expect(regla).not.toBeNull();
    const peso = Number(regla![1]) / 100;
    const hex = (nombre: string) => {
      const valor = tokens.match(new RegExp(`${nombre}: (#[0-9a-f]{6});`, "i"))?.[1];
      expect(valor, nombre).toBeDefined();
      return [1, 3, 5].map((i) => Number.parseInt(valor!.slice(i, i + 2), 16));
    };
    const lum = ([r, g, b]: number[]) => {
      const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const faint = hex("--pulso-text-faint");
    const strong = hex("--pulso-border-strong");
    const borde = faint.map((c, i) => Math.round(c * peso + strong[i] * (1 - peso)));
    const contraste = (fondo: number[]) => (lum(fondo) + 0.05) / (lum(borde) + 0.05);
    expect(contraste(hex("--pulso-bg"))).toBeGreaterThanOrEqual(3);
    expect(contraste([255, 255, 255])).toBeGreaterThanOrEqual(3);
  });
});
