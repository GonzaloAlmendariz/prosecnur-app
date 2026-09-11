import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * **El inverso de `cssSinDuenoTests`: clases que un componente usa y ninguna
 * hoja estila.**
 *
 * Aquél vigila reglas huérfanas —CSS que sobrevive a su componente—. Este
 * vigila lo contrario, que es lo que de verdad se ve: una clase que se pinta en
 * pantalla sin una sola regla detrás.
 *
 * **Por qué hacía falta.** El 2026-09-11, al limpiar las reglas de una forma
 * vieja, un borrado por subcadena se llevó las once reglas de
 * `aulas-refuerzo-varas3` porque el patrón era `aulas-refuerzo-vara` y la otra
 * lo contiene. La tabla salió sin estilo —«Proyección actual50.5 % suyo» pegado
 * y sin alinear— y Gonzalo lo leyó como «parece que está roto». Toda la suite
 * estaba verde: el CSS no tiene quien lo compile, así que una hoja puede perder
 * la mitad sin que nada falle.
 *
 * **El tope es un trinquete, como los demás del perfil.** Hay clases que
 * legítimamente no llevan regla propia —las que sólo existen para que un test o
 * un selector las encuentre, y las que heredan todo de su contenedor—, así que
 * no se exige cero: se exige que el número no suba.
 */

const aqui = __dirname;
const TOPE = 60;

/** Las clases propias del perfil que declara alguna hoja de este directorio. */
function clasesConRegla(): Set<string> {
  const fuera = new Set<string>();
  for (const f of fs.readdirSync(aqui).filter((x) => x.endsWith(".css"))) {
    const css = fs.readFileSync(path.join(aqui, f), "utf8");
    for (const m of css.matchAll(/\.(aulas-[a-zA-Z0-9_-]+)/g)) fuera.add(m[1]);
  }
  return fuera;
}

/** Las clases propias que algún componente pinta. */
function clasesUsadas(): Map<string, string[]> {
  const usos = new Map<string, string[]>();
  const fuentes = fs.readdirSync(aqui)
    .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."));
  for (const f of fuentes) {
    const src = fs.readFileSync(path.join(aqui, f), "utf8")
      // Los comentarios citan clases al explicar por qué se retiró una.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const m of src.matchAll(/["'`\s]([a-z]*aulas-[a-zA-Z0-9_-]+)/g)) {
      const clase = m[1];
      if (!clase.startsWith("aulas-")) continue;
      usos.set(clase, [...(usos.get(clase) ?? []), f]);
    }
  }
  return usos;
}

describe("ninguna clase del perfil se pinta sin una regla que la estile", () => {
  it("no supera las clases sin regla medidas al escribir el guard", () => {
    const conRegla = clasesConRegla();
    const huerfanas: string[] = [];
    for (const [clase, archivos] of clasesUsadas()) {
      if (conRegla.has(clase)) continue;
      huerfanas.push(`${clase} (${archivos[0]})`);
    }
    expect(
      huerfanas.length,
      huerfanas.length > TOPE
        ? `Hay ${huerfanas.length} clases que se pintan sin regla (tope ${TOPE}). `
          + `Si vienes de borrar reglas, comprueba que el patrón no se llevó a un vecino `
          + `con prefijo común —«-vara» se lleva «-varas3»—:\n  ${huerfanas.slice(0, 14).join("\n  ")}`
        : "",
    ).toBeLessThanOrEqual(TOPE);
  });

  it("las clases de las superficies de relevo tienen su regla", () => {
    // Las que el borrado del 2026-09-11 se llevó, nombradas para que un
    // descuido igual vuelva a verse aquí y no en la pantalla de Gonzalo.
    const conRegla = clasesConRegla();
    for (const clase of [
      "aulas-refuerzo-varas3", "aulas-refuerzo-cubre", "aulas-refuerzo-carril",
      "aulas-reemplazo-varas3", "aulas-reemplazo-fila", "aulas-cadena-tira",
      "aulas-cam-uno", "aulas-cvf-rumbo", "aulas-llamada",
    ]) {
      expect(conRegla.has(clase), `${clase} no tiene ninguna regla`).toBe(true);
    }
  });
});
