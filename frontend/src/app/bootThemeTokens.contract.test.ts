// =============================================================================
// bootThemeTokens.contract.test.ts — boot.css no puede divergir de tokens.css
// =============================================================================
// boot.css replica un subconjunto de tokens --pulso-* para que el chunk de
// entrada (BootGate, warm start) pinte sin depender del bundle completo. Esa
// duplicación es deliberada, pero durante meses nadie comprobó que siguiera
// diciendo lo mismo: al medirla, --pulso-warn-fg valía #92400e en boot y
// #8a5000 en theme (ΔE76 14,0, perceptible), así que los avisos del arranque
// salían de otro color que los del resto del producto.
//
// Este contrato exige que todo token declarado en ambos archivos resuelva al
// mismo valor. Duplicar sigue permitido; divergir en silencio, no.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** Declaraciones `--pulso-*: valor` de la raíz del archivo, en orden. */
function readTokens(file: string): Map<string, string> {
  const css = fs.readFileSync(path.join(appDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/(--pulso-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    // Nos quedamos con la primera declaración: las posteriores son overrides
    // por scope (tema oscuro, densidad, módulo) y no el valor base.
    if (!tokens.has(match[1])) tokens.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return tokens;
}

/** Resuelve `var(--x)` de un mapa hasta llegar a un valor literal. */
function resolve(value: string, tokens: Map<string, string>, seen = new Set<string>()): string {
  const varMatch = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
  if (!varMatch) return value;
  const name = varMatch[1];
  if (seen.has(name)) return value;
  seen.add(name);
  const next = tokens.get(name);
  return next ? resolve(next, tokens, seen) : value;
}

describe("boot.css y tokens.css comparten valores", () => {
  const boot = readTokens("boot.css");
  const theme = readTokens("tokens.css");

  test("hay tokens replicados (si no, este contrato sobra)", () => {
    const shared = [...boot.keys()].filter((k) => theme.has(k));
    expect(shared.length).toBeGreaterThan(20);
  });

  test("ningún token replicado resuelve a un valor distinto", () => {
    const divergentes: string[] = [];
    for (const [name, bootValue] of boot) {
      const themeValue = theme.get(name);
      if (themeValue === undefined) continue;
      const a = resolve(bootValue, boot);
      const b = resolve(themeValue, theme);
      if (a !== b) divergentes.push(`${name}: boot=${a} · theme=${b}`);
    }
    expect(divergentes, `Tokens que divergen entre boot.css y tokens.css:\n  ${divergentes.join("\n  ")}`).toEqual([]);
  });

  test("los acentos de módulo son idénticos en ambos archivos", () => {
    // El espectro modular es identidad congelada (identity.json). Si boot y
    // theme no coinciden, el módulo cambia de color al terminar el arranque.
    const modulos = [...theme.keys()].filter((k) => /^--pulso-module-[a-z]+$/.test(k));
    expect(modulos.length).toBeGreaterThanOrEqual(8);
    for (const name of modulos) {
      if (!boot.has(name)) continue;
      expect(resolve(boot.get(name)!, boot), `acento divergente: ${name}`).toBe(
        resolve(theme.get(name)!, theme),
      );
    }
  });
});
