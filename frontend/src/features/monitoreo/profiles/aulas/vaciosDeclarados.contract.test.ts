import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const aulasDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * **Un panel que se queda sin datos sigue siendo un miembro de su grupo.**
 *
 * El defecto apareció CUATRO veces en componentes distintos, siempre igual: la
 * rama con datos declaraba `data-qa-geometry-capacity` y la rama vacía no. Con
 * el panel vacío, el único miembro visible del grupo pasa a ser el encabezado
 * de la sección, y el gate canta `capacity-drift` sobre sus 4–5 px de padding
 * —un síntoma que no se parece en nada a su causa—.
 *
 * Sólo salta con el fixture que produce el vacío, así que cuatro fixtures
 * distintos lo destaparon en cuatro momentos distintos. Este guard lo ve en
 * todos a la vez y tarda milisegundos.
 */

/** Componentes que declaran capacidad en alguna rama: se les exige en todas. */
function declaraCapacidad(fuente: string): boolean {
  return fuente.includes('data-qa-geometry-capacity="owned"');
}

/**
 * Ramas de retorno cuyo elemento raíz es un `<p className="mon-profile-muted">`
 * —la forma canónica del estado vacío en este perfil— sin declarar.
 */
function vaciosSinDeclarar(fuente: string): number {
  const re = /return \(\s*(?:\{?\s*\/\*[\s\S]*?\*\/\s*\}?\s*)*<p className="mon-profile-muted"(?![^>]*data-qa-geometry-member)/g;
  return (fuente.match(re) ?? []).length;
}

describe("el vacío de un panel declara lo mismo que su rama con datos", () => {
  const archivos = readdirSync(aulasDir).filter(
    (f) => f.startsWith("Aulas") && f.endsWith(".tsx") && !f.includes(".test."),
  );

  test("hay componentes que revisar", () => {
    expect(archivos.length).toBeGreaterThan(10);
  });

  test("ningún componente con capacidad declarada deja su estado vacío sin declarar", () => {
    const culpables = archivos.flatMap((archivo) => {
      const fuente = readFileSync(path.join(aulasDir, archivo), "utf8");
      if (!declaraCapacidad(fuente)) return [];
      const n = vaciosSinDeclarar(fuente);
      return n > 0 ? [`${archivo} (${n})`] : [];
    });
    expect(culpables).toEqual([]);
  });

  test("el detector reconoce un vacío sin declarar", () => {
    // El control del test anterior: si no distinguiera las dos formas, un
    // `expect([])` pasaría con el guard roto.
    const malo = 'return (\n      <p className="mon-profile-muted">\n        nada\n      </p>';
    const bueno = 'return (\n      <p className="mon-profile-muted" data-qa-geometry-member="true">\n        nada\n      </p>';
    expect(vaciosSinDeclarar(malo)).toBe(1);
    expect(vaciosSinDeclarar(bueno)).toBe(0);
  });
});
