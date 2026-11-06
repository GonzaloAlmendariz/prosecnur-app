import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import type { BorradorMuestra } from "./desdeConfig";
import { repartirPorModo, type FilaTamano, type ModoAsignacion, type ResultadoTamano } from "./motorTamano";

/**
 * Atajos del reparto por distrito (brecha B32), con el mismo reparto entero
 * que usa el motor (`repartirPorModo`, espejo de R): siempre en rutas completas.
 */

/** Reparte el N total entre los distritos según la asignación elegida, en rutas completas. */
export function repartoPorPoblacion(filas: readonly FilaTamano[], nTotal: number, porRuta: number, modo: ModoAsignacion): Record<string, number> {
  if (!(porRuta > 0)) return {};
  const rutas = repartirPorModo(filas.map((f) => f.poblacion), Math.round(nTotal / porRuta), modo);
  return Object.fromEntries(filas.map((f, i) => [f.ubigeo, rutas[i] * porRuta]));
}

/** Pone en cada distrito su mínimo para el margen objetivo, subido a rutas completas. */
export function repartoMinimos(filas: readonly FilaTamano[], porRuta: number): Record<string, number> {
  const paso = porRuta > 0 ? porRuta : 1;
  return Object.fromEntries(filas.map((f) => [f.ubigeo, Math.ceil(f.nMinimo / paso) * paso]));
}

export type EscenarioMuestra = { nombre: string; firma: string; borrador: BorradorMuestra; n: number; margen: number | null; peor: number | null; contactos: number };

/** Lo que decide el tamaño, como borrador aplicable y con su firma para reconocerlo. */
export function borradorDeEscenario(config: HojasRutaIntegratedConfig): BorradorMuestra {
  return {
    sample_size_mode: config.sample_size_mode,
    n_objetivo: config.n_objetivo,
    n_por_distrito: { ...config.n_por_distrito },
    entrevistas_por_manzana: config.entrevistas_por_manzana,
    sample_size: { ...config.sample_size },
  };
}

export const firmaEscenario = (config: HojasRutaIntegratedConfig) => JSON.stringify(borradorDeEscenario(config));

export function escenarioDe(nombre: string, config: HojasRutaIntegratedConfig, r: ResultadoTamano): EscenarioMuestra {
  return {
    nombre,
    firma: firmaEscenario(config),
    borrador: borradorDeEscenario(config),
    n: r.nUsado,
    margen: r.margenTotal,
    peor: r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null,
    contactos: r.contactos,
  };
}
