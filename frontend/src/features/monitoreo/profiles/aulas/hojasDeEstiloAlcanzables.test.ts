import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Toda clase que la página de aulas pinta tiene que estar en una hoja que esa
 * página importe.
 *
 * `.mon-profile-table-recorte` vivía sólo en `monitoreo.css`, que importan
 * telefónico, acreditación y territorial y **no** aulas —su página nació del
 * refactor y se quedó con las hojas del perfil—. Resultado: todos los avisos de
 * recorte del perfil, los que existen para que nada desaparezca en silencio, se
 * pintaban con los defaults del navegador: 16 px en negro en vez del pie de 11
 * px semibold. Nada fallaba, y a ojo parecía un párrafo más.
 *
 * El barrido está verificado contra el árbol anterior al arreglo: allí señala
 * exactamente esa clase, así que un cero aquí significa algo.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const monitoreoDir = path.join(aqui, "..", "..");

function leer(...tramos: string[]) {
  const p = path.join(...tramos);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

/** Nombres de clase declarados en una hoja. */
function clasesDeclaradas(css: string) {
  return new Set([...css.matchAll(/\.([a-z][a-z0-9-]+)/g)].map((m) => m[1]));
}

/** Nombres de clase que un componente pinta con `className`. */
function clasesUsadas(tsx: string) {
  const fuera = new Set<string>();
  for (const m of tsx.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
    // El template literal trae interpolaciones: se parten para no leer `${x}`
    // como si fuera una clase.
    for (const bruto of (m[1] ?? m[2] ?? "").replace(/\$\{/g, "  ").split(/\s+/)) {
      const c = bruto.replace(/[`{}$]/g, "");
      if (/^[a-z][a-z0-9-]+$/.test(c)) fuera.add(c);
    }
  }
  return fuera;
}

describe("las hojas que la página de aulas importa alcanzan lo que pinta", () => {
  const paginaRuta = path.join(aqui, "AulasMonitoreoPage.tsx");
  const pagina = fs.readFileSync(paginaRuta, "utf8");

  // La página y lo que importa a un nivel: es donde viven las superficies que
  // renderiza. Un nivel basta —lo que importan esos componentes trae su propia
  // hoja— y evita el ruido de recorrer el árbol entero.
  const archivos = [pagina];
  for (const m of pagina.matchAll(/from "(\.[^"]+)"/g)) {
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      const cand = path.resolve(aqui, m[1] + ext);
      if (fs.existsSync(cand)) { archivos.push(fs.readFileSync(cand, "utf8")); break; }
    }
  }

  const usadas = new Set(archivos.flatMap((f) => [...clasesUsadas(f)]));

  // Las hojas que la página SÍ importa, más las globales del tema.
  const alcanzables = new Set([
    ...clasesDeclaradas(leer(monitoreoDir, "profiles", "profilePage.css")),
    ...clasesDeclaradas(leer(monitoreoDir, "shell", "monitoreoShell.css")),
    ...clasesDeclaradas(leer(aqui, "aulasMonitoreo.css")),
    ...clasesDeclaradas(leer(aqui, "registroDeCampo.css")),
    ...clasesDeclaradas(leer(monitoreoDir, "..", "..", "app", "theme.css")),
    ...clasesDeclaradas(leer(monitoreoDir, "..", "..", "app", "tokens.css")),
  ]);

  // El monolito que aulas NO importa.
  const soloEnElMonolito = clasesDeclaradas(leer(monitoreoDir, "monitoreo.css"));

  it("ninguna clase que pinta vive sólo en la hoja que no importa", () => {
    expect(usadas.size).toBeGreaterThan(50);
    const huerfanas = [...usadas]
      .filter((c) => soloEnElMonolito.has(c) && !alcanzables.has(c))
      .sort();
    expect(
      huerfanas,
      `clases declaradas sólo en monitoreo.css, que esta página no importa: ${huerfanas.join(", ")}`,
    ).toEqual([]);
  });
});
