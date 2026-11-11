import { ArrowRightLeft } from "../../../vendor/lucide-react";
import type {
  CargaReviewPayload,
  CargaReviewSummaryPayload,
  ChoiceCodeMapReview,
} from "../../../api/client";
import { CargaReviewSummary } from "../CargaReviewSummary";
import { CargaUniverseFilter } from "../CargaUniverseFilter";
import { OrigenExternoPanel } from "../OrigenExternoPanel";
import { ContinuarCTA } from "./ContinuarCTA";

type Comun = {
  ocupado: boolean;
  /** La revisión de la base elegida todavía no llega. */
  leyendo: boolean;
  revision: CargaReviewPayload | null;
  mapeoPendiente: boolean;
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  todoListo: boolean;
  onRevisarMapeo: (mapeo: ChoiceCodeMapReview) => void;
  onLecturaUniverso: (base: string, leida: boolean) => void;
  /** Qué se vuelve a leer al aplicar el filtro de universo: cambia según la variante. */
  onUniversoAplicado: () => void;
};

export type PestanaRevisionProps = Comun & {
  varias: boolean;
  /** Varias bases: bases primarias, base elegida y avance de todas. */
  basesPrimarias: string[];
  baseElegida: string;
  onCambiarBase: (nombre: string) => void;
  resumenDeBases: CargaReviewSummaryPayload | null;
  formulariosEnBases: number;
  respuestasEnBases: number;
  /** Una base: cuántas bases declara la sesión. */
  basesDeLaSesion: number;
  /** Con la lectura hecha y sin pendientes se ofrece ir a Validación. */
  puedeContinuar: boolean;
};

/** Revisión: compatibilidad, mapeo de códigos y variables extra de la base elegida. */
export function PestanaRevision(props: PestanaRevisionProps) {
  const {
    varias, ocupado, leyendo, revision, mapeoPendiente, tieneFormulario, tieneRespuestas, todoListo,
    onRevisarMapeo, onLecturaUniverso, onUniversoAplicado, basesPrimarias, baseElegida, onCambiarBase,
    resumenDeBases, formulariosEnBases, respuestasEnBases, basesDeLaSesion, puedeContinuar,
  } = props;
  const botonMapeo = revision?.choice_mapping.pending && revision.choice_mapping.maps.length > 0 && (
    <button
      type="button"
      className="pulso-carga-review-mapping-button"
      onClick={() => onRevisarMapeo({
        applied: revision.choice_mapping.applied,
        requires_confirmation: revision.choice_mapping.requires_confirmation,
        n_questions: revision.choice_mapping.n_questions,
        maps: revision.choice_mapping.maps,
      })}
      disabled={ocupado}
    >
      <ArrowRightLeft size={14} aria-hidden="true" />
      Revisar mapeo
    </button>
  );

  if (varias) {
    return (
      <>
        <div className="pulso-carga-review-toolbar">
          <label className="pulso-carga-review-base-field">
            <span id="pulso-carga-review-base-label">Base revisada</span>
            {/* Nombre por `aria-labelledby`: dentro del label, el nombre
                accesible arrastraba la opción elegida. */}
            <select
              aria-labelledby="pulso-carga-review-base-label"
              value={baseElegida}
              onChange={(event) => onCambiarBase(event.target.value)}
              disabled={ocupado}
            >
              {basesPrimarias.map((nombre) => (
                <option key={nombre} value={nombre}>{nombre}</option>
              ))}
            </select>
          </label>
          {botonMapeo}
          {baseElegida && (
            <CargaUniverseFilter
              baseNombre={baseElegida}
              disabled={ocupado}
              onLectura={onLecturaUniverso}
              onApplied={onUniversoAplicado}
            />
          )}
          {baseElegida && (
            <OrigenExternoPanel baseNombre={baseElegida} disabled={ocupado} />
          )}
        </div>
        <CargaReviewSummary
          instrumentBaseCount={formulariosEnBases}
          dataBaseCount={respuestasEnBases}
          pendingChoiceMapping={mapeoPendiente}
          extraVariableCount={revision?.reconciliation.n_pendientes ?? 0}
          allReady={todoListo}
          isMultiBase
          bases={basesPrimarias.length}
          review={revision}
          reviewSummary={resumenDeBases}
          action={puedeContinuar ? <ContinuarCTA /> : undefined}
          leyendo={leyendo}
          baseSeleccionada={baseElegida}
        />
      </>
    );
  }

  return (
    <>
      {botonMapeo}
      {tieneRespuestas && !mapeoPendiente && (
        <CargaUniverseFilter
          disabled={ocupado}
          onLectura={onLecturaUniverso}
          onApplied={onUniversoAplicado}
        />
      )}
      {tieneRespuestas && !mapeoPendiente && <OrigenExternoPanel disabled={ocupado} />}
      <CargaReviewSummary
        instrumentBaseCount={Number(tieneFormulario)}
        dataBaseCount={Number(tieneRespuestas)}
        pendingChoiceMapping={mapeoPendiente}
        extraVariableCount={revision?.reconciliation.n_pendientes ?? 0}
        allReady={todoListo}
        isMultiBase={false}
        bases={basesDeLaSesion}
        review={revision}
        action={puedeContinuar ? <ContinuarCTA /> : undefined}
        leyendo={leyendo}
      />
    </>
  );
}
