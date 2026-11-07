import type { HojasRutaTerritory } from "../../../../api/hojasRuta";

/**
 * Capa de los distritos de la ciudad abierta en el atlas de Territorio (revisión del 7 nov 2026): cada
 * distrito se colorea por su población, sus viviendas o su NSE predominante. Es a nivel de distrito a
 * propósito: pintar manzanas exige leer las de cada distrito (unos 15 s la primera vez; Lima tiene 50).
 */
export type CapaDistritos = "distritos" | "poblacion" | "viviendas" | "nse";

export const CAPAS_DISTRITOS: readonly [CapaDistritos, string][] = [
  ["distritos", "Distritos"],
  ["poblacion", "Población"],
  ["viviendas", "Viviendas"],
  ["nse", "NSE"],
];

/** Población y viviendas en seis clases (los escalones de la rampa del mapa); NSE en sus cinco niveles. */
const CLASES = 6;

export type EscalaDistritos = {
  capa: Exclude<CapaDistritos, "distritos">;
  /** Clase de cada distrito: 1..6 (cuantiles) o 1..5 (NSE, 1 = Alto); 0 sin dato. */
  clase: ReadonlyMap<string, number>;
  min: number;
  max: number;
};

const valorDe = (capa: EscalaDistritos["capa"], t: HojasRutaTerritory): number | null => {
  const v = capa === "poblacion" ? t.poblacion : capa === "viviendas" ? t.viviendas : t.nse_predominante;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Cortes de cuantiles: con pocos distritos (Ayacucho tiene cinco) cada uno cae en su propia clase. */
export function cortesCuantiles(valores: readonly number[], clases = CLASES): number[] {
  const orden = [...valores].sort((a, b) => a - b);
  if (!orden.length) return [];
  return Array.from({ length: clases - 1 }, (_, i) => orden[Math.min(orden.length - 1, Math.floor(((i + 1) * orden.length) / clases))]);
}

export function escalaDistritos(capa: CapaDistritos, territorios: readonly HojasRutaTerritory[]): EscalaDistritos | null {
  if (capa === "distritos") return null;
  const valores = territorios.flatMap((t) => {
    const v = valorDe(capa, t);
    return v == null ? [] : [{ ubigeo: t.ubigeo, v }];
  });
  const clase = new Map<string, number>(territorios.map((t) => [t.ubigeo, 0]));
  if (capa === "nse") {
    for (const { ubigeo, v } of valores) clase.set(ubigeo, v >= 1 && v <= 5 ? Math.round(v) : 0);
    return { capa, clase, min: 1, max: 5 };
  }
  const cortes = cortesCuantiles(valores.map((x) => x.v));
  for (const { ubigeo, v } of valores) clase.set(ubigeo, 1 + cortes.filter((c) => v >= c).length);
  const vs = valores.map((x) => x.v);
  return { capa, clase, min: vs.length ? Math.min(...vs) : 0, max: vs.length ? Math.max(...vs) : 0 };
}
