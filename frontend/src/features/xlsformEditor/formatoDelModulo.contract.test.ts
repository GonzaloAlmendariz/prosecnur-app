import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Formularios (4 nov 2026).** Receta de
 * `docs/qa/formato-formularios-2026-11-04.md`. P1 (letra por rol) ya lo cuida
 * `app/letraPorRol` con sus excepciones declaradas. Aquí, por archivo y sólo a la
 * baja hasta meta 0:
 *
 * - P3: el punto medio no es un separador. Una lista va con coma o «y», un dato que
 *   acompaña entre paréntesis.
 * - P4: las cifras van por `lib/formatoNumero` (sin `toFixed` ni `toLocaleString`
 *   de cifra a mano).
 * - P5: el vacío es `EstadoVacio` y la carga `LoadingBlock`, no una receta propia.
 *   Quedan declarados el simulador (imita el formulario en el dispositivo) y el
 *   esqueleto de carga de la campaña (una carga con forma, no una receta), y la
 *   condición guiada sin preguntas previas de `LogicBuilder` (ilustración y dos acciones).
 *   `pulso-catalogchip-empty` es el botón «Asignar lista» del chip (su clase vive en
 *   `app/theme.css`), no un vacío. Los `pulso-graph-*` son superposiciones del lienzo de
 *   lógica con ilustración y acciones, sobre el canvas. `pulso-xf-imp-previa-vacia` es el error de
 *   la previa con «Reintentar» (`ErrorBlock` no lleva acción), `pulso-md-empty` es HTML de la previa
 *   de markdown y `settings-*-empty` un id de diagnóstico. Los `is-*` son modificadores de estado
 *   sobre un elemento que ya existe, no un vacío con receta.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

function lineas(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""))
    .map((l) => l.replace(/\{\/\*.*?\*\/\}/g, ""));
}

const PUNTO = (l: string) => (l.includes("·") ? 1 : 0);
const CIFRA_A_MANO = /toFixed\(|toLocaleString\(\)|toLocaleString\("es-PE"(?:, \{ maximumFractionDigits: [^}]+\})?\)/g;
const RECETA = /(?<![-\w])(?!data-)[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:empty|emptylist|vacio|vacia|loading|cargando)(?![-\w])/g;
/** Imitan el formulario en el dispositivo o son una carga con forma: no son recetas del módulo. */
const RECETA_DECLARADA = /^pulso-xfsim-|^pulso-xf-campana-(?:cargando|esqueleto)|^pulso-logic-builder-guided-empty$|^pulso-catalogchip-empty$|^pulso-graph-|^pulso-xf-imp-previa-vacia$|^pulso-md-empty$|^settings-[a-z-]+-empty$|^is-/;

const cuenta = (re: RegExp, filtro?: (m: string) => boolean) => (l: string) =>
  [...l.matchAll(re)].map((m) => m[0]).filter((m) => !filtro || filtro(m)).length;

function medir(contar: (l: string) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = lineas(readFileSync(f, "utf8")).reduce((s, l) => s + contar(l), 0);
    if (n > 0) out[rel(f)] = n;
  }
  return out;
}

/** Foto del 4 nov 2026 después de la tanda de `shell/`. Sólo baja. */
const SNAPSHOT_P3: Record<string, number> = {
  "impreso/MaquetaPagina.tsx": 1,
  "pestanas/armador/armadorModelo.ts": 1,
  "reglas/acnurEs.fixture.ts": 1,
};
const SNAPSHOT_P4: Record<string, number> = {
  "kit/Sello.tsx": 1,
};
const SNAPSHOT_P5: Record<string, number> = {};

/**
 * P6 (4 nov 2026, decidido por coordinación, revisable por Gonzalo): sólo las píldoras que dicen un
 * ESTADO pasan a `EstadoChip` — el estado de cada filtro de opciones, «ya tiene filtro», «nunca
 * visible», las insignias de Restricciones y Cálculos y el contador de «Qué falta para publicar».
 * Se quedan los chips de tipo, de dato (los códigos huérfanos de la matriz de cascada) y del simulador,
 * y «Activo», que es identidad del módulo.
 */
