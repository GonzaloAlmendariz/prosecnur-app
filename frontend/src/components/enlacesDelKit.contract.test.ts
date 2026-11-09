// R11-14d (decisión W3): un enlace con piel de botón es PulsoButtonEnlace. Nadie copia a mano las clases
// `pulso-button…` sobre un `<a>` (había siete en Material de campo): la copia no sigue al kit cuando cambia.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

describe("enlaces con piel de botón", () => {
  it("ningún <a> lleva a mano las clases pulso-button", () => {
    const copias = archivos(SRC).flatMap((archivo) => {
      const fuente = readFileSync(archivo, "utf8");
      return [...fuente.matchAll(/<a\b[^>]*className=["{][^>]*\bpulso-button\b/g)].map(() => path.relative(SRC, archivo));
    });
    expect(copias).toEqual([]);
  });
});
