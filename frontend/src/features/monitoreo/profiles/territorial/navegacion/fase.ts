import type {
  MonitoreoState,
  MonitoreoTerritorialPhase,
  MonitoreoTerritorialPhaseCoherenceItem,
} from "../../../../../api/client";
import { diaYMes, fmt } from "../rotulos";

/**
 * Las opciones del selector `FASE ▾` (A4 de `territorial.md`): cada fase con
 * cuántas respuestas trae y desde cuándo. Reemplaza la banda «Formato
 * territorial» y las tarjetas de fase de la consola; la fase se define en
 * Modelo y el chrome sólo la elige.
 */
export type OpcionDeFase = {
  fase: MonitoreoTerritorialPhase;
  nombre: string;
  detalle: string;
  /** Última lectura de la fuente de esa fase, «dd/mm». */
  fecha: string;
  activa: boolean;
};

const NOMBRE: Record<MonitoreoTerritorialPhase, string> = { pilot: "Piloto", field: "Campo" };

function entero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function itemDeFase(state: MonitoreoState | null, fase: MonitoreoTerritorialPhase): MonitoreoTerritorialPhaseCoherenceItem | null {
  const coherencia = state?.territorial_phase_coherence ?? state?.dashboard?.territorial_reports?.phase_coherence ?? null;
  return coherencia?.phases?.[fase] ?? (coherencia?.active?.phase === fase ? coherencia.active : null) ?? null;
}

function detalleSinRespuestas(item: MonitoreoTerritorialPhaseCoherenceItem | null): string | null {
  switch (item?.status) {
    case undefined:
    case "source_not_applied":
      return "Sin formulario conectado";
    case "source_applied_not_synced":
      return "Formulario conectado, todavía sin leer";
    case "source_synced_zero_rows":
      return "Sin respuestas todavía";
    case "sync_error":
      return "La última lectura falló";
    default:
      return null;
  }
}

export function opcionesDeFase(
  state: MonitoreoState | null,
  activa: MonitoreoTerritorialPhase,
  meta: number | null,
): OpcionDeFase[] {
  const ventanas = (state?.config?.territorial as { phase_windows?: Partial<Record<MonitoreoTerritorialPhase, { start_at?: string }>> } | undefined)?.phase_windows;
  return (["pilot", "field"] as const).map((fase) => {
    const item = itemDeFase(state, fase);
    const esActiva = fase === activa;
    const sinRespuestas = detalleSinRespuestas(item);
    const enCorte = entero((item as { dashboard_rows?: unknown } | null)?.dashboard_rows) ?? entero(item?.report_rows);
    const locales = entero(item?.local_rows);
    const desde = diaYMes(ventanas?.[fase]?.start_at);
    let detalle: string;
    if (sinRespuestas) detalle = sinRespuestas;
    else if (esActiva && enCorte != null) {
      detalle = `${fmt(enCorte)} en el corte`;
      if (meta != null && meta > 0) detalle += ` y meta de ${fmt(meta)}`;
      if (desde) detalle += `, desde el ${desde}`;
    } else {
      const n = locales ?? enCorte ?? 0;
      detalle = `${fmt(n)} ${n === 1 ? "respuesta" : "respuestas"}`;
      if (desde) detalle += `, desde el ${desde}`;
    }
    return {
      fase,
      nombre: NOMBRE[fase],
      detalle,
      fecha: diaYMes(item?.last_sync_at),
      activa: esActiva,
    };
  });
}
