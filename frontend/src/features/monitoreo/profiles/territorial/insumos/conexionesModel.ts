import type {
  MonitoreoState,
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialPhase,
  MonitoreoTerritorialPhaseCoherenceItem,
} from "../../../../../api/client";
import { tieneOcurrencias } from "../navegacion/modeloDelRail";
import { fechaYHoraDeLima } from "../rotulos";

/**
 * Insumos › Conexiones (territorial.md §3.1): una tarjeta por fuente con su
 * estado y lo que trajo, y al costado la muestra que llega de Hojas de ruta.
 * Cada fuente dice cuántas filas trajo y cuándo (C5).
 */

export type TonoDeFuente = "ok" | "aviso" | "error" | "inactiva";

export type TarjetaDeFuente = {
  clave: string;
  titulo: string;
  fase: MonitoreoTerritorialPhase | null;
  activa: boolean;
  estado: string;
  tono: TonoDeFuente;
  formulario: string;
  cifras: Array<{ rotulo: string; valor: string }>;
  serie: number[];
};

export type ModeloConexiones = {
  conFuenteDeCampo: boolean;
  tarjetas: TarjetaDeFuente[];
  muestra: Array<{ rotulo: string; valor: string }>;
  ventanas: Array<{ fase: string; desde: string }>;
};

const NOMBRE_DE_FASE: Record<MonitoreoTerritorialPhase, string> = { pilot: "Piloto", field: "Campo" };

const ESTADO: Record<string, { texto: string; tono: TonoDeFuente }> = {
  source_not_applied: { texto: "Sin formulario conectado", tono: "error" },
  source_applied_not_synced: { texto: "Conectado, todavía sin leer", tono: "aviso" },
  source_synced_with_rows: { texto: "Al día", tono: "ok" },
  source_synced_zero_rows: { texto: "Leído, sin respuestas", tono: "aviso" },
  dashboard_stale: { texto: "Hay respuestas nuevas por recalcular", tono: "aviso" },
  source_snapshot_mismatch: { texto: "La lectura guardada no es de este formulario", tono: "error" },
  sync_error: { texto: "La última lectura falló", tono: "error" },
};

function n(valor: unknown): number | null {
  const numero = Number(valor);
  return valor != null && valor !== "" && Number.isFinite(numero) ? numero : null;
}

