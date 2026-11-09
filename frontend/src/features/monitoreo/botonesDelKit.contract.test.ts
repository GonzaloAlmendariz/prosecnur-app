// R11-14c (decisión W3): Monitoreo hereda el anillo único de foco y el botón sin sombra del kit. monitoreo.css pisaba
// `.mon-page .pulso-button` con su halo (`--mon-focus-ring`) y una sombra al hover; las barras de comandos hacían lo
// mismo a los PulsoButton que contienen por la regla de `button`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "monitoreo.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Selectores de las reglas que tocan foco, hover o presión. */
function selectoresDeEstado(): string[] {
  return [...css.matchAll(/([^{}]+)\{/g)]
    .flatMap((m) => m[1].split(","))
    .map((s) => s.trim())
    .filter((s) => /:(focus-visible|hover|active)/.test(s));
}

describe("Monitoreo no pisa los estados del botón del kit", () => {
  it("ninguna regla de foco, hover o presión apunta a .pulso-button", () => {
    const pisan = selectoresDeEstado().filter((s) => /\.pulso-button(?![\w-])/.test(s.replace(/:not\(\.pulso-button\)/g, "")));
    expect(pisan).toEqual([]);
  });

  it("las barras de comandos excluyen al PulsoButton de su halo", () => {
    const barras = selectoresDeEstado().filter((s) => /^\.mon-(commandbar|toolbar) button/.test(s));
    expect(barras.length).toBeGreaterThan(0);
    for (const s of barras) expect(s).toContain("button:not(.pulso-button)");
  });
});
