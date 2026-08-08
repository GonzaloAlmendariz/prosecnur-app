// =============================================================================
// shell/FormsLibrary.tsx — "Espacio de formularios" del proyecto
// =============================================================================
// Homepage del editor cuando no hay workbook abierto. Es un único espacio de
// trabajo coherente para 0..MAX_FORMS formularios en paralelo:
//   - encabezado que comunica la capacidad (hasta 6 por proyecto),
//   - grilla de slots: los formularios existentes (FormCard) + una tarjeta de
//     creación (AddFormCard) mientras hay cupo + placeholders tenues que
//     insinúan los slots libres restantes,
//   - al llegar al tope: sin tarjeta de creación, con una nota sutil,
//   - guía educativa "Cómo funciona" al pie.
//
// El estado vacío ya NO es una pantalla aparte: es el mismo espacio con la
// tarjeta de creación en modo "hero". El contenedor externo registra
// `data-audit-ready` para el QA visual.
//
// Mientras el índice del backend no contestó (`loading`), este espacio muestra
// su encabezado definitivo y una grilla de placeholders. Nunca la variante
// "welcome": afirmar "no tienes formularios" antes de saberlo es justo lo que
// producía el doble homepage — hero de creación primero, biblioteca real
// después. Aquí el marco no cambia; solo se llena.
//
// Las métricas de cada tarjeta se calculan sobre el workbook en localStorage
// (loadForm) — el endpoint list del backend es liviano a propósito y no trae
// workbooks. Si un formulario no tiene copia local (existe solo en el .pulso
// de otra máquina), la tarjeta muestra ceros sin romper.
// =============================================================================

import { useMemo, type ReactNode } from "react";
import { Layers, Lock, TriangleAlert } from "../../../vendor/lucide-react";
import type { XlsformFormPublication } from "../../../api/client";
import { AddFormCard } from "./AddFormCard";
import { FormCard, type ActorCatalogStatus } from "./FormCard";
import { HubFlowDiagram } from "./HubFlowDiagram";
import { computeFormMetrics, type FormCardMetrics } from "./formCardMetrics";
import { computeHomeSlots } from "./homeSlots";
import type { InstrumentActorOption } from "./actorAssignmentModel";
import {
  loadForm,
  MAX_FORMS,
  type LibraryEntry,
  type ProjectScope,
} from "../state/persistence";
import "../styles/xf-home.css";

export type FormsLibraryProps = {
  forms: LibraryEntry[];
  activeFormId: string | null;
  /** Scope del proyecto — necesario para leer los workbooks locales (métricas). */
  scope: ProjectScope;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
  onDuplicate?: (id: string) => void;
  publications: Record<string, XlsformFormPublication>;
  publishingFormId: string | null;
  confirmingLogicFormId: string | null;
  publicationErrors: Record<string, string>;
  onPublish: (id: string) => void;
  onConfirmLogic: (id: string) => void;
  actorOptions: InstrumentActorOption[];
  onActorChange: (id: string, actorKey: string) => void;
  actorCatalogStatus?: ActorCatalogStatus;
  assigningActorFormId?: string | null;
  resumeBanner?: ReactNode;
  /** El índice del proyecto todavía no contestó: se pinta el espacio en carga. */
  loading?: boolean;
  /** El índice no se pudo leer. Sin formularios locales no sabemos si hay. */
  loadFailed?: boolean;
  onRetryLoad?: () => void;
};

