import type { XlsformFormPublication } from "../../../api/client";
import type { InstrumentActorOption } from "./actorAssignmentModel";
import { isConfirmableLogicBlocker } from "./formPublicationView";

export type FormWorkflowTone = "neutral" | "success" | "warning" | "danger";

export type FormWorkflowStage = {
  label: string;
  tone: FormWorkflowTone;
  detail: string;
};

/**
 * `assign_audience` sigue en el tipo porque `FormPublicationStatus` lo sabe
 * pintar, pero esta vista ya no lo emite: el público nunca es obligatorio
 * (decisión del usuario, 2026-10-14).
 */
export type FormWorkflowPrimaryAction =
  | "review_logic"
  | "assign_audience"
  | "publish"
  | "open";

export type FormWorkflowView = {
  logic: FormWorkflowStage;
  /** `null` fuera de un estudio con públicos: ni etapa ni campo. */
  audience: FormWorkflowStage | null;
  processing: FormWorkflowStage;
  primaryAction: FormWorkflowPrimaryAction;
  /**
   * Borrador sin preguntas: lo único que impide publicar es que está vacío.
   * No es un error y no se pinta en rojo.
   */
  emptyDraft: boolean;
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

function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Raíces de los públicos de acreditación que un título suele nombrar. */
const RAICES_PUBLICO = ["estudiant", "docente", "administrativ", "egresad"] as const;

/**
 * Público sugerido por el título del formulario («… - Estudiantes» →
 * Estudiantes), sólo si existe en el catálogo del estudio y el título nombra
 * uno solo. Es una sugerencia que la persona acepta; nunca se asigna sola.
 */
export function suggestAudienceFromTitle(
  title: string,
  actorOptions: InstrumentActorOption[],
): InstrumentActorOption | null {
  const titulo = normalizarTexto(title);
  const nombradas = RAICES_PUBLICO.filter((raiz) => titulo.includes(raiz));
  if (nombradas.length !== 1) return null;
  const raiz = nombradas[0];
  const coincidentes = actorOptions.filter((option) => (
    normalizarTexto(`${option.actor} ${option.actor_key}`).includes(raiz)
  ));
  return coincidentes.length === 1 ? coincidentes[0] : null;
}

/**
 * Traduce el estado técnico de publicación a los tres hitos que una persona
 * necesita comprender antes de usar el instrumento en Procesamiento.
 */
export function getFormWorkflowView(
  publication: XlsformFormPublication,
  actorOptions: InstrumentActorOption[],
  actorKey: string | null | undefined,
  /** El estudio trabaja con públicos (acreditación). Aun así es opcional. */
  audienceApplies = true,
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

  // El público nunca es obligatorio. Fuera de un estudio con públicos no se
  // muestra (antes salía «No requerido»: ruido); dentro, es opcional y neutro.
  const audience: FormWorkflowStage | null = !audienceApplies
    ? null
    : actor
      ? {
          label: instrumentActorLabel(actor),
          tone: "success",
          detail: "Procesamiento reconocerá las bases de este público.",
        }
      : actorKey
        ? {
            label: "Opcional",
            tone: "neutral",
            detail: "La asignación anterior ya no existe en el estudio. Puedes elegir otra o publicar sin público.",
          }
        : {
            label: "Opcional",
            tone: "neutral",
            detail: "Puedes publicar sin público; asignarlo ayuda a Procesamiento a reconocer la base.",
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
    : publication.can_publish
      ? "publish"
      : "open";

  // Vacío y nada más: los bloqueos de lógica de un formulario sin preguntas
  // son moot (no hay saltos que revisar), y los de público ya no existen (un
  // backend anterior a 2026-10-14 aún puede mandarlos). Cualquier otro bloqueo
  // es real.
  const emptyDraft = sinPreguntas && publication.blockers.every((blocker) => (
    blocker.id === "no_substantive_questions"
    || blocker.id === "actor_required"
    || blocker.id === "actor_not_in_catalog"
    || isConfirmableLogicBlocker(blocker.id)
  ));

  return { logic, audience, processing, primaryAction, emptyDraft };
}
