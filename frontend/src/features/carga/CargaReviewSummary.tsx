import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  ShieldCheck,
} from "../../vendor/lucide-react";
import type { CargaReviewPayload, CargaReviewSummaryPayload } from "../../api/client";
import { CargaReviewFuentesFindings } from "./CargaReviewFuentesFindings";
import { cargaReviewFuentesHallazgos } from "./cargaReviewFuentesModel";
import { smListaAcotada } from "./smEstructuraFuente";
import "./CargaReviewSummary.css";

// Una lista larga no puede desbordar la tarjeta: los primeros y «+N».
const OMITIDAS_VISIBLES = 3;
const ADOPTADAS_VISIBLES = 8;

function coverageMeta(count: number, total: number) {
  if (total <= 0) return "Sin bases";
  if (total === 1) return count >= 1 ? "Disponible" : "Pendiente";
  return `${Math.min(count, total)}/${total} bases`;
}

export function CargaReviewSummary({
  instrumentBaseCount,
  dataBaseCount,
  pendingChoiceMapping,
  extraVariableCount,
  allReady,
  isMultiBase,
  bases,
  review,
  reviewSummary,
  action,
}: {
  instrumentBaseCount: number;
  dataBaseCount: number;
  pendingChoiceMapping: boolean;
  extraVariableCount: number;
  allReady: boolean;
  isMultiBase: boolean;
  bases: number;
  review?: CargaReviewPayload | null;
  reviewSummary?: CargaReviewSummaryPayload | null;
  action?: ReactNode;
}) {
  const totalBases = isMultiBase ? Math.max(0, bases) : 1;
  const instrumentReady = totalBases > 0 && instrumentBaseCount >= totalBases;
  const dataReady = totalBases > 0 && dataBaseCount >= totalBases;
  const hasPartialCoverage = totalBases > 0 && (
    (instrumentBaseCount > 0 && !instrumentReady)
    || (dataBaseCount > 0 && !dataReady)
  );
  const incompatible = Boolean(review && (
    !review.compatibility.ok
    || review.compatibility.status === "incompatible"
    || review.compatibility.n_missing > 0
  ));
  const pendingExtraCount = review?.reconciliation.n_pendientes ?? extraVariableCount;
  // Advierte, no bloquea: la base con dos versiones se carga igual. Aparece
  // acá y no solo en Validación porque en este punto el campo puede seguir
  // abierto y todavía se puede corregir el proceso, no solo el dato.
  const procedencia = review?.procedencia ?? null;
  // Tampoco bloquea: código y etiqueta siguen coherentes. Lo que importa son
  // las omitidas, que no tienen los códigos del formulario del editor.
  const ordenEditor = review?.orden_editor ?? null;
  // ADR 0094: cómo se emparejó cada fuente de una base que junta encuestas.
  // Avisa o informa; no entra en `ready`.
  const fuentes = review?.fuentes ?? null;
  const fuentesHallazgos = cargaReviewFuentesHallazgos(fuentes);
  const hasFuentesFindings = fuentesHallazgos.length > 0;
  // Una fuente de otro instrumento no entró a la base: no bloquea (la base quedó
  // con las que sí calzan), pero el encabezado no puede decir «sin bloqueos» al
  // lado de esa tarjeta.
  const fuenteRechazada = fuentesHallazgos.some((hallazgo) => hallazgo.tono === "incompatible");
  const choiceMappingPending = pendingChoiceMapping || Boolean(review?.choice_mapping.pending);
  const hasDecision = choiceMappingPending || pendingExtraCount > 0;
  const selectedReviewReady = Boolean(review?.ready && allReady && !hasPartialCoverage);
  const aggregateReady = !isMultiBase || reviewSummary?.all_ready === true;
  const aggregateIncomplete = isMultiBase && Boolean(reviewSummary && !reviewSummary.all_ready);
  // En multibase el resumen es la única autoridad de avance. El detalle puede
  // llegar antes o después y no debe volver a imponer un gate local obsoleto.
  const reviewReady = isMultiBase ? aggregateReady : selectedReviewReady;
  const state = incompatible || hasDecision || hasPartialCoverage || aggregateIncomplete || fuenteRechazada
    ? "attention"
    : reviewReady
      ? "ready"
      : "pending";
  const title = incompatible
    ? "Incompatible con el formulario"
    : hasDecision
    ? "Hay decisiones que revisar"
    : hasPartialCoverage
      ? "Hay bases incompletas"
    : aggregateIncomplete
      ? selectedReviewReady
        ? "La base seleccionada está lista; el estudio aún no"
        : "El estudio todavía tiene bases bloqueadas"
    : isMultiBase && !reviewSummary
      ? "Verificando todas las bases"
    : fuenteRechazada
      ? "Una fuente no entró a la base"
    : reviewReady
      ? isMultiBase ? "Estudio sin incidencias bloqueantes" : "Carga sin incidencias bloqueantes"
      : allReady
        ? "La revisión todavía no está lista"
        : "Completa los insumos antes de revisar";
  const detail = incompatible
    ? "La base no coincide con la estructura requerida por el instrumento."
    : choiceMappingPending
    ? "Confirma el mapeo de códigos detectado en las respuestas."
    : pendingExtraCount > 0
      ? `Decide qué hacer con ${pendingExtraCount} variable${pendingExtraCount === 1 ? "" : "s"} extra de la data.`
      : hasPartialCoverage
        ? "Completa el formulario y las respuestas de cada base antes de continuar."
      : aggregateIncomplete
        ? "Revisa las bases bloqueadas antes de continuar a Validación."
      : isMultiBase && !reviewSummary
        ? "La base elegida se describe abajo; el avance depende del estudio completo."
      : fuenteRechazada
        ? "La base quedó con las fuentes que sí calzan. Revisa la que quedó fuera."
      : reviewReady
        ? "Comprueba el universo aplicado y continúa a la auditoría de respuestas."
        : allReady
          ? "Espera el resultado autoritativo antes de continuar."
          : "La bandeja se habilita cuando el formulario y las respuestas están disponibles.";
  const reviewScope = review?.base_nombre
    ? `Base revisada: ${review.base_nombre}`
    : isMultiBase
      ? "Base por revisar"
      : "Base única";

  return (
    <section
      className={`pulso-carga-review-summary is-${state}`}
      data-carga-surface="review"
      aria-labelledby="carga-review-title"
    >
      <header className="pulso-carga-review-head">
        <span className="pulso-carga-review-icon" aria-hidden="true">
          {state === "attention"
            ? <AlertTriangle size={18} />
            : state === "ready"
              ? <CheckCircle2 size={18} />
              : <ShieldCheck size={18} />}
        </span>
        <div>
          <h2 id="carga-review-title">{title}</h2>
          <p>{detail}</p>
        </div>
        <span className="pulso-carga-review-scope">
          {reviewScope}
        </span>
      </header>

      {isMultiBase && reviewSummary && (
        <div
          className={`pulso-carga-review-study-status${reviewSummary.all_ready ? " is-ready" : " is-attention"}`}
          role="status"
        >
          <ShieldCheck size={14} aria-hidden="true" />
          <strong>{reviewSummary.n_ready}/{reviewSummary.n_bases} bases sin bloqueos</strong>
          <span>
            {reviewSummary.all_ready
              ? "El estudio completo puede avanzar."
              : `${reviewSummary.n_blocked} base${reviewSummary.n_blocked === 1 ? "" : "s"} requiere${reviewSummary.n_blocked === 1 ? "" : "n"} atención.`}
          </span>
        </div>
      )}

      <ul className="pulso-carga-review-checks" aria-label="Comprobaciones de carga">
        <li className={instrumentReady ? "is-ready" : instrumentBaseCount > 0 ? "is-attention" : "is-pending"}>
          <FileSpreadsheet size={15} aria-hidden="true" />
          <span><strong>Instrumento</strong><small>{coverageMeta(instrumentBaseCount, totalBases)}</small></span>
        </li>
        <li className={dataReady ? "is-ready" : dataBaseCount > 0 ? "is-attention" : "is-pending"}>
          <Database size={15} aria-hidden="true" />
          <span><strong>Respuestas</strong><small>{coverageMeta(dataBaseCount, totalBases)}</small></span>
        </li>
        <li className={incompatible || hasDecision || aggregateIncomplete || fuenteRechazada ? "is-attention" : reviewReady ? "is-ready" : "is-pending"}>
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            <strong>Incidencias</strong>
            <small>
              {incompatible
                ? "Estructura incompatible"
                : hasDecision
                  ? "Requieren decisión"
                  : fuenteRechazada
                    ? "Una fuente quedó fuera"
                  : reviewReady
                    ? "Sin bloqueos"
                    : "En espera"}
            </small>
          </span>
        </li>
      </ul>

      {(incompatible || hasDecision || procedencia || ordenEditor || hasFuentesFindings) && (
        <ul
          className="pulso-carga-review-findings"
          aria-label="Incidencias de la base revisada"
          data-qa-geometry-group="carga-review-findings"
          data-qa-geometry-contract="intrinsic"
        >
          {ordenEditor && ordenEditor.omitidas.length > 0 && (
            <li className="is-pending">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                <strong>
                  {ordenEditor.omitidas.length === 1
                    ? "1 pregunta no sigue el orden de opciones del editor"
                    : `${ordenEditor.omitidas.length} preguntas no siguen el orden de opciones del editor`}
                </strong>
                <small
                  title={ordenEditor.omitidas.length > OMITIDAS_VISIBLES
                    ? ordenEditor.omitidas.map((o) => `${o.variable}: ${o.motivo}`).join(" · ")
                    : undefined}
                >
                  {ordenEditor.omitidas.slice(0, OMITIDAS_VISIBLES).map((o) => `${o.variable}: ${o.motivo}`).join(" · ")}
                  {ordenEditor.omitidas.length > OMITIDAS_VISIBLES ? ` +${ordenEditor.omitidas.length - OMITIDAS_VISIBLES}` : ""}
                </small>
              </span>
            </li>
          )}
          {procedencia && (
            <li className="is-pending">
              <FileSpreadsheet size={15} aria-hidden="true" />
              <span>
                <strong>
                  Se recolectó con {procedencia.n_versiones} versiones del formulario
                </strong>
                <small>{procedencia.mensaje}</small>
              </span>
            </li>
          )}
          {incompatible && (
            <li className="is-incompatible">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                <strong>Incompatible con el formulario</strong>
                <small>
                  {review?.compatibility.message
                    || `${review?.compatibility.n_missing ?? 0} variable${review?.compatibility.n_missing === 1 ? "" : "s"} requerida${review?.compatibility.n_missing === 1 ? "" : "s"} ausente${review?.compatibility.n_missing === 1 ? "" : "s"}.`}
                </small>
              </span>
            </li>
          )}
          <CargaReviewFuentesFindings fuentes={fuentes} tonos={["incompatible", "pending"]} />
          {pendingExtraCount > 0 && (
            <li className="is-pending">
              <Database size={15} aria-hidden="true" />
              <span>
                <strong>{pendingExtraCount} extra pendiente{pendingExtraCount === 1 ? "" : "s"}</strong>
                <small>Decide cuáles conservar antes de continuar.</small>
              </span>
            </li>
          )}
          {choiceMappingPending && (
            <li className="is-pending">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                <strong>Mapeo de códigos pendiente</strong>
                <small>Confirma las equivalencias detectadas en las respuestas.</small>
              </span>
            </li>
          )}
          {/* Datos neutros al final: informan, no piden nada. */}
          {ordenEditor && ordenEditor.editor_distinto.length > 0 && (
            <li className="is-pending">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                <strong>El editor tiene hoy otro orden de opciones</strong>
                <small title={ordenEditor.editor_distinto.join(", ")}>
                  La base conserva el orden con que se importó en {smListaAcotada(ordenEditor.editor_distinto, ADOPTADAS_VISIBLES)}.
                </small>
              </span>
            </li>
          )}
          {ordenEditor && ordenEditor.adoptadas.length > 0 && (
            <li className="is-info">
              <FileSpreadsheet size={15} aria-hidden="true" />
              <span>
                <strong>
                  {ordenEditor.adoptadas.length === 1
                    ? "1 pregunta usa el orden de opciones del editor"
                    : `${ordenEditor.adoptadas.length} preguntas usan el orden de opciones del editor`}
                </strong>
                <small title={ordenEditor.adoptadas.length > ADOPTADAS_VISIBLES ? ordenEditor.adoptadas.join(", ") : undefined}>
                  {smListaAcotada(ordenEditor.adoptadas, ADOPTADAS_VISIBLES)}
                </small>
              </span>
            </li>
          )}
          <CargaReviewFuentesFindings fuentes={fuentes} tonos={["info"]} />
        </ul>
      )}

      {action && reviewReady && <div className="pulso-carga-review-action">{action}</div>}
    </section>
  );
}
