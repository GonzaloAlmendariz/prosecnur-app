import {
  CheckCircle2,
  Circle,
  RefreshCw,
  ShieldAlert,
} from "../../../vendor/lucide-react";
import type { XlsformFormPublication } from "../../../api/client";
import {
  getFormPublicationView,
  isConfirmableLogicBlocker,
} from "./formPublicationView";
import type { FormWorkflowPrimaryAction } from "./formWorkflowView";

export type FormPublicationStatusProps = {
  formId: string;
  publication: XlsformFormPublication | null;
  isPublishing: boolean;
  isConfirmingLogic: boolean;
  error?: string | null;
  onPublish: () => void;
  onConfirmLogic: () => void;
  primaryAction?: FormWorkflowPrimaryAction;
  onAssignAudience?: () => void;
};

export function FormPublicationStatus({
  formId,
  publication,
  isPublishing,
  isConfirmingLogic,
  error,
  onPublish,
  onConfirmLogic,
  primaryAction,
  onAssignAudience,
}: FormPublicationStatusProps) {
  if (!publication) {
    return (
      <div className="pulso-xf-publication is-neutral" aria-busy="true">
        <div className="pulso-xf-publication-row">
          <span className="pulso-xf-publication-label">
            <RefreshCw size={13} aria-hidden="true" />
            Consultando revisión…
          </span>
        </div>
        <span className="pulso-xf-publication-live" aria-live="polite">
          Consultando el estado de publicación del formulario…
        </span>
      </div>
    );
  }
  const view = getFormPublicationView(publication, isPublishing);
  const logicBlocker = publication.blockers.find((blocker) => (
    isConfirmableLogicBlocker(blocker.id)
  ));
  const resolvedAction = primaryAction ?? (logicBlocker ? "review_logic" : undefined);
  const actionLabel = resolvedAction === "review_logic"
    ? (isConfirmingLogic ? "Guardando revisión…" : "Abrir y revisar lógica")
    : resolvedAction === "assign_audience"
      ? "Elegir público"
      : resolvedAction === "open"
        ? null
        : view.actionLabel;
  const actionDisabled = resolvedAction === "review_logic"
    ? isConfirmingLogic
    : resolvedAction === "assign_audience"
      ? false
      : view.actionDisabled;
  const actionHandler = resolvedAction === "review_logic"
    ? onConfirmLogic
    : resolvedAction === "assign_audience"
      ? onAssignAudience
      : onPublish;
  const reasonId = `pulso-xf-publication-reason-${formId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const StatusIcon = view.status === "published"
    ? CheckCircle2
    : view.status === "changes_pending"
      ? RefreshCw
      : view.status === "blocked"
        ? ShieldAlert
        : Circle;

  return (
    <div className={`pulso-xf-publication is-${view.tone}`}>
      <div className="pulso-xf-publication-row">
        <span className="pulso-xf-publication-label">
          <StatusIcon size={13} aria-hidden="true" />
          {view.label}
        </span>
        {actionLabel ? (
          <button
            type="button"
            className="pulso-xf-publication-action"
            disabled={actionDisabled}
            aria-describedby={view.reason ? reasonId : undefined}
            onClick={actionHandler}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {view.reason ? (
        <p id={reasonId} className="pulso-xf-publication-reason">
          {view.reason}
        </p>
      ) : null}
      {error ? <p className="pulso-xf-publication-error" role="alert">{error}</p> : null}
      <span className="pulso-xf-publication-live" aria-live="polite">
        {isPublishing
          ? "Publicando revisión del formulario…"
          : isConfirmingLogic
            ? "Confirmando la revisión manual de la lógica…"
            : ""}
      </span>
    </div>
  );
}
