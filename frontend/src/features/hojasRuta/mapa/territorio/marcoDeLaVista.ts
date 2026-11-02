import type { HojasRutaTerritory, TerritorialFrameMeta } from "../../../../api/hojasRuta";

/**
 * Qué dice el Marco territorial según lo que se mira (revisión de Gonzalo, 2 nov 2026: con otra ciudad abierta
 * seguía hablando de Lima y Callao). Con una ciudad abierta, cada fila es de esa ciudad: sus distritos, su
 * cartografía y sus manzanas. Sin ciudad, el catálogo entero, rotulado como catálogo. La comparación con la
 * cartografía oficial es del paquete de Lima y Callao: sólo se muestra cuando se mira Lima o el catálogo.
 */

export type CiudadEnVista = { nombre: string; ubigeos: readonly string[] } | null;

export type FilasDelMarco = {
  /** «Cobertura» con ciudad; «Catálogo» sin ella. */
  rotuloCobertura: string;
  cobertura: string;
  /** Los ubigeos (uno por provincia) cuya cartografía se pide; vacío = la del paquete de Lima y Callao. */
  ubigeosCartografia: string[];
  rotuloCifras: string;
  manzanas: number;
  viviendas: number;
  poblacion: number;
  /** La comparación con la cartografía oficial aplica a lo que se mira. */
  conComparacion: boolean;
};

const LIMA_CALLAO = /^(1501|0701)/;

/** Un ubigeo por provincia, ordenado: la cartografía se declara por provincia. */
export function unoPorProvincia(ubigeos: readonly string[]): string[] {
  const primeros = new Map<string, string>();
  for (const u of ubigeos) if (!primeros.has(u.slice(0, 4))) primeros.set(u.slice(0, 4), u);
  return [...primeros.values()].sort();
}

export function marcoDeLaVista(meta: TerritorialFrameMeta, territorios: readonly HojasRutaTerritory[], ciudad: CiudadEnVista): FilasDelMarco {
  if (!ciudad) {
    return {
      rotuloCobertura: "Catálogo",
      cobertura: `${meta.coverage || "—"}${meta.n_distritos ? ` · ${meta.n_distritos} distritos` : ""}`,
      ubigeosCartografia: [],
      rotuloCifras: "En el catálogo",
      manzanas: meta.n_manzanas ?? 0,
      viviendas: meta.viviendas ?? 0,
      poblacion: meta.poblacion ?? 0,
      conComparacion: true,
    };
  }
  const suyos = new Set(ciudad.ubigeos);
  const deLaCiudad = territorios.filter((t) => suyos.has(t.ubigeo));
  const suma = (k: "manzanas" | "viviendas" | "poblacion") => deLaCiudad.reduce((a, t) => a + (t[k] || 0), 0);
  return {
    rotuloCobertura: "Cobertura",
    cobertura: `${ciudad.nombre} · ${deLaCiudad.length} ${deLaCiudad.length === 1 ? "distrito" : "distritos"}`,
    ubigeosCartografia: unoPorProvincia(ciudad.ubigeos),
    rotuloCifras: "En el marco",
    manzanas: suma("manzanas"),
    viviendas: suma("viviendas"),
    poblacion: suma("poblacion"),
    conComparacion: ciudad.ubigeos.some((u) => LIMA_CALLAO.test(u)),
  };
}
