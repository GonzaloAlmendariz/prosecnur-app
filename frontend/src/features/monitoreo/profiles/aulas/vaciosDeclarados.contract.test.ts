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
  // **La clase puede llevar sufijo.** El patrón exigía `className="mon-profile-muted"`
  // EXACTO y `AulasTablasDeAvance` escribe `"mon-profile-muted aulas-tav-vacio"`,
  // así que sus TRES ramas vacías —error, cargando y sin tablas— se le
  // escapaban; el gate visual las cazó como `capacity-drift` en «Así se verá el
  // libro», que es el síntoma que no se parece a su causa. Un guard que exige la
  // clase a secas deja fuera a quien añade una suya, que es lo normal.
  const re = /return \(?\s*(?:\{?\s*\/\*[\s\S]*?\*\/\s*\}?\s*)*<p className="mon-profile-muted[^"]*"(?![^>]*data-qa-geometry-member)/g;
  // **El vacío del kit tampoco escapa** (P5 de la pasada de formato). Desde que
  // el vacío va por `EstadoVacio`, la rama vacía ya no es un `<p>`: y como el
  // componente no acepta atributos `data-*`, devolverlo SIN envoltorio deja la
  // rama sin declarar aunque nadie escriba la clase vieja. Sólo cuenta el
  // retorno de un componente (sangría de 2 a 4): una pista dentro de un bloque
  // —el detalle de la malla, en una IIFE— no es miembro de ningún grupo.
  const kit = /^ {2,4}return \(?\s*(?:\{?\s*\/\*[\s\S]*?\*\/\s*\}?\s*)*<EstadoVacio\b/gm;
  return (fuente.match(re) ?? []).length + (fuente.match(kit) ?? []).length;
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
    const kitSuelto = "    return (\n      <EstadoVacio icono={null} titulo=\"nada\" />";
    const kitEnvuelto = "    return (\n      <div data-qa-geometry-member=\"true\">\n        <EstadoVacio icono={null} titulo=\"nada\" />";
    expect(vaciosSinDeclarar(kitSuelto)).toBe(1);
    expect(vaciosSinDeclarar(kitEnvuelto)).toBe(0);
    expect(vaciosSinDeclarar("          return (\n            <EstadoVacio icono={null} titulo=\"pista\" />")).toBe(0);
  });
});
