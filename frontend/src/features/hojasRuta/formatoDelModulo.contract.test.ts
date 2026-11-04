import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Hojas de ruta (4 nov 2026), con meta 0.** El « · » ya lo
 * cuida `puntoMedio.contract` (9e07233ef). Aquí, lo demás de la receta de
 * `docs/qa/formato-hojas-ruta-2026-11-04.md`:
 *
 * - P1: la letra va por rol (`var(--pulso-type-<rol>-size)`); había 174 `font-size`
 *   en px y Hojas de ruta no estaba en `app/letraPorRol`. Se declara la cifra héroe
 *   del resultado de Muestra (30 px, 24 px bajo 1280), que el rol `kpi` (21) achicaría.
 * - P4: las cifras van por `lib/formatoNumero`. Quedan los decimales FIJOS
 *   (`minimumFractionDigits`: «±3.0 %», «DEFF 1.5»), que el formateador no ofrece, y las
 *   fechas. La coma decimal escrita a mano (`.replace(".", ",")`) no vuelve: es-PE usa punto.
 * - P5: el vacío es `EstadoVacio`, la carga `LoadingBlock` y el error `ErrorBlock`.
 * - P6: un estado con tono es `EstadoChip` (el de la ruta en el inspector, la columna
 *   Revisión de la evidencia y, desde el 4 nov a mediodía, el del envío a Material de campo).
 * - P2: los cajones inferiores de Población, Muestra y Selección son `Panel` del kit. Los grupos
 *   del inspector (`hr-muestra-grupo`) son divisiones de una columna, no cajas, y el lienzo con
 *   sus controles flotantes es banco de trabajo propio (ver el doc).
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo, ext);
    return ext.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

function lineas(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
}

function hallazgos(ext: RegExp, cuenta: (l: string) => string[]): string[] {
  return archivos(aqui, ext).flatMap((f) =>
    lineas(readFileSync(f, "utf8")).flatMap((l, i) => cuenta(l).map((x) => `${rel(f)}:${i + 1} ${x}`)),
  );
}

const todas = (re: RegExp) => (l: string) => [...l.matchAll(re)].map((m) => m[0]);

const PX = /font-size\s*:\s*\d+(?:\.\d+)?px/g;
/** La cifra héroe del resultado de Muestra: 30 px y 24 px bajo 1280. */
const PX_DECLARADO = /\.hr-muestra-resultado > strong/;
/** Un `toLocaleString` de cifra: sin opciones o sólo con máximo de decimales. */
const CIFRA_A_MANO = /toLocaleString\("es-PE"(?:, \{ maximumFractionDigits: [^}]+\})?\)/g;
const COMA_DECIMAL = /\.replace\("\.", ","\)/g;
const RECETA = /(?<!-)\bhr-[a-z0-9]+(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;
const PILDORA = /\bhr-(?:sel-estado|revision-estado)\b|<strong>\{estado === "desactualizado" \?/g;
/** P2: un cajón inferior de sección (`hr-sel-cajon`) se monta con `Panel`, no con un `<section>` propio. */
const CAJON_PROPIO = /<section className="hr-sel-cajon"/g;

describe("formato de Hojas de ruta", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(80);
  });

  it("P1: ninguna hoja escribe font-size en px fuera de la cifra héroe declarada", () => {
    expect(hallazgos(/\.css$/, (l) => (PX_DECLARADO.test(l) ? [] : todas(PX)(l))), "Usa var(--pulso-type-<rol>-size).").toEqual([]);
  });

  it("P4: ninguna cifra se formatea a mano", () => {
    expect(hallazgos(/\.tsx?$/, todas(CIFRA_A_MANO)), "Usa formatoConteo o formatoDecimal.").toEqual([]);
    expect(hallazgos(/\.tsx?$/, todas(COMA_DECIMAL)), "es-PE usa punto decimal.").toEqual([]);
  });

  it("P5: ningún vacío ni carga con receta propia", () => {
    expect(hallazgos(/\.(tsx|ts|css)$/, todas(RECETA)), "Usa EstadoVacio, LoadingBlock o ErrorBlock del kit.").toEqual([]);
  });

  it("P6: un estado con tono es EstadoChip", () => {
    expect(hallazgos(/\.(tsx|css)$/, todas(PILDORA))).toEqual([]);
  });

  it("P2: los cajones de sección son Panel del kit", () => {
    expect(hallazgos(/\.tsx$/, todas(CAJON_PROPIO)), "Usa components/Panel con className=\"hr-sel-cajon\".").toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(todas(PX)(".a { font-size: 12.5px; }")).toHaveLength(1);
    expect(todas(CIFRA_A_MANO)('n.toLocaleString("es-PE", { maximumFractionDigits: 1 })')).toHaveLength(1);
    expect(todas(CIFRA_A_MANO)('n.toLocaleString("es-PE", { minimumFractionDigits: 1 })')).toHaveLength(0);
    expect(todas(CIFRA_A_MANO)('d.toLocaleString("es-PE", { day: "2-digit" })')).toHaveLength(0);
    expect(todas(COMA_DECIMAL)('String(v).replace(".", ",")')).toHaveLength(1);
    expect(todas(RECETA)('<p className="hr-mapa-vacio">')).toEqual(["hr-mapa-vacio"]);
    expect(todas(RECETA)("color: var(--hr-texto-vacio)")).toEqual([]);
    expect(todas(PILDORA)('<strong>{estado === "desactualizado" ? "Cambió" : "Enviada"}</strong>')).toHaveLength(1);
    expect(todas(PILDORA)('{estado === "desactualizado" ? <strong>Cambió.</strong> : null}')).toHaveLength(0);
    expect(todas(CAJON_PROPIO)('<section className="hr-sel-cajon" aria-label="x">')).toHaveLength(1);
    expect(todas(CAJON_PROPIO)('<Panel className="hr-sel-cajon" title="x">')).toHaveLength(0);
  });
});
