import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **El color del indicador de un segmentado se redefine con selector compuesto.**
 *
 * `theme.css` da a `.pulso-gliding-tab-list` el indicador en el acento del
 * módulo. Una feature que lo quiere en blanco (o suave) redefine
 * `--pulso-gliding-indicator-bg`; si lo hace con UNA sola clase empata en
 * especificidad con el kit, y gana quien llegue último al bundle. En Hojas de
 * ruta perdió: «Todos · 50» del Territorio quedaba como una píldora en el
 * acento con el texto del mismo color, ilegible (verificación de la noche del
 * 2026-11-02, acnur_acg a 1440 y 1024). Con dos clases o más
 * (`.mi-segmentado.pulso-gliding-tab-list`) gana siempre, sin depender del orden.
 *
 * RATCHET: los selectores de una sola clase que ya existían quedan congelados
 * abajo; no se suman nuevos, y al saldar uno se quita de la lista.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Donde el kit define el indicador: no es un consumidor. */
const KIT = new Set(["app/theme.css"]);

/** Selectores de una sola clase que redefinen el indicador, a 2026-11-02. Sólo baja. */
const CONOCIDOS = new Set([
  "features/calcMuestra/general/general.css :: .cmg-metodos",
  "features/calcMuestra/universidad/aulas/aulas.css :: .cmv2-aulas-modalidad",
  "features/recopiladores/correos/correos.css :: .rec-mail-tabs",
  "features/recopiladores/correos/correosCaja.css :: .rec-caja-vistas",
]);

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return e.name.endsWith(".css") ? [completo] : [];
  });
}

function rel(f: string) {
  return path.relative(SRC, f).split(path.sep).join("/");
}

/** Clases, atributos y pseudoclases del selector: su peso en la columna del medio. */
export function pesoDeClases(selector: string): number {
  const sinPseudoElementos = selector.replace(/::[\w-]+/g, "");
  return (sinPseudoElementos.match(/\.[\w-]+|\[[^\]]*\]|:(?!is\b|where\b|not\b|has\b)[\w-]+/g) ?? []).length;
}

/** Cada selector (separado por coma) de cada regla que redefine el fondo del indicador. */
export function selectoresQueRedefinen(css: string): string[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/--pulso-gliding-indicator-bg\s*:/.test(m[2])) continue;
    for (const s of m[1].split(",")) out.push(s.trim().replace(/\s+/g, " "));
  }
  return out;
}

function debiles(): string[] {
  return archivos(SRC)
    .filter((f) => !KIT.has(rel(f)))
    .flatMap((f) =>
      selectoresQueRedefinen(readFileSync(f, "utf8"))
        .filter((s) => pesoDeClases(s) < 2)
        .map((s) => `${rel(f)} :: ${s}`),
    );
}

describe("indicador del segmentado · selector compuesto", () => {
  test("detector: una clase empata con el kit; dos clases o una clase con atributo ganan", () => {
    expect(pesoDeClases(".hr-muestra-opciones")).toBe(1);
    expect(pesoDeClases(".hr-muestra-opciones.pulso-gliding-tab-list")).toBe(2);
    expect(pesoDeClases(".dashboard-scope .dash-tab-nav")).toBe(2);
    expect(pesoDeClases(".x[data-modo='a']")).toBe(2);
    expect(selectoresQueRedefinen(".a, .b.c { --pulso-gliding-indicator-bg: red; } .d { color: red; }")).toEqual([".a", ".b.c"]);
  });

  test("ningún selector nuevo de una sola clase redefine el indicador", () => {
    const nuevos = debiles().filter((s) => !CONOCIDOS.has(s));
    expect(nuevos, "Usa un selector compuesto, p. ej. `.mi-segmentado.pulso-gliding-tab-list`").toEqual([]);
  });

  test("la lista sólo encoge: los saldados se quitan", () => {
    const vigentes = new Set(debiles());
    expect([...CONOCIDOS].filter((s) => !vigentes.has(s))).toEqual([]);
  });
});
