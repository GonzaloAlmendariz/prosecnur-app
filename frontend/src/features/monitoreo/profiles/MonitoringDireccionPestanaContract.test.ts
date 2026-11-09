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
  ["Acreditación", "acreditacion/AcreditacionMonitoreoPage.tsx"],
  ["Telefónico", "telefonico/TelefonicoMonitoreoPage.tsx"],
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
      `${label}: hay que distinguir "vengo de una dirección" de "vengo de un clic"`,
    ).toBeGreaterThan(0);
  });
});

/**
 * Territorial guarda como estado la dirección PÚBLICA completa (sección,
 * pestaña y sub-vista) desde el revamp del esqueleto común: no hay pestaña
 * recordada por sección que pueda pisar la pedida. Lo que se exige es que lea
 * la dirección entera de la URL y la resuelva con su tabla, alias incluidos.
 */
test("Territorial resuelve la dirección pedida entera, con su tabla de alias", () => {
  const arbol = ast("territorial/TerritorialMonitoreoPage.tsx");
  expect(llamadasA(arbol, "useMonitoreoDireccionTraducida")).toBe(1);
  expect(llamadasA(arbol, "monitoreoDireccionDesdeParams")).toBeGreaterThan(0);
  expect(llamadasA(arbol, "direccionPedida")).toBeGreaterThan(0);
  expect(llamadasA(arbol, "pideOtraDireccion")).toBeGreaterThan(0);
});

/**
 * Cursos-horario, igual que Territorial desde el revamp del esqueleto común
 * (2026-10-23): la página guarda la dirección PÚBLICA y la resuelve con su
 * tabla, alias incluidos (`?seccion=consultas&pestana=reemplazos` lleva a
 * Modelo › Muestra). La lectura vive en `navegacion/useDireccionAulas.ts`, fuera
 * de la página congelada.
 */
test("Cursos-horario resuelve la dirección pedida entera, con su tabla de alias", () => {
  const hook = ast("aulas/navegacion/useDireccionAulas.ts");
  expect(llamadasA(hook, "useMonitoreoDireccionTraducida")).toBe(1);
  expect(llamadasA(hook, "monitoreoDireccionDesdeParams")).toBeGreaterThan(0);
  expect(llamadasA(hook, "direccionPedida")).toBeGreaterThan(0);
  expect(llamadasA(hook, "pideOtraDireccion")).toBeGreaterThan(0);
  const pagina = ast("aulas/AulasMonitoreoPage.tsx");
  expect(llamadasA(pagina, "useDireccionAulas")).toBe(1);
  // La página no vuelve a sincronizar la URL por su cuenta.
  expect(llamadasA(pagina, "useMonitoreoDireccion")).toBe(0);
});
