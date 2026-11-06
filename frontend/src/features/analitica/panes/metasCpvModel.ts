// Mapeo de las categorías de la base a las del CPV 2025 y metas resultantes.
//
// La meta de una categoría de la base es la suma de la población censada de
// las categorías del CPV que se le asignan. Lo que queda sin mapear se dice:
// una categoría de la base sin meta queda fuera del margen (el motor la avisa
// también) y una categoría del CPV sin destino saca su población del margen.

import type { CpvGrupoEdad, CpvMargen } from "../../../api/ponderacionCpv2025";

export type Mapeo = Record<string, string[]>;
export type CategoriaBase = { value: string; label: string };

export function normalizarRotulo(x: string): string {
  return x
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const SINONIMOS: Record<string, string[]> = {
  Hombre: ["hombre", "hombres", "masculino", "varon", "varones", "h", "m masculino"],
  Mujer: ["mujer", "mujeres", "femenino", "f"],
};

/** Propuesta inicial: mismo rótulo (o sinónimo de sexo) en la base y en el censo. */
export function sugerirMapeo(base: CategoriaBase[], margen: CpvMargen): Mapeo {
  const out: Mapeo = {};
  for (const c of base) {
    const rb = normalizarRotulo(c.label || c.value);
    const hit = margen.categorias.find((k) => {
      const rk = normalizarRotulo(k.etiqueta);
      return rk === rb || normalizarRotulo(k.codigo) === rb || (SINONIMOS[k.codigo] ?? []).includes(rb);
    });
    if (hit) out[c.value] = [hit.codigo];
  }
  return out;
}

export type ResultadoMapeo = {
  targets: Record<string, number>;
  /** Categorías de la base sin categoría del censo: quedan fuera del margen. */
  baseSinMapear: string[];
  /** Categorías del censo sin destino: su población no entra en la meta. */
  cpvSinMapear: string[];
  /** Categorías del censo asignadas a dos o más de la base: se contarían dos veces. */
  cpvRepetidas: string[];
  /** Población del censo que entra en las metas. */
  cubierta: number;
};

export function metasDesdeMapeo(base: CategoriaBase[], margen: CpvMargen, mapeo: Mapeo): ResultadoMapeo {
  const pob = new Map(margen.categorias.map((c) => [c.codigo, c.poblacion]));
  const usos = new Map<string, number>();
  const targets: Record<string, number> = {};
  const baseSinMapear: string[] = [];
  for (const c of base) {
    const cods = (mapeo[c.value] ?? []).filter((k) => pob.has(k));
    if (!cods.length) { baseSinMapear.push(c.value); continue; }
    targets[c.value] = cods.reduce((s, k) => s + (pob.get(k) ?? 0), 0);
    cods.forEach((k) => usos.set(k, (usos.get(k) ?? 0) + 1));
  }
  const cpvSinMapear = margen.categorias.filter((c) => !usos.has(c.codigo)).map((c) => c.codigo);
  const cpvRepetidas = [...usos].filter(([, n]) => n > 1).map(([k]) => k);
  const cubierta = margen.categorias.filter((c) => usos.has(c.codigo)).reduce((s, c) => s + c.poblacion, 0);
  return { targets, baseSinMapear, cpvSinMapear, cpvRepetidas, cubierta };
}

/** Avisos cortos del mapeo, con la causa. Vacío si el mapeo es completo. */
export function avisosDelMapeo(
  r: ResultadoMapeo, base: CategoriaBase[], margen: CpvMargen,
): { level: "warn" | "info"; message: string }[] {
  const rb = (v: string) => base.find((c) => c.value === v)?.label || v;
  const rc = (k: string) => margen.categorias.find((c) => c.codigo === k)?.etiqueta || k;
  const out: { level: "warn" | "info"; message: string }[] = [];
  if (r.baseSinMapear.length) {
    out.push({ level: "warn", message: `Sin meta: ${r.baseSinMapear.map(rb).join(", ")}. Esos casos quedan fuera del margen.` });
  }
  if (r.cpvSinMapear.length) {
    const pct = margen.total > 0 ? (100 * (margen.total - r.cubierta)) / margen.total : 0;
    out.push({ level: "warn", message: `Del censo sin asignar: ${r.cpvSinMapear.map(rc).join(", ")} (${pct.toFixed(1)} % de la población).` });
  }
  if (r.cpvRepetidas.length) {
    out.push({ level: "warn", message: `Asignadas a más de una categoría: ${r.cpvRepetidas.map(rc).join(", ")}. Su población se contaría dos veces.` });
  }
  return out;
}

/** Grupos de edad válidos: mínimo entero, máximo ≥ mínimo o abierto, sin superponerse. */
export function validarGruposEdad(g: CpvGrupoEdad[]): string | null {
  if (!g.length) return "Define al menos un grupo de edad.";
  if (g.some((x) => !Number.isInteger(x.min) || x.min < 0)) return "Cada grupo necesita una edad mínima.";
  if (g.some((x) => x.max != null && x.max < x.min)) return "Un grupo tiene la edad máxima menor que la mínima.";
  const o = [...g].sort((a, b) => a.min - b.min);
  for (let i = 1; i < o.length; i++) {
    if ((o[i - 1].max ?? Infinity) >= o[i].min) return "Los grupos se superponen.";
  }
  return null;
}

export function rotuloGrupoEdad(g: CpvGrupoEdad): string {
  return g.max == null ? `${g.min} a más` : `${g.min} a ${g.max}`;
}
