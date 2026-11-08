// Mata: volver al Segmentado propio de 22 px (un tab stop por opción, sin pulgar) o perder aria-checked en los segmentados
// de Gráficos. Acabado de Láminas W2-B: el segmentado es el GlidingRadioGroup del kit con pulgar blanco sobre surface-3 (R9-4).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RadioSegmentado } from "./RadioSegmentado";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("RadioSegmentado", () => {
  const html = renderToStaticMarkup(createElement(RadioSegmentado<"a" | "b" | "c">, {
    etiqueta: "Tamaño", valor: "b", onCambiar: () => undefined, ancho: true,
    opciones: [{ clave: "a", rotulo: "A" }, { clave: "b", rotulo: "B" }, { clave: "c", rotulo: "C", deshabilitada: true }],
  }));

  it("es el radiogroup del kit, con la elegida marcada y su pulgar", () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Tamaño"');
    expect(html).toContain("pulso-gliding-tab-list pulso-f6-segmento is-ancho");
    expect(html).toContain("pulso-gliding-tab-indicator");
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*>(<span[^>]*>)?B</);
    expect(html).toMatch(/disabled=""[^>]*data-gliding-key="c"/);
  });

  it("pulgar blanco sobre riel surface-3 con filete de 3:1, 28 px, radio de control y sin sombra (R9-4)", () => {
    const css = fs.readFileSync(path.join(dir, "radioSegmentado.css"), "utf8");
    const raiz = css.slice(css.indexOf(".pulso-f6-segmento.pulso-gliding-tab-list {"), css.indexOf("}", css.indexOf(".pulso-f6-segmento.pulso-gliding-tab-list {")));
    expect(raiz).toContain("--pulso-gliding-indicator-bg: var(--pulso-surface)");
    expect(raiz).toContain("--pulso-gliding-indicator-shadow: none");
    expect(raiz).toContain("background: var(--pulso-surface-3)");
    expect(raiz).toContain("--pulso-gliding-indicator-border: var(--pulso-text-faint)");
    expect(raiz).toContain("height: var(--pulso-control-height-sm)");
    expect(raiz).toContain("border-radius: var(--pulso-control-radius)");
  });

  it("el Segmentado propio no vuelve", () => {
    expect(fs.existsSync(path.join(dir, "Segmentado.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "segmentado.css"))).toBe(false);
  });
});
