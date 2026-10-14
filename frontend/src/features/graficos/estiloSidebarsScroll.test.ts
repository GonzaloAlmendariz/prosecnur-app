import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * C4 (No Scroll Jail) en la pestaña Word: la lista de tipos de la izquierda es su propio dueño de scroll
 * (`overflow-y: auto`). En el QA en vivo (Meta A, 1024x600) esa sidebar medía 299 px de caja con 775 px de contenido y
 * `overflow-y: hidden`: una regla posterior de igual especificidad (la del antiguo diálogo «Estilo global», ya
 * retirado) pisaba el `overflow-y: auto` de la base y los últimos tipos quedaban fuera de alcance.
 *
 * Este contrato resuelve la cascada de `editor-v2.css` (reglas de nivel superior, sin `@media`: el ancho de escritorio)
 * para la sidebar y exige que el `overflow-y` ganador sea desplazable.
 */

const CSS = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "v2/styles/editor-v2.css"),
  "utf8",
);

type Regla = { selectores: string[]; cuerpo: string; orden: number };

/** Reglas de nivel superior (los bloques `@…` se saltan enteros). */
function reglasDeNivelSuperior(css: string): Regla[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const reglas: Regla[] = [];
  let i = 0;
  let orden = 0;
  while (i < limpio.length) {
    const abre = limpio.indexOf("{", i);
    if (abre < 0) break;
    const prelude = limpio.slice(i, abre).trim();
    let profundidad = 1;
    let j = abre + 1;
    while (j < limpio.length && profundidad > 0) {
      if (limpio[j] === "{") profundidad += 1;
      else if (limpio[j] === "}") profundidad -= 1;
      j += 1;
    }
    if (!prelude.startsWith("@")) {
      reglas.push({ selectores: partirLista(prelude), cuerpo: limpio.slice(abre + 1, j - 1), orden: orden++ });
    }
    i = j;
  }
  return reglas;
}

/** Parte por comas de nivel cero (las de `:where(…)` no cortan). */
function partirLista(s: string): string[] {
  const out: string[] = [];
  let profundidad = 0;
  let actual = "";
  for (const c of s) {
    if (c === "(") profundidad += 1;
    if (c === ")") profundidad -= 1;
    if (c === "," && profundidad === 0) {
      out.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

/** Especificidad (b, c) simplificada: `:where(…)` vale cero; clases, atributos y pseudoclases suman b. */
function especificidad(sel: string): number {
  const sinWhere = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "");
  const b = (sinWhere.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const ids = (sinWhere.match(/#[\w-]+/g) ?? []).length;
  return ids * 100 + b;
}

/** ¿El sujeto del selector (su último compuesto) es la sidebar, sin ancestros que la acoten a otro contexto? */
function apuntaA(sel: string, clase: string): boolean {
  if (sel.includes("::")) return false;
  const compuestos = sel.replace(/\([^()]*\)/g, (m) => m.replace(/\s+/g, "")).split(/\s*[\s>+~]\s*/).filter(Boolean);
  const sujeto = compuestos[compuestos.length - 1] ?? "";
  const clases: string[] = sujeto.match(/\.[\w-]+/g) ?? [];
  if (!clases.includes(`.${clase}`)) return false;
  // Ancestros: sólo los que también cumple una sidebar dentro de Estilo.
  return compuestos.length === 1;
}

function overflowYGanador(css: string, clase: string): string | null {
  let ganador: { valor: string; esp: number; orden: number } | null = null;
  for (const regla of reglasDeNivelSuperior(css)) {
    const sel = regla.selectores.filter((s) => apuntaA(s, clase));
    if (!sel.length) continue;
    const esp = Math.max(...sel.map(especificidad));
    for (const decl of regla.cuerpo.split(";")) {
      const m = decl.match(/^\s*(overflow|overflow-y)\s*:\s*([^!]+?)\s*(!important)?\s*$/);
      if (!m) continue;
      const valores = m[2].split(/\s+/);
      const valor = m[1] === "overflow" ? (valores[1] ?? valores[0]) : valores[0];
      const peso = esp + (m[3] ? 10_000 : 0);
      if (!ganador || peso > ganador.esp || (peso === ganador.esp && regla.orden >= ganador.orden)) {
        ganador = { valor, esp: peso, orden: regla.orden };
      }
    }
  }
  return ganador?.valor ?? null;
}

describe("C4 · la sidebar de Word es su propio dueño de scroll", () => {
  it("pulso-gv2-word-sidebar gana overflow-y desplazable", () => {
    expect(overflowYGanador(CSS, "pulso-gv2-word-sidebar")).toMatch(/^(auto|scroll)$/);
  });

  // El resolvedor no es vacuo: la regla que causó el fallo, añadida al final, lo hace rojo.
  it("el resolvedor detecta la regla que encerraba las sidebars", () => {
    const envenenado = `${CSS}\n.pulso-gv2-word-sidebar { overflow: hidden; }\n`;
    expect(overflowYGanador(envenenado, "pulso-gv2-word-sidebar")).toBe("hidden");
  });
});
