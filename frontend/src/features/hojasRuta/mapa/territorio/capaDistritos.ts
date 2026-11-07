import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { KX, KY, ORIGEN_LONLAT } from "../lienzo/camara";

/**
 * Capa de los distritos de la ciudad abierta en el atlas de Territorio (revisión del 7 nov 2026): cada
 * distrito se colorea por su densidad de población o de viviendas, o por su NSE predominante. Es a nivel de
 * distrito a propósito: pintar manzanas exige leer las de cada distrito (unos 15 s la primera vez; Lima tiene 50).
 *
 * Como lo hacen ONS, el Banco Mundial o ColorBrewer: un mapa coropleta pinta tasas, nunca totales (un distrito
 * grande y poco poblado se veía «fuerte» sólo por su tamaño), en cinco clases, con la leyenda dando el rango de
 * cada una; el NSE, que tiene orden y un centro, en divergente.
 */
export type CapaDistritos = "distritos" | "poblacion" | "viviendas" | "nse";

export const CAPAS_DISTRITOS: readonly [CapaDistritos, string][] = [
  ["distritos", "Distritos"],
  ["poblacion", "Población"],
  ["viviendas", "Viviendas"],
  ["nse", "NSE"],
];

/** Nombre de cada nivel NSE (1 = Alto … 5 = Bajo; 0 sin dato), el de la leyenda. */
export const NOMBRE_NSE = ["Sin dato", "Alto", "Medio alto", "Medio", "Medio bajo", "Bajo"] as const;

/** Cinco clases por cuantiles, el número habitual de la ONS para coropletas. */
export const CLASES_DENSIDAD = 5;

export type EscalaDistritos = {
  capa: Exclude<CapaDistritos, "distritos">;
  /** Clase de cada distrito: 1..5 (cuantiles de densidad, o nivel NSE con 1 = Alto); 0 sin dato. */
  clase: ReadonlyMap<string, number>;
  /** Densidad: los cuatro cortes entre las cinco clases (por km²). Vacío para el NSE. */
  cortes: readonly number[];
};

// ---------- Área de un contorno ----------

const areaAnillo = (r: readonly number[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return Math.abs(a) / 2;
};

const dentroDe = (x: number, y: number, r: readonly number[]) => {
  let c = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    if (r[i + 1] > y !== r[j + 1] > y && x < ((r[j] - r[i]) * (y - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) c = !c;
  }
  return c;
};

/**
 * Área en km² de un contorno del lienzo (anillos planos x,y en metros). Un anillo dentro de un número impar de
 * otros es un hueco (cerros y quebradas de la huella urbana) y resta. El mundo del lienzo usa la escala este-oeste
 * de Lima: lejos de su latitud se corrige por el coseno (en Tacna, cerca del 3 %).
 */
export function areaKm2(anillos: readonly (readonly number[])[]): number {
  let total = 0;
  let ySuma = 0;
  let yN = 0;
  for (const r of anillos) {
    if (r.length < 6) continue;
    const dentro = anillos.filter((o) => o !== r && o.length >= 6 && dentroDe(r[0], r[1], o)).length;
    total += (dentro % 2 ? -1 : 1) * areaAnillo(r);
    for (let i = 1; i < r.length; i += 2) ySuma += r[i];
    yN += r.length / 2;
  }
  if (!yN) return 0;
  const lat = ORIGEN_LONLAT.lat - ySuma / yN / KY;
  const correccion = Math.cos((lat * Math.PI) / 180) / (KX / 111320);
  return (Math.max(0, total) * correccion) / 1e6;
}

// ---------- Clases ----------

/** Cortes de cuantiles: con pocos distritos (Ayacucho tiene cinco) cada uno cae en su propia clase. */
export function cortesCuantiles(valores: readonly number[], clases = CLASES_DENSIDAD): number[] {
  const orden = [...valores].sort((a, b) => a - b);
  if (!orden.length) return [];
  return Array.from({ length: clases - 1 }, (_, i) => orden[Math.min(orden.length - 1, Math.floor(((i + 1) * orden.length) / clases))]);
}

export function escalaDistritos(capa: CapaDistritos, territorios: readonly HojasRutaTerritory[], areas: ReadonlyMap<string, number>): EscalaDistritos | null {
  if (capa === "distritos") return null;
  const clase = new Map<string, number>(territorios.map((t) => [t.ubigeo, 0]));
  if (capa === "nse") {
    for (const t of territorios) {
      const v = t.nse_predominante;
      if (typeof v === "number" && v >= 1 && v <= 5) clase.set(t.ubigeo, Math.round(v));
    }
    return { capa, clase, cortes: [] };
  }
  const valores = territorios.flatMap((t) => {
    const area = areas.get(t.ubigeo) ?? 0;
    const total = capa === "poblacion" ? t.poblacion : t.viviendas;
    return area > 0 && Number.isFinite(total) ? [{ ubigeo: t.ubigeo, v: total / area }] : [];
  });
  const cortes = cortesCuantiles(valores.map((x) => x.v));
  for (const { ubigeo, v } of valores) clase.set(ubigeo, Math.min(CLASES_DENSIDAD, 1 + cortes.filter((c) => v >= c).length));
  return { capa, clase, cortes };
}
