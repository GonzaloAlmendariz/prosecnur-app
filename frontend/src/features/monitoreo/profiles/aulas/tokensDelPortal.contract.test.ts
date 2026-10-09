import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * **Los tokens del perfil alcanzan a sus portales.**
 *
 * Los dos popovers de aulas se dibujan con `createPortal` a `document.body`,
 * porque tienen que escapar del `overflow` de la mesa. El precio es que salen
 * del alcance de `.mon-profile-page.is-aulas-flow`, que es donde viven
 * `--aulas-txt`, `--aulas-sec` y `--aulas-min`.
 *
 * Medido en vivo el 2026-09-11 con el popover de reemplazo abierto: dentro de
 * él los tres tokens resolvían a **cadena vacía**, así que cada
 * `font-size: var(--aulas-min)` era una declaración inválida y el popover
 * entero heredaba los 16 px del documento —además de una fila del grid
 * colapsada a 0 px, con el pie dibujándose detrás de la lista—.
 *
 * **Un `var()` que no resuelve no falla**: deja la propiedad sin poner, la
 * cascada sigue y nada lo denuncia. No hay test de render que lo vea, porque en
 * jsdom no hay cascada real. De ahí este contrato, que es de texto: la raíz de
 * cada portal tiene que aparecer en el bloque que declara los tokens.
 */

const aqui = __dirname;
const hoja = fs.readFileSync(path.join(aqui, "aulasMonitoreo.css"), "utf8");

/** La raíz de cada portal del perfil, tal como la nombra su hoja. */
const PORTALES = [".aulas-reemplazo-fondo", ".aulas-refuerzo-fondo"];

describe("los tokens del perfil alcanzan a sus portales", () => {
  const bloque = (() => {
    const i = hoja.indexOf("--aulas-txt:");
    expect(i, "el bloque de tokens del perfil existe").toBeGreaterThan(-1);
    // Desde la llave que abre ese bloque hacia atrás está su lista de
    // selectores; hacia delante, sus declaraciones.
    const abre = hoja.lastIndexOf("{", i);
    const cierraAnterior = Math.max(hoja.lastIndexOf("}", abre), hoja.lastIndexOf("*/", abre));
    return { selectores: hoja.slice(cierraAnterior + 1, abre), cuerpo: hoja.slice(abre, hoja.indexOf("}", i)) };
  })();

  it("el bloque declara los tres tamaños de la escala", () => {
    expect(bloque.cuerpo).toMatch(/--aulas-txt:\s*12px/);
    expect(bloque.cuerpo).toMatch(/--aulas-sec:\s*11px/);
    expect(bloque.cuerpo).toMatch(/--aulas-min:\s*10px/);
  });

  it.each(PORTALES)("%s está en la lista de selectores que recibe los tokens", (portal) => {
    expect(bloque.selectores).toContain(portal);
  });

  it("cada portal declarado existe de verdad como raíz en alguna hoja", () => {
    // Un selector en la lista que ya no exista protege tanto como no estar: la
    // superficie se renombró y el token volvería a no llegar.
    const hojas = fs.readdirSync(aqui).filter((f) => f.endsWith(".css"));
    const todo = hojas.map((f) => fs.readFileSync(path.join(aqui, f), "utf8")).join("\n");
    for (const portal of PORTALES) {
      // Se busca la clase como regla propia, no sólo dentro de la lista de
      // selectores del bloque de tokens.
      const suyo = new RegExp(`\\${portal}\\s*\\{`);
      expect(suyo.test(todo), `${portal} tiene su propia regla`).toBe(true);
    }
  });

  it("y cada portal lo usa un componente: un fondo sin dueño no se dibuja", () => {
    const fuentes = fs.readdirSync(aqui)
      .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."))
      .map((f) => fs.readFileSync(path.join(aqui, f), "utf8"))
      .join("\n");
    for (const portal of PORTALES) {
      expect(fuentes, `${portal} lo monta algún componente`).toContain(portal.slice(1));
    }
  });
});
