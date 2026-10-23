import type { MonitoreoTerritorialDashboard, TerritorialResponseAuditRow } from "../../../../../api/client";
import { diaYMes, fmt, numeroDeUmp, rotuloDeAplicador, rotuloDeCelda } from "../rotulos";
import { construirFaltante, textoDeQuienCubre, type CeldaDeCuota, type EstadoDeUmp } from "./faltanteModel";

/**
 * Ficha de una UMP: P1 de Avance › Mapa e inspector de Avance › UMP
 * (territorial.md §3.15–3.16).
 *
 * La cuota y la subsanación salen del corte de Avance (el único con
 * `operational_adjustments`); los casos, del de Validación (el único con
 * `response_audit`). La página pasa los dos; si falta el segundo, la ficha no
 * inventa casos: `casos` queda en `null`.
 */

export type EstadoDeCaso = "cuenta" | "observacion" | "no-cuenta";

export type CasoDeUmp = {
  id: string;
  fecha: string;
  hora: string;
  manzana: string;
  sexo: string;
  edad: string;
  estado: EstadoDeCaso;
  rotuloDeEstado: string;
  distancia: string;
  aplicador: string;
  orden: string;
};

export type FichaDeUmp = {
  ump: string;
  distrito: string;
  manzana: string;
  tipo: "Titular" | "Reemplazo";
  aplicador: string;
  estado: EstadoDeUmp;
  rotuloDeEstado: string;
  cuentan: number;
  meta: number;
  /** Levantadas por el equipo en la manzana (sin la subsanación). */
  levantadas: number;
  /** Saldo de la subsanación: recibidas menos cedidas. */
  subsanado: number;
  celdas: CeldaDeCuota[];
  faltantes: Array<{ texto: string; falta: number }>;
  sugerencia: string | null;
  /** Casos del corte en las manzanas de la UMP; `null` sin `response_audit`. */
  casos: CasoDeUmp[] | null;
  enCorte: number | null;
  noCuentan: number | null;
};

const ROTULO_DE_ESTADO: Record<EstadoDeUmp, string> = {
  pendiente: "Celda de cuota pendiente",
  subsanada: "Completa con subsanación",
  completa: "Completa",
};

const ROTULO_DE_CASO: Record<EstadoDeCaso, string> = {
  cuenta: "Cuenta",
  observacion: "En observación",
  "no-cuenta": "No cuenta",
};

function estadoDeCaso(fila: TerritorialResponseAuditRow): EstadoDeCaso {
  if (fila.advance_valid === false || fila.validation_status === "no_defendible") return "no-cuenta";
  if (fila.observation_status === "en_observacion") return "observacion";
  return "cuenta";
}

function distancia(fila: TerritorialResponseAuditRow): string {
  const crudo = fila.gps_effective_distance_m ?? fila.distance_m;
  const metros = Number(crudo);
  if (crudo == null || !Number.isFinite(metros)) return "Sin GPS";
  return metros >= 1000 ? `${(metros / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} km` : `${fmt(Math.round(metros))} m`;
}

function rotuloDeSexo(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  return texto ? rotuloDeCelda(texto) : "Sin dato";
}

/** Casos de la UMP en el corte, por orden de llegada. */
export function casosDeUmp(
  validacion: MonitoreoTerritorialDashboard | null | undefined,
  ump: string,
  manzanas: ReadonlySet<string>,
): CasoDeUmp[] | null {
  const filas = validacion?.response_audit;
  if (!Array.isArray(filas) || !filas.length) return null;
  const propias = filas.filter((fila) => manzanas.has(String(fila.advance_block_id ?? ""))
    || (!fila.advance_block_id && numeroDeUmp(fila.advance_block_ump) === ump));
  return propias
    .map((fila) => ({ fila, orden: `${fila.submission_date_iso ?? ""} ${fila.submission_hour ?? ""}` }))
    .sort((a, b) => a.orden.localeCompare(b.orden))
    .map(({ fila, orden }) => {
      const estado = estadoDeCaso(fila);
      return {
        id: String(fila.response_id || fila.row_index),
        fecha: diaYMes(fila.submission_date_iso || fila.submission_date) || "—",
        hora: String(fila.submission_hour ?? "").slice(0, 5),
        manzana: String(fila.advance_block_manzana ?? ""),
        sexo: rotuloDeSexo(fila.sex),
        edad: fila.age != null && Number.isFinite(Number(fila.age)) ? `${fmt(fila.age)} años` : "Sin dato",
        estado,
        rotuloDeEstado: ROTULO_DE_CASO[estado],
        distancia: distancia(fila),
        aplicador: rotuloDeAplicador(fila.responsible_display || fila.pulso_code),
        orden,
      };
    });
}

export function construirFichaDeUmp(
  avance: MonitoreoTerritorialDashboard | null | undefined,
  validacion: MonitoreoTerritorialDashboard | null | undefined,
  umpPedida: string | null | undefined,
): FichaDeUmp | null {
  const ump = numeroDeUmp(umpPedida);
  if (!ump) return null;
  const fila = construirFaltante(avance).filas.find((item) => item.ump === ump);
  if (!fila) return null;
  const manzanas = new Set([fila.idManzana, ...fila.otras.map((otra) => otra.id_manzana)]);
  const casos = casosDeUmp(validacion, ump, manzanas);
  const subsanado = fila.ganancia - fila.perdida;
  return {
    ump,
    distrito: fila.distrito,
    manzana: fila.manzana,
    tipo: fila.reemplazo ? "Reemplazo" : "Titular",
    aplicador: fila.aplicador,
    estado: fila.estado,
    rotuloDeEstado: ROTULO_DE_ESTADO[fila.estado],
    cuentan: fila.logrado,
    meta: fila.meta,
    levantadas: fila.logrado - subsanado,
    subsanado,
    celdas: fila.celdas,
    faltantes: fila.faltantes,
    sugerencia: fila.cubre?.tipo === "sugerencia" ? textoDeQuienCubre(fila.cubre) : null,
    casos,
    enCorte: casos ? casos.length : null,
    noCuentan: casos ? casos.filter((caso) => caso.estado === "no-cuenta").length : null,
  };
}
