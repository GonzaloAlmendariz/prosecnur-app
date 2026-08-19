import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/**
 * Un `var(--pulso-x)` que nadie define resuelve a nada y la declaración
 * desaparece en silencio: la regla se lee perfecta en el archivo y en pantalla
 * no pasa nada. Se descubrió persiguiendo tarjetas planas en Monitoreo —cuatro
 * reglas declaraban su sombra con `--pulso-shadow-subtle` y `--pulso-shadow-xs`,
 * que no existen— y al barrer el resto aparecieron veintinueve nombres más.
 *
 * Este contrato no exige arreglarlos de golpe: fija la lista actual como línea
 * base y falla en cuanto aparece uno nuevo. La lista solo puede encoger.
 */

const appDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(appDir, "..");

/** Tokens usados sin definir a fecha de 2026-07-30. Solo se quitan nombres. */
const DEUDA_CONOCIDA = new Set([
  "--pulso-border-soft",
  "--pulso-chrome-pad",
  "--pulso-chrome-radius",
  "--pulso-danger",
  "--pulso-danger-soft",
  "--pulso-focus-ring",
  "--pulso-info",
  "--pulso-ink",
  "--pulso-material-thin",
  "--pulso-muted",
  "--pulso-muted-fg",
  "--pulso-on-primary",
  "--pulso-primary-bg",
  "--pulso-primary-hover",
  "--pulso-radius-control",
  "--pulso-radius-lg",
  "--pulso-radius-md",
  "--pulso-radius-pill",
  "--pulso-success",
  "--pulso-success-soft",
  "--pulso-surface-muted",
  "--pulso-validacion-border",
  "--pulso-validacion-soft",
  "--pulso-warn-soft",
  "--pulso-warn-text",
  "--pulso-warning",
  "--pulso-warning-bg",
  "--pulso-warning-border",
  "--pulso-warning-fg",
]);

const DEFINICION = /(--pulso-[A-Za-z0-9_-]+)\s*:/g;
/** El segundo grupo captura la coma del fallback: `var(--x, algo)` degrada solo. */
const USO = /var\(\s*(--pulso-[A-Za-z0-9_-]+)\s*(,)?/g;

function archivos(dir: string, extensiones: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(completo, extensiones);
    return extensiones.some((ext) => entrada.name.endsWith(ext)) ? [completo] : [];
  });
}

const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function inventario() {
  const definidos = new Set<string>();
  const usadosSinFallback = new Map<string, string[]>();

  for (const archivo of archivos(srcDir, [".css"])) {
    const css = sinComentarios(fs.readFileSync(archivo, "utf8"));
    for (const [, nombre] of css.matchAll(DEFINICION)) definidos.add(nombre);
    for (const [, nombre, fallback] of css.matchAll(USO)) {
      if (fallback) continue;
      const relativo = path.relative(srcDir, archivo);
      usadosSinFallback.set(nombre, [...(usadosSinFallback.get(nombre) ?? []), relativo]);
    }
  }

  // Un token puede declararse desde TS con `style={{ "--pulso-x": … }}` —y también
  // USARSE desde TS, que es lo que el barrido no miraba: un `stroke="var(--pulso-x)"`
  // en el SVG de un gráfico resuelve a `none` y la línea sencillamente no se
  // dibuja, sin que nada falle. Hoy este tramo no añade ningún huérfano nuevo
  // (los que usa el producto en TSX ya salían por CSS), y por eso mismo entra
  // ahora: cierra la puerta antes de que entre el primero.
  for (const archivo of archivos(srcDir, [".ts", ".tsx"])) {
    const fuente = fs.readFileSync(archivo, "utf8");
    for (const [, nombre] of fuente.matchAll(/"(--pulso-[A-Za-z0-9_-]+)"\s*:/g)) {
      definidos.add(nombre);
    }
    for (const [, nombre, fallback] of fuente.matchAll(USO)) {
      if (fallback) continue;
      const relativo = path.relative(srcDir, archivo);
      usadosSinFallback.set(nombre, [...(usadosSinFallback.get(nombre) ?? []), relativo]);
    }
  }

  return { definidos, usadosSinFallback };
}

describe("tokens --pulso-* usados sin definir", () => {
  const { definidos, usadosSinFallback } = inventario();
  const huerfanos = [...usadosSinFallback.keys()].filter((token) => !definidos.has(token)).sort();

  test("el barrido reconoce los tokens que sí existen", () => {
    // Guardia del propio contrato: si el escaneo se rompe, esto lo delata antes
    // de que un `todo verde` se confunda con `no encontré nada`.
    expect(definidos.has("--pulso-radius-card")).toBe(true);
    expect(definidos.has("--pulso-shadow-low")).toBe(true);
    expect(definidos.size).toBeGreaterThan(100);
  });

  test("no aparece ningún token huérfano nuevo", () => {
    const nuevos = huerfanos
      .filter((token) => !DEUDA_CONOCIDA.has(token))
      .map((token) => `${token} → ${[...new Set(usadosSinFallback.get(token))].join(", ")}`);

    expect(
      nuevos,
      "Este token no está definido en ningún sitio: la declaración que lo usa no llega a pantalla. " +
        "Apúntalo a un token real de tokens.css o dale un fallback con `var(--x, valor)`.",
    ).toEqual([]);
  });

  test("la línea base no se infla: los nombres saldados se quitan de la lista", () => {
    const saldados = [...DEUDA_CONOCIDA].filter((token) => !huerfanos.includes(token)).sort();

    expect(
      saldados,
      "Estos tokens ya no están huérfanos. Quítalos de DEUDA_CONOCIDA para que la lista solo encoja.",
    ).toEqual([]);
  });
});
