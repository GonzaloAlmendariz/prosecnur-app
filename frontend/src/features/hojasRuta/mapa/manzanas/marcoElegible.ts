import type { HojasRutaAreaExcluida, HojasRutaCoberturaMarco, HojasRutaMarcoElegible, HojasRutaMotivoExclusion } from "../../../../api/hojasRuta";
import { ORIGEN_LONLAT, KX, KY } from "../lienzo/camara";

/**
 * Marco elegible en el lienzo (U11d, ADR 0115). El marco vive en el borrador del
 * sorteo y se guarda al sortear; aquí sólo hay datos: el marco por defecto de
 * una adopción, las áreas que se dibujan en el mapa y el tono de la cobertura.
 */

/** Lo que se escribe al adoptar el marco elegible (ADR 0115, Consecuencias). */
export const MARCO_NUEVO: HojasRutaMarcoElegible = { declarado: true, minimo_viviendas: 1, areas_excluidas: [] };
export const MARCO_LEGACY: HojasRutaMarcoElegible = { declarado: false, minimo_viviendas: 0, areas_excluidas: [] };

export const MOTIVOS: ReadonlyArray<readonly [HojasRutaMotivoExclusion, string]> = [
  ["inseguridad", "Inseguridad"],
  ["no_residencial", "No residencial"],
  ["inaccesible", "Inaccesible"],
  ["otro", "Otro"],
];
export const pideEvidencia = (m: HojasRutaMotivoExclusion) => m === "inseguridad" || m === "inaccesible";

/** Inversa de `proyectarLonLat`: del mundo del lienzo (metros) a lon/lat, a 1e-6. */
export function aLonLat(x: number, y: number): [number, number] {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return [r(x / KX + ORIGEN_LONLAT.lon), r(-y / KY + ORIGEN_LONLAT.lat)];
}

/** Anillo cerrado y canónico a partir de los vértices que se fueron marcando. */
export function cerrarAnillo(vertices: readonly [number, number][]): [number, number][] {
  if (vertices.length < 3) return [];
  const [a] = vertices;
  const b = vertices[vertices.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? [...vertices] : [...vertices, a];
}

export type FormularioArea = { motivo: HojasRutaMotivoExclusion; detalle: string; fuente: string; fecha: string };

/** Lo que falta para guardar un área, o `null` si está completa (las reglas del normalizador de R). */
export function faltaEnArea(f: FormularioArea, vertices: readonly [number, number][]): string | null {
  if (vertices.length < 3) return "Marca al menos tres puntos en el mapa";
  if (f.motivo === "otro" && !f.detalle.trim()) return "Con «Otro», escribe el detalle";
  if (pideEvidencia(f.motivo) && (!f.fuente.trim() || !f.fecha)) return "Indica la fuente y la fecha de la evidencia";
  return null;
}

export function nuevaArea(f: FormularioArea, vertices: readonly [number, number][], existentes: readonly HojasRutaAreaExcluida[], ahora: Date): HojasRutaAreaExcluida {
  const usados = new Set(existentes.map((a) => a.id));
  let n = existentes.length + 1;
  while (usados.has(`area-${n}`)) n += 1;
  return {
    id: `area-${n}`,
    motivo: f.motivo,
    detalle: f.detalle.trim(),
    fuente: f.fuente.trim() || undefined,
    fecha_evidencia: f.fecha || undefined,
    poligono: cerrarAnillo(vertices),
    creada: ahora.toISOString(),
  };
}

export type TonoCobertura = "ok" | "ambar" | "decision";

/**
 * ADR 0115 §4: ámbar sobre 5 % de población excluida; con 10 % o más se exige una
 * decisión registrada. Cuenta lo que excluye el marco (área + mínimo), no la piloto:
 * mismo criterio que `hojas_ruta_marco_elegible_requiere_decision` en R.
 */
export function tonoCobertura(c: HojasRutaCoberturaMarco): TonoCobertura {
  if (c.cobertura_poblacion == null) return "ok";
  const total = c.total?.poblacion ?? 0;
  const excluida = total > 0 && c.excluida_area && c.excluida_minimo
    ? (c.excluida_area.poblacion + c.excluida_minimo.poblacion) / total
    : 1 - c.cobertura_poblacion;
  return excluida >= 0.1 - 1e-9 ? "decision" : excluida > 0.05 + 1e-9 ? "ambar" : "ok";
}

/** ¿El vértice nuevo cierra el área? Sí si cae a menos de `tolerancia` metros del primero. */
export function cierraEnPrimero(vertices: readonly [number, number][], punto: [number, number], tolerancia: number): boolean {
  if (vertices.length < 3) return false;
  const [x0, y0] = vertices[0];
  return Math.hypot(punto[0] - x0, punto[1] - y0) <= tolerancia;
}

/** Ancla del bloque del marco elegible en el inspector de Manzanas (F24): `#marco-elegible` lo trae a la vista. */
export const ANCLA_MARCO = "marco-elegible";
export function irAlMarcoElegible(suave = true) {
  document.getElementById(ANCLA_MARCO)?.scrollIntoView({ block: "start", behavior: suave ? "smooth" : "auto" });
}
