// Analítica › Entrega (ADR 0144, prototipo "Analítica, Entrega"): los
// entregables de la base en tres grupos, cada uno con sus formatos y, cuando el
// motor lo publica, si ya se generó.
//
// De dónde sale el estado: la sesión dice por base activa si se generaron el
// libro, las frecuencias, los cruces y la ficha, y el motor apaga cada
// indicador cuando cambia algo de lo que depende. Por eso apagado se dice
// "Por generar". Base final, Script de réplica, Formulario final y Comparativo
// no tienen un indicador que se apague: su fila no lleva estado (pedido E2 del
// ADR 0144) en lugar de prometer uno que podría ser de un archivo viejo.

import type { SessionState } from "../../../api/core";
import type { AnaliticaTabId } from "../../../lib/navegacion/catalogos/procesamiento";

export type EntregableId =
  | "base-final"
  | "script"
  | "formulario"
  | "libro"
  | "ficha"
  | "frecuencias"
  | "cruces"
  | "comparativo";

export type GrupoDeEntrega = "base" | "documentacion" | "tablas";

export const NOMBRE_DEL_GRUPO: Readonly<Record<GrupoDeEntrega, string>> = {
  base: "Base de datos",
  documentacion: "Documentación",
  tablas: "Tablas",
};

export type Entregable = {
  id: EntregableId;
  grupo: GrupoDeEntrega;
  nombre: string;
  formatos: string;
  /** La pestaña donde se arma y se genera, cuando no es Entrega. */
  pestana?: AnaliticaTabId;
};

const ENTREGABLES: readonly Entregable[] = [
  { id: "base-final", grupo: "base", nombre: "Base final", formatos: "SAV, CSV y Excel" },
  { id: "script", grupo: "base", nombre: "Script de réplica", formatos: "R" },
  { id: "libro", grupo: "documentacion", nombre: "Libro de códigos", formatos: "Excel y PDF" },
  { id: "formulario", grupo: "documentacion", nombre: "Formulario final", formatos: "XLSForm" },
  { id: "ficha", grupo: "documentacion", nombre: "Ficha técnica", formatos: "Word" },
  { id: "frecuencias", grupo: "tablas", nombre: "Frecuencias", formatos: "Excel", pestana: "frecuencias" },
  { id: "cruces", grupo: "tablas", nombre: "Cruces", formatos: "Excel", pestana: "cruces" },
  { id: "comparativo", grupo: "tablas", nombre: "Comparativo", formatos: "Excel", pestana: "comparativos" },
];

export const ENTREGABLE_POR_DEFECTO: EntregableId = "libro";

/** Los entregables de este estudio: el comparativo solo cuando hay serie (dos o más bases). */
export function entregablesDelEstudio({ conComparativo }: { conComparativo: boolean }): Entregable[] {
  return ENTREGABLES.filter((e) => e.id !== "comparativo" || conComparativo);
}

export function esEntregable(valor: string | null | undefined): valor is EntregableId {
  return ENTREGABLES.some((e) => e.id === valor);
}

export type EstadoDeEntregable = "generado" | "por-generar" | null;

const INDICADOR: Partial<Record<EntregableId, keyof SessionState>> = {
  libro: "analitica_codebook_ok",
  ficha: "analitica_ficha_tecnica_ok",
  frecuencias: "analitica_frecuencias_ok",
  cruces: "analitica_cruces_ok",
};

/** El estado que el motor publica para la base activa; `null` si no publica uno que se apague. */
export function estadoDeEntregable(id: EntregableId, state: SessionState | null): EstadoDeEntregable {
  const indicador = INDICADOR[id];
  if (!indicador || !state) return null;
  return state[indicador] === true ? "generado" : "por-generar";
}

export type CifrasDeEntrega = {
  conEstado: number;
  generados: number;
  porGenerar: number;
};

export function cifrasDeEntrega(entregables: readonly Entregable[], state: SessionState | null): CifrasDeEntrega {
  let generados = 0;
  let porGenerar = 0;
  for (const e of entregables) {
    const estado = estadoDeEntregable(e.id, state);
    if (estado === "generado") generados += 1;
    if (estado === "por-generar") porGenerar += 1;
  }
  return { conEstado: generados + porGenerar, generados, porGenerar };
}

/** Los entregables agrupados en el orden del prototipo, sin grupos vacíos. */
export function gruposDeEntrega(entregables: readonly Entregable[]): { grupo: GrupoDeEntrega; entregables: Entregable[] }[] {
  const orden: GrupoDeEntrega[] = ["base", "documentacion", "tablas"];
  return orden
    .map((grupo) => ({ grupo, entregables: entregables.filter((e) => e.grupo === grupo) }))
    .filter((g) => g.entregables.length > 0);
}

/** "Faltan 3 campos por completar" de la ficha; `null` si están todos o aún no se leyó. */
export function causaDeLaFicha(campos: number | null, completos: number | null): string | null {
  if (campos === null || completos === null) return null;
  const faltan = Math.max(0, campos - completos);
  if (faltan === 0) return null;
  return faltan === 1 ? "Falta 1 campo por completar" : `Faltan ${faltan} campos por completar`;
}
