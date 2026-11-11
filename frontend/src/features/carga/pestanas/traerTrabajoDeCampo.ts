import { apiCargaMonitoreoHandoffPromote, type CargaMonitoreoHandoffStatus } from "../../../api/client";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { ProcessingSourcesProfile } from "../CargaSourcesModel";

/**
 * Trae a Procesamiento el trabajo de campo ya validado de Monitoreo: confirma,
 * lo promueve, relee la revisión y deja el aviso con lo que entró.
 */
export async function traerTrabajoDeCampo({
  traspaso: handoffStatus,
  perfil: monitoringProfile,
  fuenteSeleccionada: selectedMonitoringSourceId,
  setError,
  setBusy,
  setAviso: setHandoffMessage,
  refresh,
  leerRevision: loadReconciliacion,
}: {
  traspaso: CargaMonitoreoHandoffStatus | null;
  perfil: ProcessingSourcesProfile | null;
  fuenteSeleccionada: string | null;
  setError: (mensaje: string) => void;
  setBusy: (mensaje: string) => void;
  setAviso: (mensaje: string) => void;
  refresh: () => Promise<void>;
  /** Relee la revisión y abre las variables extra si las hay. */
  leerRevision: (abrirSiHayExtra: boolean) => Promise<void>;
}) {
  if (
    !handoffStatus
    || (monitoringProfile !== "telefonico" && monitoringProfile !== "territorial")
  ) return;
  const selectedSource = handoffStatus.sources?.find(
    (source) => source.source_id === selectedMonitoringSourceId,
  );
  if (monitoringProfile === "telefonico" && handoffStatus.sources?.length && !selectedSource) {
    setError("Selecciona una fuente de Monitoreo antes de traerla a Procesamiento.");
    return;
  }
  const sourceLabel = selectedSource?.label || handoffStatus.source.label || "trabajo de campo";
  const processable = selectedSource?.counts.processable ?? handoffStatus.counts.processable;
  const replacement = handoffStatus.existing_base.present
    ? ` Reemplazará la base actual de ${formatoConteo(handoffStatus.existing_base.n_filas)} filas.`
    : " Creará la base de procesamiento con esta fuente.";
  if (!window.confirm(
    `¿Traer "${sourceLabel}" a Procesamiento?\n\n` +
    `${formatoConteo(processable)} respuestas procesables.${replacement}`,
  )) return;
  setError("");
  setHandoffMessage("");
  setBusy("Trayendo tu trabajo de campo al procesamiento…");
  try {
    const result = await apiCargaMonitoreoHandoffPromote(
      selectedMonitoringSourceId ? { source_id: selectedMonitoringSourceId } : {},
    );
    await refresh();
    // El handoff trae data de Monitoreo que puede incluir variables de
    // versiones viejas del formulario: ofrece reconciliarlas.
    await loadReconciliacion(true);
    const fr = result.filter_report ?? {};
    const nf = (n?: number) => formatoConteo(n ?? 0);
    const traidas = result.data?.n_filas ?? fr.filas_incluidas ?? 0;
    const desglose = [
      fr.validada != null ? `${nf(fr.validada)} validadas` : null,
      fr.revision ? `${nf(fr.revision)} en revisión` : null,
    ].filter(Boolean).join(", ");
    const excluidas = fr.no_defendible_excluidos
      ? ` ${nf(fr.no_defendible_excluidos)} excluidas por no defendibles.`
      : "";
    setHandoffMessage(
      `${nf(traidas)} respuestas traídas${desglose ? ` (${desglose})` : ""}.${excluidas} Ya puedes validar y codificar.`,
    );
  } catch (e: unknown) {
    setError((e as Error).message);
  } finally {
    setBusy("");
  }
}
