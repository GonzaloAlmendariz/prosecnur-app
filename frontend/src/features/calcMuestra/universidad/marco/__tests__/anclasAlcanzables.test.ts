import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G23 · C4 del Contrato de Superficie: todo alcanzable.
 *
 * Medido: la tarjeta de composición ofrecía «Ajustar la regla común» con un
 * enlace a `#cmv2-chfp-global-adjustments`, y **ese id no existía en ningún
 * sitio del módulo**. Era el único camino desde una regla que no se puede editar
 * por facultad hasta donde sí se edita, y no llevaba a ninguna parte.
 *
 * Un enlace roto no falla: no hace nada. Por eso hace falta un guard.
 */
const RAIZ = join(__dirname, "..", "..");

function tsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const fuentes = tsx(RAIZ)
  .filter((f) => !f.includes("__tests__"))
  .map((f) => ({ f, s: readFileSync(f, "utf8") }));

describe("anclas internas del módulo", () => {
  it("cada href=#… apunta a un id que existe", () => {
    const anclas = new Set<string>();
    for (const { s } of fuentes) {
      for (const m of s.matchAll(/href="#([\w-]+)"/g)) anclas.add(m[1]);
    }
    expect(anclas.size).toBeGreaterThan(0);
    const rotas: string[] = [];
    for (const id of anclas) {
      const existe = fuentes.some(({ s }) => s.includes(`id="${id}"`));
      if (!existe) rotas.push(id);
    }
    expect(rotas).toEqual([]);
  });
});
