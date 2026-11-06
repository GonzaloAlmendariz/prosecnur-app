import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { describe, expect, test } from "vitest";

/**
 * **Ningún ciclo entre chunks con nombre.**
 *
 * El 2026-10-28 el bundle de escritorio arrancaba hasta el 80 % y volvía al
 * selector con «Cannot access 'Al' before initialization» (BootGate atrapa el
 * error: no hay pageerror). En el grafo de MÓDULOS no había ciclo; lo había entre
 * CHUNKS: `manualChunks` ponía core/rotulosComunes en monitoreo-core, que
 * importaba de profiles/telefonico (monitoreo-telefonico), que importa de core.
 * Rollup evalúa un chunk antes que el otro y un `const` queda en TDZ. Dev no lo
 * ve (no hay chunks), por eso pasaba en dev y moría en el bundle (e2175c895).
 *
 * Este contrato aplica la `manualChunks` REAL (leída con loadConfigFromFile, sin
 * exportar nada de vite.config.ts) a cada módulo de src y falla si dos chunks
 * con nombre se importan mutuamente. Los chunks automáticos (sin regla) los
 * coloca Rollup y no entran: ahí no decide nadie a mano.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(SRC, "..");

type Grafo = Map<string, Set<string>>;

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules") return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(p);
    if (!/\.(ts|tsx)$/.test(e.name) || /\.test\.tsx?$/.test(e.name) || e.name.endsWith(".d.ts")) return [];
    return [p];
  });
}

// Imports y re-exports que existen en runtime: fuera `import type`,
// `export type` y las listas hechas sólo de `type X`.
const IMPORT = /^\s*(import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gms;

function soloTipos(cuerpo: string): boolean {
  const c = cuerpo.trim();
  if (!c.startsWith("{")) return false;
  const nombres = c.replace(/[{}]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
  return nombres.length > 0 && nombres.every((x) => x.startsWith("type "));
}

export function grafoDeModulos(lista: string[], leer: (f: string) => string = (f) => fs.readFileSync(f, "utf8")): Grafo {
  const conjunto = new Set(lista);
  const resolver = (desde: string, spec: string) => {
    if (!spec.startsWith(".")) return null;
    const base = path.resolve(path.dirname(desde), spec);
    for (const c of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx"), base]) {
      if (conjunto.has(c)) return c;
    }
    return null;
  };
  const g: Grafo = new Map();
  for (const f of lista) {
    const salidas = new Set<string>();
    for (const m of leer(f).matchAll(IMPORT)) {
      const [, verbo, cuerpo, spec] = m;
      if (verbo === "export" && !/^\s*[{*]/.test(cuerpo)) continue;
      if (soloTipos(cuerpo)) continue;
      const destino = resolver(f, spec);
      if (destino) salidas.add(destino);
    }
    g.set(f, salidas);
  }
  return g;
}

type Asignar = (id: string) => string | null | undefined;

/** Pares de chunks con nombre que se importan mutuamente, con una arista de módulo de ejemplo por sentido. */
export function ciclosEntreChunks(g: Grafo, chunkDe: Asignar): string[] {
  const ejemplo = new Map<string, string>();
  for (const [a, bs] of g) {
    const ca = chunkDe(a);
    if (!ca) continue;
    for (const b of bs) {
      const cb = chunkDe(b);
      if (!cb || ca === cb) continue;
      const clave = `${ca} -> ${cb}`;
      if (!ejemplo.has(clave)) ejemplo.set(clave, `${path.relative(SRC, a)} -> ${path.relative(SRC, b)}`);
    }
  }
  const ciclos: string[] = [];
  for (const [clave, arista] of ejemplo) {
    const [x, y] = clave.split(" -> ");
    const vuelta = ejemplo.get(`${y} -> ${x}`);
    if (vuelta && x < y) ciclos.push(`${clave} (${arista}) · ${y} -> ${x} (${vuelta})`);
  }
  return ciclos;
}

async function manualChunksReal(): Promise<Asignar> {
  const cargado = await loadConfigFromFile({ command: "build", mode: "development" }, path.join(RAIZ, "vite.config.ts"), RAIZ, "silent");
  const salida = cargado?.config.build?.rollupOptions?.output;
  const mc = (Array.isArray(salida) ? salida[0] : salida)?.manualChunks;
  if (typeof mc !== "function") throw new Error("vite.config.ts no expone manualChunks como función");
  return (id) => (mc as (id: string, meta: unknown) => string | null | undefined)(id, { getModuleInfo: () => null, getModuleIds: () => [][Symbol.iterator]() });
}

describe("chunks sin ciclos", () => {
  test("centinela: dos módulos en chunks distintos que se importan mutuamente se detectan", () => {
    const a = path.join(SRC, "features/x/a.ts");
    const b = path.join(SRC, "features/y/b.ts");
    const fuentes: Record<string, string> = {
      [a]: 'import { B } from "../y/b";\nexport const A = 1;',
      [b]: 'import { A } from "../x/a";\nimport type { Z } from "../x/a";\nexport const B = 2;',
    };
    const g = grafoDeModulos([a, b], (f) => fuentes[f]);
    const chunkDe: Asignar = (id) => (id.includes("/x/") ? "chunk-x" : "chunk-y");
    expect(ciclosEntreChunks(g, chunkDe)).toHaveLength(1);
    // Un import sólo de tipos no crea arista.
    fuentes[b] = 'import type { A } from "../x/a";\nexport const B = 2;';
    expect(ciclosEntreChunks(grafoDeModulos([a, b], (f) => fuentes[f]), chunkDe)).toEqual([]);
  });

  test("la manualChunks real no deja dos chunks con nombre importándose entre sí", async () => {
    const chunkDe = await manualChunksReal();
    const g = grafoDeModulos(archivos(SRC));
    expect(g.size).toBeGreaterThan(1000);
    expect(ciclosEntreChunks(g, chunkDe)).toEqual([]);
  }, 30_000);
});
