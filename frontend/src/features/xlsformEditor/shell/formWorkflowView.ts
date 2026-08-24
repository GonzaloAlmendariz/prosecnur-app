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

  // **Un formulario vacío no tiene la lógica lista: no tiene lógica.**
  //
  // `logicNeedsReview` mira si hay bloqueadores de lógica que confirmar, y un
  // instrumento sin preguntas no tiene ninguno — así que salía en verde
  // «Lista · La estructura lógica no tiene revisiones pendientes». Visto en
  // pantalla el 2026-08-23: la tarjeta «Nuevo formulario» decía eso con **0
  // preguntas y 0 secciones**, tres centímetros encima de su propio aviso
  // «Instrumento sin preguntas sustantivas».
  //
  // Es verde por ausencia: el chip afirma sobre un conjunto vacío. Y no es
  // inocuo, porque los tres hitos de la tarjeta existen para decir de un
  // vistazo qué falta; uno en verde dice que eso ya está.
  const sinPreguntas = publication.blockers.some(
    (blocker) => blocker.id === "no_substantive_questions",
  );
  const logic: FormWorkflowStage = sinPreguntas
    ? {
        label: "Sin preguntas",
        tone: "neutral",
        detail: "La lógica aparece cuando el formulario tenga preguntas que enlazar.",
      }
    : logicNeedsReview
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

  // Qué bases están usando de verdad este instrumento. Es la diferencia entre
  // "publicaste" y "sirvió": una revisión publicada que ninguna base usa no
  // está teniendo efecto sobre Procesamiento, y el hub tiene que decirlo.
  const boundBases = publication.bound_bases ?? [];
  const basesAlDia = boundBases.filter((bound) => bound.is_latest);
  const basesAtrasadas = boundBases.filter((bound) => !bound.is_latest);
  const nombrarBases = (bases: typeof boundBases) => bases
    .map((bound) => `«${bound.base}»`)
    .join(", ");

  let processing: FormWorkflowStage;
  if (!hasAvailableRevision) {
    processing = {
      label: "Aún no disponible",
      tone: "neutral",
      detail: "Procesamiento se habilita cuando publiques la primera revisión.",
    };
  } else if (basesAlDia.length > 0) {
    processing = {
      label: basesAlDia.length === 1
        ? `En uso por ${nombrarBases(basesAlDia)}`
        : `En uso por ${basesAlDia.length} bases`,
      tone: "success",
      detail: basesAtrasadas.length > 0
        ? `${nombrarBases(basesAtrasadas)} sigue con una revisión anterior; vuelve a cargar ahí el XLSForm de esta.`
        : `Validación y Analítica leen las decisiones de la revisión ${revisionNo}.`,
    };
  } else if (basesAtrasadas.length > 0) {
    processing = {
      label: `${nombrarBases(basesAtrasadas)} usa una revisión anterior`,
      tone: "warning",
      detail: `Para que tome la revisión ${revisionNo}, exporta el XLSForm y vuelve a cargarlo en Procesamiento.`,
    };
  } else if (publication.status === "published" && publication.blockers.length === 0) {
    processing = {
      label: `Publicada · revisión ${revisionNo}`,
      tone: "neutral",
      // El enlace se hace comparando el instrumento, no por el nombre del
      // archivo ni por el tipo de estudio.
      detail: "Ninguna base la usa todavía. Carga en Procesamiento el XLSForm exportado de este formulario para ligarla.",
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
