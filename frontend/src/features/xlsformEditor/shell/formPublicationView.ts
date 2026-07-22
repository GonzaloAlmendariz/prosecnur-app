import type { XlsformFormPublication, XlsformPublicationStatus } from "../../../api/client";

export type FormPublicationTone = "neutral" | "success" | "warning" | "danger";

export type FormPublicationView = {
  status: XlsformPublicationStatus;
  label: string;
  tone: FormPublicationTone;
  actionLabel: string | null;
  actionDisabled: boolean;
  reason: string | null;
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

  if (status === "published") {
    return {
      status,
      label: `Disponible · revisión ${publication.latest_revision?.revision_no ?? "—"}`,
      tone: "success",
      actionLabel: null,
      actionDisabled: true,
      reason: null,
    };
  }

  const actionLabel = isPublishing
    ? "Publicando…"
    : hasPublishedRevision
      ? "Publicar nueva revisión"
      : "Publicar";

  if (status === "blocked") {
    const firstBlocker = publication.blockers[0];
    const blockerDetail = firstBlocker?.detail || firstBlocker?.title;
    const remainingBlockers = Math.max(0, publication.blockers.length - 1);
    const blockerSummary = blockerDetail
      ? ` Para publicar, corrige: ${blockerDetail}${remainingBlockers > 0
        ? ` Hay ${remainingBlockers} ${remainingBlockers === 1
          ? "observación adicional"
          : "observaciones adicionales"}.`
        : ""}`
      : " Revisa las observaciones antes de publicar.";
    return {
      status,
      label: "Publicación bloqueada",
      tone: "danger",
      actionLabel,
      actionDisabled: true,
      reason: hasPublishedRevision
        ? `Puedes abrir y editar el borrador. La revisión ${publication.latest_revision?.revision_no} sigue disponible.${blockerSummary}`
        : `Puedes abrir y editar el formulario.${blockerSummary}`,
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
  };
}
