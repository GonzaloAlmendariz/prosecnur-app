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

export type FormPublicationStatusProps = {
  formId: string;
  publication: XlsformFormPublication;
  isPublishing: boolean;
  isConfirmingLogic: boolean;
  error?: string | null;
  onPublish: () => void;
  onConfirmLogic: () => void;
};

export function FormPublicationStatus({
  formId,
  publication,
  isPublishing,
  isConfirmingLogic,
  error,
  onPublish,
  onConfirmLogic,
}: FormPublicationStatusProps) {
  const view = getFormPublicationView(publication, isPublishing);
  const logicBlocker = publication.blockers.find((blocker) => (
    isConfirmableLogicBlocker(blocker.id)
  ));
  const actionLabel = logicBlocker
    ? (isConfirmingLogic ? "Confirmando…" : "Confirmar lógica revisada")
    : view.actionLabel;
  const actionDisabled = logicBlocker
    ? isConfirmingLogic || !publication.draft_content_sha256
    : view.actionDisabled;
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
            onClick={logicBlocker ? onConfirmLogic : onPublish}
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
