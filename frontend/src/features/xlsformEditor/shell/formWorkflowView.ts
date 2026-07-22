import type { XlsformFormPublication } from "../../../api/client";
import type { InstrumentActorOption } from "./actorAssignmentModel";
import { isConfirmableLogicBlocker } from "./formPublicationView";

export type FormWorkflowTone = "neutral" | "success" | "warning" | "danger";

export type FormWorkflowStage = {
  label: string;
  tone: FormWorkflowTone;
  detail: string;
};

export type FormWorkflowPrimaryAction =
  | "review_logic"
  | "assign_audience"
  | "publish"
  | "open";

export type FormWorkflowView = {
  logic: FormWorkflowStage;
  audience: FormWorkflowStage;
  processing: FormWorkflowStage;
  primaryAction: FormWorkflowPrimaryAction;
};

export function instrumentActorLabel(option: InstrumentActorOption): string {
  const humanName = option.actor.trim();
  if (humanName && humanName !== option.actor_key) return humanName;
  const readableKey = option.actor_key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return readableKey
    ? `${readableKey.charAt(0).toUpperCase()}${readableKey.slice(1)}`
    : "Público configurado";
}

/**
 * Traduce el estado técnico de publicación a los tres hitos que una persona
 * necesita comprender antes de usar el instrumento en Procesamiento.
 */
export function getFormWorkflowView(
  publication: XlsformFormPublication,
  actorOptions: InstrumentActorOption[],
  actorKey: string | null | undefined,
  audienceRequired = true,
): FormWorkflowView {
  const logicNeedsReview = publication.blockers.some((blocker) => (
    isConfirmableLogicBlocker(blocker.id)
  ));
  const actor = actorOptions.find((option) => option.actor_key === actorKey);
  const revisionNo = publication.latest_revision?.revision_no;
  const hasAvailableRevision = revisionNo != null;

  const logic: FormWorkflowStage = logicNeedsReview
    ? {
        label: "Revisión necesaria",
        tone: "warning",
        detail: "Abre el formulario y revisa sus saltos antes de confirmar la lógica.",
      }
    : {
        label: "Lista",
        tone: "success",
        detail: "La estructura lógica no tiene revisiones pendientes.",
      };

  const audience: FormWorkflowStage = !audienceRequired
    ? actorKey
      ? {
          label: "Asignación conservada",
          tone: "success",
          detail: "El proyecto ya validó esta asignación; no necesitas cambiarla para publicar.",
        }
      : {
          label: "No requerido",
          tone: "neutral",
          detail: "Este tipo de proyecto puede publicar el instrumento sin asignar un público.",
        }
    : actor
      ? {
          label: instrumentActorLabel(actor),
          tone: "success",
          detail: "Este es el público que reconocerá Procesamiento.",
        }
      : {
          label: "Elige un público",
          tone: "warning",
          detail: "Asigna a quién responde este instrumento antes de publicarlo.",
        };

  let processing: FormWorkflowStage;
  if (!hasAvailableRevision) {
    processing = {
      label: "Aún no disponible",
      tone: "neutral",
      detail: "Procesamiento se habilita cuando publiques la primera revisión.",
    };
  } else if (publication.status === "published" && publication.blockers.length === 0) {
    processing = {
      label: `Disponible · revisión ${revisionNo}`,
      tone: "success",
      detail: "Esta revisión está fijada y lista para procesar.",
    };
  } else {
    processing = {
      label: `Revisión ${revisionNo} disponible; hay cambios sin publicar`,
      tone: "warning",
      detail: "El borrador actual no reemplaza la revisión que ya está disponible.",
    };
  }

  const primaryAction: FormWorkflowPrimaryAction = logicNeedsReview
    ? "review_logic"
    : audienceRequired && !actor
      ? "assign_audience"
      : publication.can_publish
        ? "publish"
        : "open";

  return { logic, audience, processing, primaryAction };
}