const PILDORA_DE_ESTADO = /\bxfp-insignia\b|\bpulso-xf-res-contador\b|\bxcf-chip__punto\b|\bxcf-chip is-(?:ok|vacia|conflicto|sin-vista)\b|xcf-chip is-\$\{|xcf-chip is-nunca[^"]*">(?:ya tiene filtro|nunca visible)/g;

function regresiones(actual: Record<string, number>, foto: Record<string, number>) {
  return Object.entries(actual).filter(([f, n]) => n > (foto[f] ?? 0)).map(([f, n]) => `${f}: ${foto[f] ?? 0} → ${n}`);
}
function viejos(actual: Record<string, number>, foto: Record<string, number>) {
  return Object.entries(foto).filter(([f, n]) => (actual[f] ?? 0) < n).map(([f, n]) => `${f}: ${n} → ${actual[f] ?? 0}`);
}

describe("formato de Formularios", () => {
  const p3 = medir(PUNTO);
  const p4 = medir(cuenta(CIFRA_A_MANO));
  const p5 = medir(cuenta(RECETA, (m) => !RECETA_DECLARADA.test(m)));

  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui).length).toBeGreaterThan(300);
  });

  it('P3: ningún archivo suma " · "', () => {
    expect(regresiones(p3, SNAPSHOT_P3), 'Une con coma o con "y"; lo que acompaña, entre paréntesis.').toEqual([]);
  });
  it("P4: ninguna cifra nueva se formatea a mano", () => {
    expect(regresiones(p4, SNAPSHOT_P4), "Usa formatoConteo o formatoDecimal de lib/formatoNumero.").toEqual([]);
  });
  it("P5: ningún vacío ni carga nuevo con receta propia", () => {
    expect(regresiones(p5, SNAPSHOT_P5), "Usa EstadoVacio o LoadingBlock del kit.").toEqual([]);
  });
  it("P6: un estado es EstadoChip, no una píldora propia", () => {
    expect(medir(cuenta(PILDORA_DE_ESTADO)), "Usa EstadoChip del kit.").toEqual({});
  });
  it("P2: los bloques del Resumen son Panel del kit, sin cabecera propia", () => {
    expect(medir(cuenta(/\bpulso-xf-res-panel-cabeza\b/g)), "Usa Panel (title y actions).").toEqual({});
  });
  it("las fotos no guardan conteos que ya bajaron", () => {
    expect([...viejos(p3, SNAPSHOT_P3), ...viejos(p4, SNAPSHOT_P4), ...viejos(p5, SNAPSHOT_P5)], "Baja la foto: es un ratchet.").toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(PUNTO("`${a} · ${b}`")).toBe(1);
    expect(cuenta(CIFRA_A_MANO)("(x * 100).toFixed(0)")).toBe(1);
    expect(cuenta(CIFRA_A_MANO)('d.toLocaleString("es-PE", { day: "2-digit" })')).toBe(0);
    expect(cuenta(RECETA)('<p className="pulso-xf-res-vacio">')).toBe(1);
    expect(cuenta(PILDORA_DE_ESTADO)('<span className={`xcf-chip is-${estado.clase}`}>')).toBe(1);
    expect(cuenta(PILDORA_DE_ESTADO)('<span className="xcf-chip is-nunca">ya tiene filtro</span>')).toBe(1);
    expect(cuenta(PILDORA_DE_ESTADO)('<span className="xcf-chip">{NOMBRE_TIPO[f.tipo]}</span>')).toBe(0);
    // Los códigos huérfanos de la matriz son datos con tono de aviso, no un estado: se quedan.
    expect(cuenta(PILDORA_DE_ESTADO)('<span key={h} className="xcf-chip is-nunca is-mini">{h}</span>')).toBe(0);
    expect(cuenta(PILDORA_DE_ESTADO)('<span className="xcf-chip is-nunca is-mini">nunca visible</span>')).toBe(1);
    expect(cuenta(RECETA)('<div data-estado-vacio="compacto">')).toBe(0);
    expect(cuenta(RECETA, (m) => !RECETA_DECLARADA.test(m))('<div className="pulso-xfsim-empty">')).toBe(0);
  });
});
