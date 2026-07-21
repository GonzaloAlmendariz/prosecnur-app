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

function blockerReason(publication: XlsformFormPublication): string | null {
  const blocker = publication.blockers[0];
  if (!blocker) return null;
  return blocker.detail ? `${blocker.title}: ${blocker.detail}` : blocker.title;
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
      label: `Publicado · rev. ${publication.latest_revision?.revision_no ?? "—"}`,
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
    return {
      status,
      label: "Bloqueado",
      tone: "danger",
      actionLabel,
      actionDisabled: true,
      reason: blockerReason(publication) ?? "Corrige los bloqueos del formulario antes de publicarlo.",
    };
  }

  const cannotPublishReason = !publication.can_publish
    ? "El formulario aún no está listo para publicarse. Actualiza la biblioteca y revisa sus validaciones."
    : null;

  return {
    status,
    label: status === "changes_pending" ? "Cambios sin publicar" : "Borrador",
    tone: status === "changes_pending" ? "warning" : "neutral",
    actionLabel,
    actionDisabled: isPublishing || !publication.can_publish,
    reason: cannotPublishReason,
  };
}
