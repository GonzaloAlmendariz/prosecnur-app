import type { XlsformFormPublication, XlsformPublicationStatus } from "../../../api/client";

export type FormPublicationTone = "neutral" | "success" | "warning" | "danger";

export type FormPublicationBlockerView = {
  id: string;
  title: string;
  detail: string;
  /** Fila del survey a la que apunta, si el diagnóstico la trae. */
  rowIndex?: number;
};

export type FormPublicationView = {
  status: XlsformPublicationStatus;
  label: string;
  tone: FormPublicationTone;
  actionLabel: string | null;
  actionDisabled: boolean;
  reason: string | null;
  /**
   * Todo lo que impide publicar, no solo lo primero.
   *
   * Antes `reason` concatenaba el primer blocker y contaba el resto ("Hay 3
   * observaciones adicionales"), así que el usuario veía un rojo permanente
   * sin manera de enterarse de qué eran las otras tres ni dónde estaban.
   */
  blockers: FormPublicationBlockerView[];
};

const CONFIRMABLE_LOGIC_BLOCKER_IDS = new Set([
  "logic_pending_manual_confirmation",
  "logic_confirmation_stale",
  "logic_variant_pending_manual_confirmation",
  "logic_variant_confirmation_stale",
]);

export function isConfirmableLogicBlocker(blockerId: string): boolean {
  return CONFIRMABLE_LOGIC_BLOCKER_IDS.has(blockerId);
}

/**
 * Deriva toda la presentación de publicación sin estado local. Los blockers
 * tienen precedencia sobre un status remoto contradictorio para no ofrecer una
 * acción que el propio backend acaba de declarar insegura.
 */
export function getFormPublicationView(
  publication: XlsformFormPublication,
  isPublishing = false,
): FormPublicationView {
  const status: XlsformPublicationStatus = publication.blockers.length > 0
    ? "blocked"
    : publication.status;
  const hasPublishedRevision = publication.latest_revision != null;
  const blockers: FormPublicationBlockerView[] = publication.blockers.map((blocker) => ({
    id: blocker.id,
    title: blocker.title,
    detail: blocker.detail,
    rowIndex: blocker.rowIndex,
  }));

  if (status === "published") {
    return {
      status,
      label: `Disponible · revisión ${publication.latest_revision?.revision_no ?? "—"}`,
      tone: "success",
      actionLabel: null,
      actionDisabled: true,
      reason: null,
      blockers,
    };
  }

  const actionLabel = isPublishing
    ? "Publicando…"
    : hasPublishedRevision
      ? "Publicar nueva revisión"
      : "Publicar";

  if (status === "blocked") {
    const count = blockers.length;
    return {
      status,
      // Cuántos, no solo que sí. "Publicación bloqueada" a secas no le decía
      // al usuario si le faltaba una cosa o siete.
      label: count === 1
        ? "Falta 1 corrección para publicar"
        : `Faltan ${count} correcciones para publicar`,
      tone: "danger",
      actionLabel,
      actionDisabled: true,
      reason: hasPublishedRevision
        ? `La revisión ${publication.latest_revision?.revision_no} sigue disponible para Procesamiento mientras corriges el borrador.`
        : null,
      blockers,
    };
  }

  const cannotPublishReason = !publication.can_publish
    ? "El formulario aún no está listo para publicarse. Actualiza la biblioteca y revisa sus validaciones."
    : null;

  return {
    status,
    label: status === "changes_pending" && hasPublishedRevision
      ? `Revisión ${publication.latest_revision?.revision_no} disponible`
      : status === "changes_pending"
        ? "Cambios sin publicar"
        : "Borrador",
    tone: status === "changes_pending" ? "warning" : "neutral",
    actionLabel,
    actionDisabled: isPublishing || !publication.can_publish,
    reason: status === "changes_pending" && hasPublishedRevision
      ? "El borrador tiene cambios, pero no reemplaza la revisión disponible hasta que lo publiques."
      : cannotPublishReason,
    blockers,
  };
}
