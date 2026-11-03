import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P4 de la pasada de formato — una cifra que se pinta lleva separador de miles.**
 *
 * `{lista.length}` suelto en el JSX pinta «2373» donde la app escribe «2,373» (es-PE).
 * Un conteo que se ve pasa por `formatoConteo` (lib/formatoNumero.ts) o por
 * `toLocaleString("es-PE")`. Ratchet por archivo: sólo BAJA, y un archivo nuevo con
 * conteos crudos falla. Los `toFixed` no cuentan: en Material son razones de
 * contraste («4.5:1»), que no llevan millares.
 *
 * Foto del 3 nov 2026: conteos chicos que hoy no pasan de 999 (facultades, rutas,
 * reservas por aula); se migran cuando se toquen.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

const SNAPSHOT: Record<string, number> = {
  "ComposicionPorFacultad.tsx": 1,
  "PlanSection.tsx": 1,
  "campanas/ListaDeCampanas.tsx": 1,
  "correos/ColumnaDeBloques.tsx": 2,
  "correos/DialogoImportarHtml.tsx": 2,
  "correos/ListaDePuntos.tsx": 1,
  "correos/PanelRevision.tsx": 1,
  "correos/VistaParaRevision.tsx": 1,
  "correos/contactos/SelectorDeVariables.tsx": 1,
  "territorial/AsignacionEquipo.tsx": 2,
  "territorial/ExcelDeAsignacion.tsx": 1,
  "territorial/MaquetaDeHoja.tsx": 3,
  "territorial/PaquetesTerritoriales.tsx": 1,
};

export const CONTEO_CRUDO = /\{[A-Za-z_][\w.?]*\.length\}/g;

function componentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return componentes(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

function crudos(fuente: string): number {
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");
  return (codigo.match(CONTEO_CRUDO) ?? []).length;
}

describe("los conteos que se pintan llevan separador de miles (P4)", () => {
  const conteo = componentes(aqui).map((f) => [path.relative(aqui, f).split(path.sep).join("/"), crudos(readFileSync(f, "utf8"))] as const);

  it("el barrido ve los componentes (centinela)", () => {
    expect(conteo.length).toBeGreaterThan(100);
  });

  it("ningún componente suma conteos crudos ni aparece uno nuevo", () => {
    const regresiones = conteo
      .filter(([archivo, n]) => n > (SNAPSHOT[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[archivo] ?? 0} → ${n}`);
    expect(regresiones).toEqual([]);
  });

  it("el detector reconoce el conteo crudo y deja pasar el formateado", () => {
    expect(crudos("<b>{filas.length} filas</b>")).toBe(1);
    expect(crudos("<b>{formatoConteo(filas.length)} filas</b>")).toBe(0);
    expect(crudos("// {filas.length}")).toBe(0);
  });
});
