import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **T1 — los atajos dicen y escuchan la tecla de cada sistema.**
 *
 * La app corre en macOS y en Windows (Gonzalo, 2026-10-28: «teclado mac y
 * windows ojo»). Un «⌘» escrito en la UI es un símbolo que el teclado de
 * Windows no tiene, y un atajo que escucha sólo `metaKey` no responde a Ctrl.
 * Todo pasa por `lib/teclado.ts`: `teclaMod`, `nombreDeAtajo`, `rotuloDeAtajo`
 * y `conModificador`.
 *
 * Los comentarios no cuentan: describir «⌘Z / Ctrl+Z» en prosa está bien.
 * Monitoreo queda fuera mientras lo trabaja su propia sesión; su único caso
 * conocido está en FUERA_DE_ALCANCE para que el contrato no lo esconda.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELPER = "lib/teclado.ts";
const FUERA_DE_ALCANCE = ["features/monitoreo/"];

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta);
    if (!/\.tsx?$/.test(entrada.name) || /\.(test|spec)\.tsx?$/.test(entrada.name)) return [];
    return [ruta];
  });
}

const fuentes = archivos(SRC)
  .map((ruta) => ({ archivo: path.relative(SRC, ruta).split(path.sep).join("/"), ruta }))
  .filter(({ archivo }) => !FUERA_DE_ALCANCE.some((prefijo) => archivo.startsWith(prefijo)))
  .map(({ archivo, ruta }) => ({ archivo, codigo: sinComentarios(fs.readFileSync(ruta, "utf8")) }));

describe("teclado en macOS y Windows", () => {
  test("el escáner ve el árbol", () => {
    expect(fuentes.length).toBeGreaterThan(500);
  });

  test("«⌘» sólo lo escribe lib/teclado.ts", () => {
    const conSimbolo = fuentes
      .filter(({ archivo, codigo }) => archivo !== HELPER && codigo.includes("⌘"))
      .map(({ archivo }) => archivo);
    expect(conSimbolo).toEqual([]);
  });

  test("ningún atajo escucha metaKey sin Ctrl", () => {
    const soloMeta = fuentes.flatMap(({ archivo, codigo }) =>
      codigo
        .split("\n")
        .filter((linea) => /\bevent\w*\.metaKey\b|\be\.metaKey\b|\bevento\.metaKey\b/.test(linea))
        .filter((linea) => !/ctrlKey|conModificador/.test(linea))
        .map((linea) => `${archivo}: ${linea.trim()}`),
    );
    expect(soloMeta).toEqual([]);
  });
});
