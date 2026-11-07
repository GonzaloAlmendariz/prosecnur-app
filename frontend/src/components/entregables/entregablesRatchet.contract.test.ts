import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Ratchet de entregas propias** (ADR 0133, fase 4 de «descargas unificadas»).
 *
 * La espera, el nombre, la carpeta y las acciones de un archivo entregado viven
 * en el kit (`components/entregables`: `useGeneracion` + `ContenedorEntregable`).
 * Cuenta los archivos de `src/` (sin tests ni el kit) que todavía hacen su
 * propia entrega —descargan con `downloadUrl(` o `descargarArchivo(`, abren el
 * diálogo `saveEntregableDialog` o guardan con `apiSaveEntregable(` /
 * `apiSaveFileAs(`— y sólo deja que el número baje. Al migrar un flujo al kit
 * (fase 5) se baja `BASE`.
 *
 * Fase 4: migraron los pilotos, el pie «Generar» de Analítica (PaneKit) y el menú
 * «Exportar» de Gráficos (BASE 41 el 2026-11-07). Las definiciones (`api/core.ts`, `lib/descargas.ts`,
 * `api/workspace.ts`) no cuentan: no entregan, ofrecen la función.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const KIT = "components/entregables/";

/** Llamadas que entregan un archivo por cuenta propia. */
const ENTREGA = /\b(?:downloadUrl|descargarArchivo|apiSaveEntregable|apiSaveFileAs)\s*\(|\.saveEntregableDialog\s*\(|\bsaveEntregableDialog\s*\?\.\s*\(/;
/** La declaración de la función no es un uso. */
const DEFINICION = /\b(?:function|const)\s+(?:downloadUrl|descargarArchivo|apiSaveEntregable|apiSaveFileAs)\b/;

/** Foto tras los pilotos de la fase 4. Sólo baja. */
const BASE = 41;

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [completo] : [];
  });
}

export function entregaPorCuentaPropia(fuente: string): boolean {
  const codigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""))
    .filter((l) => !DEFINICION.test(l))
    .join("\n");
  return ENTREGA.test(codigo);
}

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");

describe("entregas por cuenta propia (fuera del kit de entregables)", () => {
  const archivos = fuentes(SRC);
  const conEntrega = archivos
    .filter((f) => !rel(f).startsWith(KIT))
    .filter((f) => entregaPorCuentaPropia(readFileSync(f, "utf8")))
    .map(rel)
    .sort();

  it("el barrido ve el árbol (centinela)", () => {
    expect(archivos.length).toBeGreaterThan(500);
  });

  it("el detector reconoce cada forma y no confunde la definición ni los comentarios", () => {
    expect(entregaPorCuentaPropia("descargarArchivo(downloadUrl(id), n);")).toBe(true);
    expect(entregaPorCuentaPropia("const t = await window.prosecnurApi!.saveEntregableDialog({});")).toBe(true);
    expect(entregaPorCuentaPropia("await api.saveEntregableDialog?.({});")).toBe(true);
    expect(entregaPorCuentaPropia("await apiSaveEntregable(id, n);")).toBe(true);
    expect(entregaPorCuentaPropia("export function downloadUrl(file_id: string) {")).toBe(false);
    expect(entregaPorCuentaPropia("// descargarArchivo(url)\nconst a = 1;")).toBe(false);
    expect(entregaPorCuentaPropia("saveEntregableDialog: (opts: X) => Promise<string>;")).toBe(false);
  });

  it(`no crece: ${BASE} archivos como máximo`, () => {
    expect(conEntrega.length, `Archivos que entregan por su cuenta (usa components/entregables):\n${conEntrega.join("\n")}`)
      .toBeLessThanOrEqual(BASE);
  });

  it("la base no guarda un número que ya bajó", () => {
    expect(conEntrega.length, "Baja BASE a lo que mide el barrido.").toBe(BASE);
  });

  it("los pilotos de la fase 4 entregan por el kit", () => {
    expect(conEntrega).not.toContain("features/analitica/PaneKit.tsx");
    expect(conEntrega).not.toContain("features/graficos/ExportarInformeMenu.tsx");
  });
});
