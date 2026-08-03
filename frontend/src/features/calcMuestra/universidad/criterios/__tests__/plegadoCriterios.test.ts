import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ORDEN_PLEGADO_INICIAL, siguienteOrden } from "../usarPlegado";

/**
 * G39 · Plegar y desplegar todos los criterios.
 *
 * Gonzalo: «Composición del curso-horario es el único criterio que no tiene la
 * habilidad de comprimirse cuando debería; si bien todos están abiertos por
 * defecto, también deberían poder comprimirse, y arriba debe haber un botón para
 * comprimir todos o descomprimir todos de forma elegante».
 */
describe("la orden de plegado", () => {
  it("no fuerza nada antes de la primera pulsación", () => {
    // Versión negativa = «nadie ha pulsado». Si el hook obedeciera desde el
    // arranque, una tarjeta que abre por defecto se plegaría sola al montarse
    // sólo porque existe un control en la página.
    expect(ORDEN_PLEGADO_INICIAL.version).toBeLessThan(0);
  });

  it("la versión avanza aunque el booleano repita", () => {
    /*
     * El sello. Sin él, esta secuencia se rompe y es la más natural de todas:
     * plegar todos → abrir una tarjeta a mano → plegar todos otra vez.
     *
     * En la segunda pulsación `abierto` volvería a ser el mismo valor, el efecto
     * de la tarjeta no reaccionaría, y el botón parecería roto justo cuando el
     * usuario más lo necesita.
     */
    const a = siguienteOrden(ORDEN_PLEGADO_INICIAL);
    const b = siguienteOrden(a);
    const c = siguienteOrden(b);
    expect(a.version).toBeLessThan(b.version);
    expect(b.version).toBeLessThan(c.version);
    // Alterna, así que la primera y la tercera piden lo mismo con distinta versión.
    expect(a.abierto).toBe(c.abierto);
    expect(a.version).not.toBe(c.version);
  });
});

describe("ningún criterio se queda sin obedecer", () => {
  /*
   * El guard que habría ahorrado la segunda pasada.
   *
   * Migré los cinco criterios del bloque a `usarPlegado` y al medir en la app
   * salieron **5 de 6** plegados: «Cursos-horario del marco» seguía abierto
   * porque su tarjeta vive en otro archivo y mi `grep` estaba acotado al
   * directorio donde estaban los demás.
   *
   * Es el mismo error que Gonzalo ya me corrigió dos veces —reparar lo que
   * aparece en vez de enumerar la clase entera—, así que aquí la clase se
   * enumera sola: cualquier tarjeta de esta zona que guarde su estado de
   * apertura con `useState` en vez del hook compartido deja de obedecer al
   * control global, y este caso la nombra.
   */
  const RAIZ = join(__dirname, "..", "..");
  const ZONAS = ["criterios", "marco"];

  function fuentes(dir: string): string[] {
    const out: string[] = [];
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.name === "__tests__") continue;
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) out.push(...fuentes(ruta));
      else if (entrada.name.endsWith(".tsx")) out.push(ruta);
    }
    return out;
  }

  it("ninguna tarjeta que abre por defecto se guarda su estado por su cuenta", () => {
    /*
     * La marca es **abrir por defecto**, y distinguirla importa.
     *
     * Mi primera versión buscaba cualquier `[abierto, setAbierto] = useState(` y
     * señaló dos falsos positivos: el botón de preset y el detalle de tipo de
     * sesión. Los dos arrancan en `false` porque **no son parte de la
     * superficie**: son un panel y un detalle que el usuario abre. «Plegar
     * todos» no tiene nada que decirles — plegarlos sería cerrar algo que nadie
     * había abierto.
     *
     * Lo que sí participa del plegado global es lo que ya está desplegado en la
     * página: `useState(true)`. Esa es la clase que hay que enumerar, y por eso
     * el guard mira el valor inicial y no sólo el nombre.
     */
    const culpables: string[] = [];
    for (const zona of ZONAS) {
      for (const archivo of fuentes(join(RAIZ, zona))) {
        const src = readFileSync(archivo, "utf8");
        if (/const \[abierto, setAbierto\] = useState\(\s*true\s*\)/.test(src)) {
          culpables.push(archivo.slice(RAIZ.length + 1));
        }
      }
    }
    expect(culpables).toEqual([]);
  });
});
