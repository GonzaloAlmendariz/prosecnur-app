import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { criteriosDesdeFiltro } from "../../../filtroEfectiva/criterios";
import { filasDeBloque } from "../navegacion/bloques";
import { nombreDelSegmento } from "../segmentoDeCuotas";
import { cadenaDeLaCifra, construirCuotasFaltante, type CuotaDeEntrada } from "./cuotasFaltanteModel";

function numero(valor: unknown): number {
  const n = Number(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normal(valor: unknown) {
  return String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * «No barrido» sin responsable, de `no_barridos_responsable`. El motor rotula
 * esa fila «Sin responsable»; si el bloque no viaja, `null` (no cero).
 */
export function sinAsignarDesdeBloque(filas: ReadonlyArray<Record<string, unknown>>): number | null {
  if (!filas.length) return null;
  return filas
    .filter((fila) => ["sin responsable", "sin asignar", ""].includes(normal(fila.Responsable)))
    .reduce((suma, fila) => suma + numero(fila["No barridos"]), 0);
}

/** Lo que Avance › Cuotas necesita del corte, armado desde los bloques que ya existen. */
export function entradaDeCuotasFaltante(
  reports: MonitoreoAcreditacionReports,
  state: MonitoreoState | null | undefined,
  cuotas: readonly CuotaDeEntrada[],
) {
  const filasDeCuota = filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  const segmento = nombreDelSegmento(filasDeCuota.map((fila) => String(fila.Variable ?? "")));
  const modelo = construirCuotasFaltante({
    cuotas,
    segmento,
    sinAsignar: sinAsignarDesdeBloque(filasDeBloque(reports, ["no_barridos_responsable"])),
  });

  const fuentesKobo = new Set((state?.sources ?? []).filter((fuente) => fuente.enabled && fuente.kind === "kobo").map((fuente) => fuente.id));
  const encuestas = Object.values(state?.source_metadata?.surveys ?? {}).filter((encuesta) => fuentesKobo.has(encuesta.source_id));
  const recibidas = encuestas.reduce((suma, encuesta) => suma + (Number(encuesta.response_count) || 0), 0);
  const criterios = criteriosDesdeFiltro(state?.config?.monitoreo_profile?.platform_effective_filter)
    .map((criterio) => `${criterio.label || criterio.variable}: ${criterio.value_label || criterio.values.join(" o ")}`)
    .join(" y ");
  const tiempos = filasDeBloque(reports, ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]);

  return {
    modelo,
    cadena: cadenaDeLaCifra({
      recibidas: recibidas || null,
      encuesta: encuestas.map((encuesta) => encuesta.title || encuesta.label || "").filter(Boolean).join(" y "),
      pasanFiltro: tiempos.length || null,
      criterios: criterios || "Filtro de efectiva sin declarar",
      unicas: modelo.total.efectivas,
    }),
  };
}
