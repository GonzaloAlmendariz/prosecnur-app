/**
 * Acreditación › Selección (ADR 0090, E5): cada actor es un componente del
 * estudio y se sortea con el mismo motor de Muestra general, por su
 * `componente_id`. Aquí vive lo que la sección decide sin React: qué dice la
 * técnica de cada actor en palabras, en qué punto está su marco y su sorteo, y
 * cuál es el actor en foco.
 */
import type { CalcMuestraComponente, CalcMuestraTecnica } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { formatearEntero, modalidadDeTecnica, motivoSinSorteo } from "./modelo";

export type ClaseDeTecnica = "censal" | "probabilistica" | "cuotas" | "sin_sorteo";

export type TecnicaDelActor = {
  clase: ClaseDeTecnica;
  /** La técnica en palabras, para la tarjeta del actor. */
  etiqueta: string;
  /** El motor sortea (o da orden de contacto) para esta técnica. */
  sorteable: boolean;
  /** Por qué no se sortea; `null` si se sortea. */
  motivo: string | null;
};

const ETIQUETA_SIN_SORTEO: Partial<Record<CalcMuestraTecnica, string>> = {
  no_prob_conveniencia: "Conveniencia",
  listado_externo_meta_fija: "Meta fija",
  prob_conglomerado_multietapico: "Conglomerados por etapas",
  prob_estratificado_independiente: "Estratos independientes",
  medicion_recurrente: "Medición recurrente",
};

/**
 * La técnica del actor en palabras y si el motor la sortea. Sigue la misma
 * regla que `calc_muestra_general_seleccionar`: la decide `modalidadDeTecnica`.
 */
export function tecnicaDelActor(tecnica: CalcMuestraTecnica | undefined): TecnicaDelActor {
  const modalidad = modalidadDeTecnica(tecnica);
  if (modalidad === "censo") {
    return { clase: "censal", etiqueta: "Censo", sorteable: true, motivo: null };
  }
  if (modalidad === "probabilistica") {
    return { clase: "probabilistica", etiqueta: "Muestra probabilística", sorteable: true, motivo: null };
  }
  const codigo = tecnica ?? "";
  if (tecnica === "no_prob_cuotas") {
    return { clase: "cuotas", etiqueta: "Cuotas", sorteable: false, motivo: motivoSinSorteo(codigo) };
  }
  return {
    clase: "sin_sorteo",
    etiqueta: (tecnica && ETIQUETA_SIN_SORTEO[tecnica]) ?? "Sin selección",
    sorteable: false,
    motivo: motivoSinSorteo(codigo),
  };
}

export type FaseDelActor = "leyendo" | "sin_sorteo" | "sin_marco" | "marco" | "sorteado" | "sorteo_viejo";

export type EstadoDelActor = {
  fase: FaseDelActor;
  /** Rótulo corto del estado: «Sin marco», «Marco declarado», «Sorteado», «Sorteo viejo». */
  etiqueta: string;
  /** La cifra que acompaña al estado, o "" si no hay. */
  detalle: string;
};

/**
 * En qué punto están el marco y el sorteo del actor.
 *
 * `vigente` es el veredicto de `vigenciaSorteo` (bandaDisenoModelo.ts), que el
 * llamador calcula: el mismo que usan la banda, las fichas y la tarjeta. Un
 * sorteo de un marco o un cálculo que ya cambiaron es «Sorteo viejo», nunca
 * «Sorteado» en verde (QA E11 ronda 2). Se recibe hecho para no importar el
 * modelo de la banda, que ya importa este archivo.
 */
export function estadoDelActor(args: {
  tecnica: TecnicaDelActor;
  cargado: boolean;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
  vigente?: boolean;
}): EstadoDelActor {
  const { tecnica, cargado, marco, corrida, vigente = true } = args;
  if (!tecnica.sorteable) return { fase: "sin_sorteo", etiqueta: "Sin selección", detalle: "no da π" };
  if (!cargado) return { fase: "leyendo", etiqueta: "Leyendo…", detalle: "" };
  if (!marco) return { fase: "sin_marco", etiqueta: "Sin marco", detalle: "" };
  if (!corrida) return { fase: "marco", etiqueta: "Marco declarado", detalle: `N=${formatearEntero(marco.N)}` };
  const meta = corrida.corrida;
  if (!vigente) return { fase: "sorteo_viejo", etiqueta: "Selección desactualizada", detalle: "vuelve a seleccionar" };
  return {
    fase: "sorteado",
    etiqueta: "Seleccionado",
    detalle: meta.modalidad === "censo"
      ? `${formatearEntero(meta.n_titulares)} a contactar`
      : `${formatearEntero(meta.n_titulares)} de N=${formatearEntero(meta.N)}`,
  };
}

/**
 * El actor en foco: el que nombra `foco` si es uno de los actores del
 * estudio; si no, el primero. Un foco ajeno (otro estudio, enlace viejo) no
 * deja la sección sin actor.
 */
export function actorEnFoco<T extends Pick<CalcMuestraComponente, "id">>(
  componentes: readonly T[],
  foco: string | null | undefined,
): T | null {
  if (componentes.length === 0) return null;
  return componentes.find((c) => c.id === foco) ?? componentes[0];
}
