// F8 (matriz HSyVbG, 2026-10-15): cambiar de base tarda 20–40 s; el chip dice a
// qué base se cambia en vez de quedarse con la anterior y los botones mudos.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BaseSelectorTrigger } from "./BasesInspectorMenu";

const aqui = path.dirname(fileURLToPath(import.meta.url));

describe("selector de base: cambio en curso", () => {
  test("en reposo nombra la base activa y su contador, sin aria-busy", () => {
    const html = renderToStaticMarkup(<BaseSelectorTrigger etiqueta="2026" total={3} />);
    expect(html).toContain("2026");
    expect(html).toContain("pulso-bases-inspector-trigger-count");
    expect(html).not.toContain("aria-busy");
  });

  test("cambiando dice a qué base, gira el indicador y marca aria-busy", () => {
    const html = renderToStaticMarkup(
      <BaseSelectorTrigger etiqueta="2026" total={3} cambiando="Cambiando a 2024…" />,
    );
    expect(html).toContain("Cambiando a 2024…");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("pulso-bases-inspector-spin");
    expect(html).not.toContain("pulso-bases-inspector-trigger-count");
  });

  test("el selector anuncia el cambio en una región viva y el giro respeta movimiento reducido", () => {
    const selector = readFileSync(path.join(aqui, "ChromeBaseSelector.tsx"), "utf8");
    expect(selector).toMatch(/role="status" aria-live="polite"/);
    const css = readFileSync(path.join(aqui, "bases-inspector.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.pulso-bases-inspector-spin\s*\{\s*animation:\s*none/);
  });
});
