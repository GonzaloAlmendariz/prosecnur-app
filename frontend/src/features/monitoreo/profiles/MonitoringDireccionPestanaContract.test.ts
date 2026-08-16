import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Una dirección con pestaña tiene que aterrizar en esa pestaña, también cuando
 * llega desde otra sección.
 *
 * Los cuatro perfiles de Monitoreo recuerdan la pestaña por sección. Al pedir
 * `?seccion=X&pestana=Y` desde otra sección, la sección se aplica primero, la
 * pestaña activa pasa a ser la RECORDADA de X y se publica en la URL, pisando
 * la pedida. Medido en los cuatro antes de repararlo:
 *
 *   aulas         consultas/reemplazos  ->  aterrizaba en brechas
 *   acreditación  avance/detalle        ->  aterrizaba en resumen
 *   territorial   consultas/gps         ->  aterrizaba en duracion
 *
 * Lo que lo delataba como defecto y no como preferencia: la carga DIRECTA por
 * URL funcionaba en los cuatro. El mismo enlace, seguido desde dentro de la
 * app, no. La gramática v3 exige que toda vista sea enlazable, y media
 * enlazabilidad no lo es.
 */
const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const perfiles = [
  ["Aulas", "aulas/AulasMonitoreoPage.tsx"],
  ["Acreditación", "acreditacion/AcreditacionMonitoreoPage.tsx"],
  ["Telefónico", "telefonico/TelefonicoMonitoreoPage.tsx"],
  ["Territorial", "territorial/TerritorialMonitoreoPage.tsx"],
] as const;

function ast(relativePath: string) {
  const source = fs.readFileSync(path.join(profilesDir, relativePath), "utf8");
  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function llamadasA(node: ts.Node, nombre: string): number {
  let total = 0;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) total += 1;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return total;
}

describe("Monitoreo: la pestaña pedida por dirección se aplica con su sección", () => {
  test.each(perfiles)("%s lee la pestaña de la URL al cambiar de sección", (label, relativePath) => {
    const arbol = ast(relativePath);
    expect(
      llamadasA(arbol, "monitoreoPestanaDesdeParams"),
      `${label}: sin leer la pestaña de la URL, la recordada de la sección destino la pisa`,
    ).toBeGreaterThan(0);
  });

  test.each(perfiles)("%s exige que la sección de la URL coincida", (label, relativePath) => {
    const arbol = ast(relativePath);
    // Sin esta condición, un CLIC de sección aplicaría la pestaña que la URL
    // todavía trae de la sección anterior: válida por casualidad si las dos
    // secciones comparten un nombre de pestaña, y equivocada siempre.
    expect(
      llamadasA(arbol, "monitoreoSeccionDesdeParams"),
      `${label}: hay que distinguir «vengo de una dirección» de «vengo de un clic»`,
    ).toBeGreaterThan(0);
  });
});
