import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P1b de la pasada de formato — la letra en línea también va por rol.**
 *
 * `letraPorRol` mira las hojas CSS; los estilos en línea del JSX quedaban fuera, y
 * Gráficos tenía 68 `fontSize` numéricos (21 en ArgField, 19 en la cabecera, 16
 * en el armador de multiapiladas). Pasan a `var(--pulso-type-<rol>-size)` con la
 * misma regla que las hojas. Meta 0: un `fontSize: 12` nuevo no entra. Un tamaño
 * calculado (la muestra de letra del Word, que dibuja el medio) no es un literal
 * y no cuenta.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const LITERAL = /fontSize\s*:\s*\d/;

describe("letra en línea de Gráficos por rol (P1b)", () => {
  it("ningún estilo en línea escribe fontSize con un número", () => {
    const fuentes = archivos(aqui);
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((l, i) => (LITERAL.test(l) ? `${path.relative(aqui, f)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos, 'Usa fontSize: "var(--pulso-type-<rol>-size)".').toEqual([]);
  });

  it("el detector reconoce lo que prohíbe", () => {
    expect(LITERAL.test("{ fontSize: 12, color }")).toBe(true);
    expect(LITERAL.test('{ fontSize: "var(--pulso-type-body-size)" }')).toBe(false);
  });
});
