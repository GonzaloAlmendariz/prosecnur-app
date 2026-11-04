import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { CIUDADES, LIMA, ciudadDeUbigeo } from "./ciudades";

import { formatoDecimal } from "../../../../lib/formatoNumero";
/**
 * Provincias del registro de territorios (ADR 0119). Lima y Callao van primero, como siempre;
 * las ciudades siguen por nombre. El marco contra el que se lee un porcentaje es el de las
 * provincias tocadas, nunca la suma del país: con ciudades, «% del marco» contra el total
 * dejaba a Lima con una cifra menor que la real.
 */

export type GrupoProvincia = {
  id: string;
  etiqueta: string;
  nivel: string | null;
  filas: HojasRutaTerritory[];
};

const ORDEN_FIJO: Record<string, number> = { LIMA: 0, CALLAO: 1 };

const titulo = (s: string) =>
  s
    .toLocaleLowerCase("es-PE")
    .split(/\s+/)
    .map((p) => (["de", "del", "la", "las", "los", "y"].includes(p) ? p : p.charAt(0).toLocaleUpperCase("es-PE") + p.slice(1)))
    .join(" ");

export function claveProvincia(t: Pick<HojasRutaTerritory, "provincia" | "provincia_codigo">): string {
  return t.provincia_codigo || t.provincia;
}

export function etiquetaProvincia(t: Pick<HojasRutaTerritory, "provincia" | "departamento"> & { ubigeo?: string }): string {
  if (t.provincia === "LIMA" && t.departamento === "LIMA") return "Lima Metropolitana";
  if (t.provincia === "CALLAO") return "Callao";
  // La provincia de una ciudad del atlas se nombra como la ciudad: Tarapoto, no «San Martín» (Gonzalo, 2026-10-30).
  const codigoCiudad = t.ubigeo ? ciudadDeUbigeo(t.ubigeo) : null;
  const ciudad = codigoCiudad && codigoCiudad !== LIMA ? CIUDADES.find((c) => c.codigo === codigoCiudad)?.nombre : undefined;
  const prov = ciudad ?? titulo(t.provincia);
  return t.departamento && t.departamento !== t.provincia ? `${prov}, ${titulo(t.departamento)}` : prov;
}

export function gruposPorProvincia(filas: readonly HojasRutaTerritory[]): GrupoProvincia[] {
  const grupos = new Map<string, GrupoProvincia>();
  for (const t of filas) {
    const id = claveProvincia(t);
    const g = grupos.get(id) ?? { id, etiqueta: etiquetaProvincia(t), nivel: t.cobertura_nivel ?? null, filas: [] };
    g.filas.push(t);
    grupos.set(id, g);
  }
  const orden = (g: GrupoProvincia) => ORDEN_FIJO[g.filas[0]?.provincia ?? ""] ?? 2;
  return [...grupos.values()]
    .map((g) => ({ ...g, filas: g.filas.sort((x, y) => x.distrito.localeCompare(y.distrito, "es")) }))
    .sort((a, b) => orden(a) - orden(b) || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** Población del marco de las provincias a las que pertenecen los distritos dados. */
export function marcoDeProvincias(territorios: readonly HojasRutaTerritory[], distritos: readonly HojasRutaTerritory[]): number {
  const provincias = new Set(distritos.map(claveProvincia));
  return territorios.filter((t) => provincias.has(claveProvincia(t))).reduce((a, t) => a + t.poblacion, 0);
}

/** Cómo se nombra el marco de esas provincias: «de Arequipa», «de Lima Metropolitana y Callao», «de 3 provincias». */
export function nombreDelMarco(distritos: readonly HojasRutaTerritory[]): string {
  const etiquetas = [...new Set(distritos.map(etiquetaProvincia))];
  if (!etiquetas.length) return "";
  if (etiquetas.length === 1) return `de ${etiquetas[0]}`;
  if (etiquetas.length === 2) return `de ${etiquetas[0]} y ${etiquetas[1]}`;
  return `de ${etiquetas.length} provincias`;
}

/** Captación CPV 2025 de un distrito (ADR 0119 §7); bajo 55 % se avisa. */
export function captacionDe(t: Pick<HojasRutaTerritory, "captacion">): { texto: string; baja: boolean } | null {
  if (t.captacion === null || t.captacion === undefined || !Number.isFinite(t.captacion)) return null;
  return {
    texto: `capta ${formatoDecimal(t.captacion, 0)} %`,
    baja: t.captacion < 55,
  };
}

export function contarProvincias(territorios: readonly HojasRutaTerritory[]): number {
  return new Set(territorios.map(claveProvincia)).size;
}
