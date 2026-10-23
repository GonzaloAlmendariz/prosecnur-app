import type {
  HojasRutaBlockMapFeature,
  HojasRutaStreetMapFeature,
  MonitoreoTerritorialDashboard,
  TerritorialBlockProgress,
  TerritorialQuotaProgressBlock,
} from "../../../../../api/client";
import type { EstadoDeUmp } from "./faltanteModel";
import { construirUmps, type FilaDeUmpAvance } from "./umpsModel";

/**
 * Avance › Mapa (territorial.md §3.15). Vista general: las manzanas en uso de
 * cada UMP como punto por estado y las que ya no se usan como anillo. Al elegir
 * una UMP, el mapa acerca a su entorno (≈ 520 m) con las vecinas y la flecha
 * de la subsanación sugerida. Los estados son los de Avance › UMP y Faltante
 * por UMP (`construirUmps`). El GPS de los hogares no se dibuja.
 */

export type EstadoEnMapa = EstadoDeUmp | "sin-usar";

export type ManzanaEnMapa = {
  idManzana: string;
  ump: string;
  estado: EstadoEnMapa;
  ubigeo: string;
  /** Forma que espera el emparejador de cartografía del atlas. */
  bloque: TerritorialBlockProgress;
};

export type FlechaDeSubsanacion = { ump: string; origen: string; destino: string; umpOrigen: string };

export type ModeloMapa = {
  manzanas: ManzanaEnMapa[];
  ubigeos: string[];
  conteos: Record<EstadoDeUmp, number>;
  pendientes: FilaDeUmpAvance[];
  sinParte: FilaDeUmpAvance[];
  conOcurrencias: boolean;
  /** Subsanación sugerida por UMP de destino. */
  flechas: Map<string, FlechaDeSubsanacion>;
};

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

/** Un bloque de cuota con la forma mínima de `TerritorialBlockProgress`. */
export function comoBloqueDeRuta(bloque: TerritorialQuotaProgressBlock): TerritorialBlockProgress {
  return {
    id_manzana: bloque.id_manzana,
    ubigeo: texto(bloque.ubigeo) || texto(bloque.id_manzana).slice(0, 6),
    distrito: texto(bloque.distrito),
    zona: texto(bloque.zona),
    manzana: texto(bloque.manzana),
    tipo_manzana: texto(bloque.tipo_manzana),
    ump: texto(bloque.ump),
    meta: Number(bloque.target) || null,
    validas: Number(bloque.validas) || 0,
    revision: 0,
    no_defendibles: 0,
    avance_pct: null,
    brecha: null,
  };
}

export function construirMapa(
  avance: MonitoreoTerritorialDashboard | null | undefined,
  otro?: MonitoreoTerritorialDashboard | null,
): ModeloMapa {
  const umps = construirUmps(avance, otro);
  const manzanas: ManzanaEnMapa[] = [];
  const vistas = new Set<string>();
  for (const fila of umps.filas) {
    const enUso = comoBloqueDeRuta(fila.base.bloque);
    manzanas.push({ idManzana: fila.idManzana, ump: fila.ump, estado: fila.estado, ubigeo: enUso.ubigeo, bloque: enUso });
    vistas.add(fila.idManzana);
  }
  for (const fila of umps.filas) {
    for (const otra of fila.base.otras) {
      if (vistas.has(otra.id_manzana)) continue;
      const bloque = comoBloqueDeRuta(otra);
      manzanas.push({ idManzana: otra.id_manzana, ump: fila.ump, estado: "sin-usar", ubigeo: bloque.ubigeo, bloque });
      vistas.add(otra.id_manzana);
    }
  }

  const umpDeManzana = new Map(manzanas.map((manzana) => [manzana.idManzana, manzana.ump]));
  const flechas = new Map<string, FlechaDeSubsanacion>();
  for (const sugerencia of avance?.operational_adjustments?.suggestions ?? []) {
    const ump = umpDeManzana.get(texto(sugerencia.target_block_id));
    if (!ump || flechas.has(ump)) continue;
    flechas.set(ump, {
      ump,
      origen: texto(sugerencia.source_block_id),
      destino: texto(sugerencia.target_block_id),
      umpOrigen: texto(sugerencia.source_ump).replace(/^UMP\s*/i, ""),
    });
  }

  return {
    manzanas,
    ubigeos: [...new Set(manzanas.map((manzana) => manzana.ubigeo).filter(Boolean))],
    conteos: {
      completa: umps.conteos.completas,
      subsanada: umps.conteos.subsanadas,
      pendiente: umps.conteos.pendientes,
    },
    pendientes: umps.filas.filter((fila) => fila.estado === "pendiente"),
    sinParte: umps.filas.filter((fila) => fila.sinParte),
    conOcurrencias: umps.conOcurrencias,
    flechas,
  };
}

export type PuntoGeografico = { lon: number; lat: number };

/** Centro aproximado de una manzana: el promedio de su anillo exterior. */
export function centroDeManzana(feature: HojasRutaBlockMapFeature): PuntoGeografico | null {
  const geometria = feature.geometry;
  if (!geometria) return null;
  const poligono = geometria.type === "Polygon"
    ? (geometria.coordinates as number[][][])
    : (geometria.coordinates as number[][][][])[0];
  const anillo = poligono?.[0] ?? [];
  const puntos = anillo.filter((punto) => Number.isFinite(punto?.[0]) && Number.isFinite(punto?.[1]));
  if (!puntos.length) return null;
  const suma = puntos.reduce((acc, punto) => ({ lon: acc.lon + punto[0], lat: acc.lat + punto[1] }), { lon: 0, lat: 0 });
  return { lon: suma.lon / puntos.length, lat: suma.lat / puntos.length };
}

/** Distancia en metros entre dos puntos (haversine). */
export function metrosEntre(a: PuntoGeografico, b: PuntoGeografico): number {
  const radio = 6_371_000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Manzanas cuyo centro cae a menos de `radio` metros: el entorno de ≈ 520 m. */
export function manzanasVecinas(
  features: readonly HojasRutaBlockMapFeature[],
  centro: PuntoGeografico,
  radio = 260,
): HojasRutaBlockMapFeature[] {
  return features.filter((feature) => {
    const punto = centroDeManzana(feature);
    return punto ? metrosEntre(punto, centro) <= radio : false;
  });
}

/** Calles con algún tramo a menos de `radio` metros: las del entorno acercado. */
export function callesCercanas(
  features: readonly HojasRutaStreetMapFeature[],
  centro: PuntoGeografico,
  radio = 400,
): HojasRutaStreetMapFeature[] {
  return features.filter((feature) => {
    const geometria = feature.geometry;
    if (!geometria) return false;
    const lineas = geometria.type === "LineString"
      ? [geometria.coordinates as number[][]]
      : (geometria.coordinates as number[][][]);
    return lineas.some((linea) => linea.some((punto) => (
      Number.isFinite(punto?.[0]) && Number.isFinite(punto?.[1])
      && metrosEntre({ lon: punto[0], lat: punto[1] }, centro) <= radio
    )));
  });
}
