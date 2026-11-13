import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dos defectos que se vieron en pantalla (2026-11-13):
 * - un atributo JSX escrito como cadena con llaves (`hint="… {fmtInt(x)} …"`)
 *   pinta las llaves literales en vez de la cifra;
 * - la tabla de Cursos-horario requeridos tenía 7 cabeceras y 8 celdas por fila,
 *   así que reemplazos y total quedaban bajo un rótulo ajeno.
 */
const RAIZ = join(__dirname, "..", "..");

function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosTsx(ruta);
    return nombre.endsWith(".tsx") && !nombre.includes(".test.") ? [ruta] : [];
  });
}

describe("rótulos y tablas de Cálculo de muestra", () => {
  it("ningún atributo de texto lleva una expresión entre llaves dentro de comillas", () => {
    const patron = /\b(?:hint|title|label|aria-label|placeholder|detalle)="[^"]*\{[A-Za-z_$][\w$.]*\([^"]*"/;
    const hallazgos = archivosTsx(RAIZ).flatMap((ruta) =>
      readFileSync(ruta, "utf8")
        .split("\n")
        .map((linea, i) => (patron.test(linea) ? `${ruta.slice(RAIZ.length + 1)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("Cursos-horario requeridos pinta tantas celdas por fila como cabeceras", () => {
    const fuente = readFileSync(join(__dirname, "CalculoCursosHorarioFacultadTab.tsx"), "utf8");
    const tabla = fuente.slice(fuente.indexOf('className="cmv2-table cmv2-table--university cmv2-ch-tabla"'));
    const thead = tabla.slice(tabla.indexOf("<thead>"), tabla.indexOf("</thead>"));
    const fila = tabla.slice(tabla.indexOf("<tr key={fila.estrato}>"), tabla.indexOf("</tr>", tabla.indexOf("<tr key={fila.estrato}>")));
    const cabeceras = (thead.match(/<th\b/g) ?? []).length;
    const celdas = (fila.match(/<td\b/g) ?? []).length;
    expect(cabeceras).toBeGreaterThan(0);
    expect(celdas).toBe(cabeceras);
  });
});