function texto(valor: number | null): string {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

function itemDeFase(state: MonitoreoState | null | undefined, fase: MonitoreoTerritorialPhase): MonitoreoTerritorialPhaseCoherenceItem | null {
  const coherencia = state?.territorial_phase_coherence ?? state?.dashboard?.territorial_reports?.phase_coherence ?? null;
  return coherencia?.phases?.[fase] ?? (coherencia?.active?.phase === fase ? coherencia.active : null) ?? null;
}

export function construirConexiones(
  state: MonitoreoState | null | undefined,
  reports: MonitoreoTerritorialDashboard | null | undefined,
  activa: MonitoreoTerritorialPhase,
  cortes: { avance?: MonitoreoTerritorialDashboard | null; consultas?: MonitoreoTerritorialDashboard | null } = {},
): ModeloConexiones {
  // El corte de la fuente trae la ficha (preguntas, opciones) pero no la
  // muestra ni los partes: la meta y la ruta salen del corte de avance y los
  // partes del de consultas, que es donde el motor los calcula.
  const conRuta = [cortes.avance, reports].find((corte) => n(corte?.route_overview?.route_count) != null) ?? null;
  const conMeta = [cortes.avance, reports].find((corte) => n(corte?.advance?.meta) != null) ?? null;
  const conPartes = [cortes.consultas, reports].find((corte) => corte?.field_occurrences?.summary) ?? null;
  const territorial = state?.config?.territorial;
  const historial = state?.territorial_update_history ?? [];
  const ventanas = territorial?.phase_windows;

  const tarjetas: TarjetaDeFuente[] = (["field", "pilot"] as const).map((fase) => {
    const item = itemDeFase(state, fase);
    const fuenteId = territorial?.phase_sources?.[fase]?.source_id || item?.source_id || "";
    const fuente = (state?.sources ?? []).find((source) => source.id === fuenteId) ?? null;
    const lecturas = historial.filter((entrada) => entrada.source_id === fuenteId || (item?.asset_uid && entrada.asset_uid === item.asset_uid));
    const ultimaFicha = [...lecturas].filter((entrada) => entrada.type === "inspect").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const esActiva = fase === activa;
    const estado = ESTADO[String(item?.status ?? "source_not_applied")] ?? { texto: item?.message || "Estado sin rótulo", tono: "aviso" as const };
    const cifras = [
      { rotulo: "Respuestas", valor: texto(n(item?.local_rows)) },
      esActiva ? { rotulo: "Preguntas", valor: texto(n(reports?.source_coherence?.survey_count)) } : null,
      esActiva ? { rotulo: "Opciones", valor: texto(n(reports?.source_coherence?.choices_count)) } : null,
      { rotulo: "Última lectura", valor: fechaYHoraDeLima(item?.last_sync_at || fuente?.last_sync_at) || "—" },
      { rotulo: "Ficha leída", valor: fechaYHoraDeLima(ultimaFicha?.created_at) || "—" },
      { rotulo: "Fase desde", valor: fechaYHoraDeLima(ventanas?.[fase]?.start_at) || "—" },
    ].filter((cifra): cifra is { rotulo: string; valor: string } => cifra != null);
    return {
      clave: fase,
      titulo: `Kobo de ${NOMBRE_DE_FASE[fase]}`,
      fase,
      activa: esActiva,
      estado: esActiva ? estado.texto : `Fase no activa, ${estado.texto.toLowerCase()}`,
      tono: esActiva ? estado.tono : "inactiva",
      formulario: item?.asset_name || fuente?.survey_title || fuente?.label || "Sin formulario",
      cifras,
      serie: [...lecturas]
        .filter((entrada) => entrada.type === "sync")
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((entrada) => n(entrada.response_count) ?? 0),
    };
  });

  if (tieneOcurrencias(state ?? null)) {
    const tablero = conPartes?.field_occurrences;
    tarjetas.push({
      clave: "ocurrencias",
      titulo: "Kobo de ocurrencias de campo",
      fase: null,
      activa: false,
      estado: tablero?.summary ? "Al día" : "Sin partes en este corte",
      tono: tablero?.summary ? "ok" : "aviso",
      formulario: String(tablero?.config?.asset_name || tablero?.config?.form_title || "Formulario de ocurrencias"),
      cifras: [
        { rotulo: "Partes", valor: texto(n(tablero?.summary?.total_records)) },
        { rotulo: "UMP citadas", valor: texto(tablero?.by_ump ? tablero.by_ump.filter((item) => item.has_report ?? n(item.reportes)).length : null) },
        { rotulo: "Última lectura", valor: fechaYHoraDeLima(tablero?.snapshot?.synced_at) || "—" },
      ],
      serie: [],
    });
  }

  for (const fuente of state?.sources ?? []) {
    if (fuente.role !== "hoja_ruta") continue;
    tarjetas.push({
      clave: fuente.id,
      titulo: "Hoja de ruta operativa en Sheets",
      fase: null,
      activa: false,
      estado: fuente.enabled ? "Conectada" : "Sin conectar",
      tono: fuente.enabled ? "ok" : "inactiva",
      formulario: fuente.label || "Hoja de ruta",
      cifras: [{ rotulo: "Última lectura", valor: fechaYHoraDeLima(fuente.last_sync_at) || "—" }],
      serie: [],
    });
  }

  const ruta = conRuta?.route_overview;
  return {
    conFuenteDeCampo: Boolean(itemDeFase(state, "field")?.source_applied || territorial?.phase_sources?.field?.source_id),
    tarjetas,
    muestra: [
      { rotulo: "Meta", valor: texto(n(conMeta?.advance?.meta)) },
      { rotulo: "Distritos", valor: texto(n(ruta?.district_count)) },
      { rotulo: "UMP titulares", valor: texto(n(ruta?.route_count)) },
      { rotulo: "Reemplazos", valor: texto(n(ruta?.replacement_count)) },
    ],
    ventanas: (["field", "pilot"] as const)
      .map((fase) => ({ fase: NOMBRE_DE_FASE[fase], desde: fechaYHoraDeLima(ventanas?.[fase]?.start_at) }))
      .filter((ventana) => ventana.desde),
  };
}