export function FormsLibrary({
  forms,
  activeFormId,
  scope,
  onOpen,
  onDelete,
  onRename,
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
  onDuplicate,
  publications,
  publishingFormId,
  confirmingLogicFormId,
  publicationErrors,
  onPublish,
  onConfirmLogic,
  actorOptions,
  onActorChange,
  actorCatalogStatus = "ready",
  assigningActorFormId = null,
  resumeBanner,
  loading = false,
  loadFailed = false,
  onRetryLoad,
}: FormsLibraryProps) {
  // Métricas por formulario, calculadas sobre el workbook local. Se recomputa
  // cuando cambia la identidad del array `forms` (cada save reemite el índice).
  const metricsById = useMemo(() => {
    const map = new Map<string, FormCardMetrics>();
    for (const entry of forms) {
      const snap = loadForm(scope, entry.id);
      const local = computeFormMetrics(snap?.workbook ?? null);
      // Si el workbook aún no está en esta máquina (formulario no abierto),
      // computeFormMetrics da 0/0: caemos a los conteos que calculó el backend
      // sobre el .pulso (entry.nQuestions/nSections) para no mostrar tarjetas
      // "vacías" que en realidad tienen contenido.
      const metrics =
        local.questions > 0 || local.sections > 0
          ? local
          : {
              questions: entry.nQuestions ?? local.questions,
              sections: entry.nSections ?? local.sections,
            };
      map.set(entry.id, metrics);
    }
    return map;
  }, [forms, scope]);

  const slots = computeHomeSlots(forms.length);
  // Solo afirmamos "vacío" cuando lo sabemos. En carga no lo sabemos todavía;
  // con el índice caído y sin copia local, tampoco. `empty` gobierna el hero,
  // el subtítulo y el diagrama, y equivocarse ahí es el doble homepage.
  const unknown = loading || (loadFailed && slots.empty);
  const empty = !unknown && slots.empty;
  const { count, atLimit, canCreate, ghostSlots } = slots;

  return (
    <section
      className={`pulso-xf-home${empty ? " pulso-xf-home--welcome" : ""}${
        loading ? " is-loading" : ""
      }`}
      aria-label="Espacio de formularios del proyecto"
      aria-busy={loading || undefined}
      data-audit-ready={loading ? "false" : "true"}
    >
      <header className="pulso-xf-home-head">
        <div className="pulso-xf-home-head-text">
          <span className="pulso-xf-home-eyebrow">
            <Layers size={13} /> Espacio de trabajo
          </span>
          <h2 className="pulso-xf-home-title">Espacio de formularios</h2>
          <p className="pulso-xf-home-subtitle">
            {loading
              ? "Abriendo los formularios de este proyecto…"
              : unknown
                ? "No pudimos leer los formularios de este proyecto."
                : empty
                  ? "Diseña, importa o traduce hasta seis formularios en paralelo dentro de este proyecto."
                  : "Abre uno para seguir editándolo o crea otro. Puedes tener hasta seis formularios en paralelo en este proyecto."}
          </p>
        </div>
      </header>

      {resumeBanner ? <div className="pulso-xf-home-resume">{resumeBanner}</div> : null}

      {loadFailed && !loading ? (
        <p className="pulso-xf-home-load-error" role="alert">
          <TriangleAlert size={13} aria-hidden="true" />
          <span>
            No pudimos leer la biblioteca del proyecto
            {slots.empty
              ? ". Puede tener formularios que todavía no se ven aquí."
              : ". Se muestran los formularios guardados en este equipo."}
          </span>
          {onRetryLoad ? (
            <button type="button" className="pulso-xf-home-load-retry" onClick={onRetryLoad}>
              Reintentar
            </button>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <div className="pulso-xf-home-slots" data-slot-count={0} aria-hidden="true">
          {[0, 1].map((i) => (
            <span key={`skeleton-${i}`} className="pulso-xf-home-slot-skeleton" />
          ))}
        </div>
      ) : (
      <div className="pulso-xf-home-slots" data-slot-count={count}>
        {forms.map((entry) => (
          <FormCard
            key={entry.id}
            entry={entry}
            metrics={metricsById.get(entry.id) ?? { questions: 0, sections: 0 }}
            isActive={entry.id === activeFormId}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            publication={publications[entry.id] ?? null}
            isPublishing={publishingFormId === entry.id}
            isConfirmingLogic={confirmingLogicFormId === entry.id}
            publicationError={publicationErrors[entry.id]}
            onPublish={onPublish}
            onConfirmLogic={onConfirmLogic}
            actorOptions={actorOptions}
            onActorChange={onActorChange}
            actorCatalogStatus={actorCatalogStatus}
            isAssigningActor={assigningActorFormId === entry.id}
          />
        ))}

        {canCreate && (
          <AddFormCard
            // `key` por variante: al pasar de biblioteca vacía (hero, expandida)
            // a poblada (tile, colapsada) remonta la tarjeta y resetea su estado
            // interno de expansión — si no, el flash inicial de 0 formularios la
            // dejaba abierta al hidratar la lista.
            key={empty ? "add-hero" : "add-tile"}
            variant={empty ? "hero" : "tile"}
            onNewBlank={onNewBlank}
            onImportXls={onImportXls}
            onImportSurveyMonkey={onImportSurveyMonkey}
          />
        )}

        {Array.from({ length: ghostSlots }).map((_, i) => (
          <span
            key={`ghost-${i}`}
            className="pulso-xf-home-slot-ghost"
            aria-hidden="true"
          />
        ))}
      </div>
      )}

      {atLimit && !loading && (
        <p className="pulso-xf-home-limit-note" role="note">
          <Lock size={13} aria-hidden="true" />
          Límite de {MAX_FORMS} formularios por proyecto. Elimina uno para crear
          otro.
        </p>
      )}

      {loading ? null : (
        <footer className={`pulso-xf-home-guide${empty ? "" : " is-compact"}`}>
          <span className="pulso-xf-home-guide-eyebrow">Cómo funciona</span>
          <p className="pulso-xf-home-guide-copy">
            {empty
              ? "Construye el instrumento paso a paso; el editor guarda los cambios automáticamente."
              : "Origen, lógica y público preparan una revisión estable para Procesamiento."}
          </p>
          {empty ? <HubFlowDiagram /> : null}
        </footer>
      )}
    </section>
  );
}
