import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  RefreshCw,
  ShieldAlert,
} from "../../../vendor/lucide-react";
import type { ReactNode } from "react";
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
  /** @deprecated El público es opcional; ya no hay acción «Elegir público». */
  onAssignAudience?: () => void;
  /**
   * Abrir el formulario para corregir. Es la salida de los bloqueos
   * estructurales: no se resuelven desde la tarjeta, se resuelven adentro.
   */
  onOpen?: () => void;
  /**
   * Segunda vía junto a la acción, en su propia fila: declarar la lógica hecha
   * fuera de Prosecnur, o deshacer esa declaración.
   */
  alterna?: ReactNode;
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
  onOpen,
  alterna,
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
  // El público nunca es obligatorio (2026-10-14): «Elegir público» no puede
  // tapar «Publicar». Un llamador viejo que aún pida `assign_audience` cae en
  // la acción de publicación.
  const pedida = primaryAction === "assign_audience" ? undefined : primaryAction;
  const resolvedAction = pedida ?? (logicBlocker ? "review_logic" : undefined);
  // `open` es la acción de los bloqueos que no se arreglan desde la tarjeta
  // (names duplicados, catálogos ausentes, grupos descuadrados). Antes caía en
  // `actionLabel = null` y la tarjeta quedaba en rojo sin ningún control: el
  // usuario leía "Publicación bloqueada" y no tenía adónde ir.
  const actionLabel = resolvedAction === "review_logic"
    ? (isConfirmingLogic ? "Guardando revisión…" : "Revisar lógica")
    : resolvedAction === "open"
      ? (view.status === "blocked" ? "Abrir y corregir" : null)
      : view.actionLabel;
  const actionDisabled = resolvedAction === "review_logic"
    ? isConfirmingLogic
    : resolvedAction === "open"
      ? false
      : view.actionDisabled;
  const actionHandler = resolvedAction === "review_logic"
    ? onConfirmLogic
    : resolvedAction === "open"
      ? onOpen
      : onPublish;
  const reasonId = `pulso-xf-publication-reason-${formId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  // Los pasos (confirmar la lógica) no se listan: la etapa y la acción ya los
  // nombran. Sólo los errores van en la lista roja.
  const errores = view.blockers.filter((blocker) => blocker.kind === "error");
  const StatusIcon = view.status === "published"
    ? CheckCircle2
    : view.status === "changes_pending"
      ? RefreshCw
      : view.status === "blocked" && view.tone === "danger"
        ? ShieldAlert
        : view.status === "blocked"
          ? AlertTriangle
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
      {alterna ? <div className="pulso-xf-publication-alterna">{alterna}</div> : null}
      {view.reason ? (
        <p id={reasonId} className="pulso-xf-publication-reason">
          {view.reason}
        </p>
      ) : null}
      {view.status === "blocked" && errores.length > 0 ? (
        <ul className="pulso-xf-publication-blockers">
          {errores.map((blocker) => (
            <li key={blocker.id} className="pulso-xf-publication-blocker">
              <strong>{blocker.title}</strong>
              {blocker.detail ? <span>{blocker.detail}</span> : null}
            </li>
          ))}
        </ul>
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
