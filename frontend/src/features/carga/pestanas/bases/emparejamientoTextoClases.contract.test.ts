// El diálogo "Emparejamiento por el texto de la pregunta" usaba la clase raíz
// `.pulso-emparejamiento`, que en fuentesEmparejamiento.css es el panel lateral fijo
// de las equivalencias entre fuentes (position: fixed, 1040 px a la derecha). El
// diálogo se pintaba como ese panel, tapaba su cabecera y su pie, y "Cancelar" y
// "Cargar con los nombres del formulario" no recibían clic (QA del ítem 30,
// 2026-11-13). Las clases del diálogo no pueden coincidir con las del panel.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = dirname(fileURLToPath(import.meta.url));

function clasesDe(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/\.(pulso-[a-z0-9_-]+)/g), (m) => m[1]));
}

describe("clases del diálogo de emparejar por texto", () => {
  it("no coinciden con las del panel de equivalencias entre fuentes", () => {
    const dialogo = clasesDe(readFileSync(join(aqui, "emparejamientoTexto.css"), "utf8"));
    const panel = clasesDe(readFileSync(join(aqui, "../../fuentesEmparejamiento.css"), "utf8"));
    const compartidas = [...dialogo].filter((c) => panel.has(c));
    expect(compartidas).toEqual([]);
  });
});
