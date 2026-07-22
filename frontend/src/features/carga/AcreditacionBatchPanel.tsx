import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "../../vendor/lucide-react";
import {
  ApiError,
  apiCargaAcreditacionBatchPreview,
  apiCargaAcreditacionBatchPromote,
  type AcreditacionBatchPreview,
  type EstudioPayload,
} from "../../api/client";
import {
  acreditacionBatchCanPromote,
  acreditacionBatchEntryDetail,
  acreditacionBatchFailureView,
  acreditacionBatchTotalLabel,
} from "./acreditacionBatchModel";

type Props = {
  sessionId: string | null;
  refreshToken?: number;
  onPromoted: (estudio: EstudioPayload) => void | Promise<void>;
};

function failureFor(reason: unknown) {
  const code = reason instanceof ApiError ? reason.code : "";
  const fallback = reason instanceof Error ? reason.message : "No se pudo preparar el corte de Monitoreo.";
  if (code === "E_ACREDITACION_BATCH_INTAKE") {
    return {
      guided: true,
      message: "Falta asignar un formulario publicado a uno o más públicos.",
    };
  }
  if (code === "E_ACREDITACION_BATCH_INCOMPATIBLE") {
    return {
      guided: false,
      message: "Una o más bases efectivas no contienen todas las variables requeridas por su formulario publicado.",
    };
  }
  if (code === "E_ACREDITACION_BATCH_CONFIRM_REPLACEMENT") {
    return {
      guided: false,
      message: "Confirma que deseas reemplazar juntas las bases existentes antes de continuar.",
    };
  }
  if (code === "E_ACREDITACION_BATCH_CACHE_STALE" || code === "E_ACREDITACION_BATCH_STALE") {
    return {
      guided: false,
      message: "Monitoreo o las asignaciones cambiaron. Actualiza la revisión antes de crear las bases.",
    };
  }
  return acreditacionBatchFailureView(code, fallback);
}

function blockerMessage(code: string, fallback: string): string {
  if (code === "base_target_conflict") {
    return "Ya existe una base con ese destino, pero pertenece a otro público o formulario. Revisa la asignación antes de reemplazarla.";
  }
  if (code === "instrument_data_incompatible") {
    return "Las encuestas efectivas no contienen todas las variables requeridas por el formulario publicado.";
  }
  return acreditacionBatchFailureView(code, fallback).message;
}

function entryStatusLabel(status: string, ready: boolean): string {
  if (status === "already_materialized") return "Ya creada";
  if (status === "replacement_required") return "Se reemplazará";
  return ready ? "Lista" : "Requiere revisión";
}

export function AcreditacionBatchPanel({ sessionId, refreshToken = 0, onPromoted }: Props) {
  const [preview, setPreview] = useState<AcreditacionBatchPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [error, setError] = useState("");
  const [guidedError, setGuidedError] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await apiCargaAcreditacionBatchPreview();
      setPreview(next);
      setConfirmReplacement(false);
      setGuidedError(false);
    } catch (reason) {
      const failure = failureFor(reason);
      setError(failure.message);
      setGuidedError(failure.guided);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    setGuidedError(false);
    void apiCargaAcreditacionBatchPreview()
      .then((next) => {
        if (cancelled) return;
        setPreview(next);
        setGuidedError(false);
      })
      .catch((reason) => {
        if (cancelled) return;
        const failure = failureFor(reason);
        setError(failure.message);
        setGuidedError(failure.guided);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId, refreshToken]);

  async function promote() {
    if (!preview || !acreditacionBatchCanPromote(preview)) return;
    if (preview.replacement_required && !confirmReplacement) {
      setError("Confirma el reemplazo completo antes de continuar.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiCargaAcreditacionBatchPromote(preview.pins, confirmReplacement);
      await onPromoted(result.estudio);
      setMessage(result.already_materialized
        ? "El mismo corte ya estaba materializado; no se duplicó ninguna base."
        : `${result.base_names.length} bases creadas juntas y listas para validar.`);
      await load();
    } catch (reason) {
      const failure = failureFor(reason);
      setError(failure.message);
      setGuidedError(failure.guided);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !preview) {
    return (
      <section className="pulso-acreditacion-batch is-loading" aria-label="Corte efectivo de Monitoreo">
        <Loader2 size={16} className="pulso-spin" aria-hidden="true" />
        <span>Verificando el corte efectivo de Monitoreo…</span>
      </section>
    );
  }
  if (!preview?.detected && !error) return null;

  const canPromote = acreditacionBatchCanPromote(preview);
  const replacementUnconfirmed = Boolean(preview?.replacement_required && !confirmReplacement);
  const createUnavailable = Boolean(!canPromote || busy || replacementUnconfirmed);
  const zeroEffective = preview?.entries.filter((entry) => entry.selected === 0) ?? [];
  const createReason = busy
    ? "Espera a que termine la creación del lote."
    : preview?.already_materialized
      ? "Este mismo corte ya fue creado; no se duplicará ninguna base."
      : preview?.blockers.length
        ? "Resuelve los avisos de compatibilidad antes de crear las bases."
        : preview?.entries.length === 0
          ? "Monitoreo todavía no ha preparado públicos con encuestas efectivas."
          : replacementUnconfirmed
            ? "Confirma el reemplazo conjunto para habilitar esta acción."
            : "Se crearán todas las bases juntas; ninguna se crea de manera parcial.";

  function focusAssignmentsHeading() {
    window.requestAnimationFrame(() => {
      document.getElementById("processing-intake-heading")?.focus();
    });
  }

  return (
    <section
      className="pulso-acreditacion-batch"
      aria-labelledby="acreditacion-batch-heading"
      data-audit-ready="true"
    >
      <header className="pulso-acreditacion-batch-head">
        <span className="pulso-acreditacion-batch-icon" aria-hidden="true"><Database size={18} /></span>
        <div>
          <span className="pulso-acreditacion-batch-kicker">Monitoreo → Procesamiento</span>
          <h2 id="acreditacion-batch-heading">Crear bases con las encuestas efectivas</h2>
          {preview ? <p>{acreditacionBatchTotalLabel(preview)}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => { if (!busy && !loading) void load(); }}
          aria-disabled={busy || loading}
          aria-describedby="acreditacion-batch-action-guidance"
          title="Volver a comprobar Monitoreo y las asignaciones"
        >
          <RefreshCw size={14} aria-hidden="true" /> Actualizar
        </button>
      </header>

      {(error || message) && !guidedError && (
        <div className={`pulso-acreditacion-batch-feedback${error ? " is-error" : " is-success"}`} role={error ? "alert" : "status"}>
          {error ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
          <span>{error || message}</span>
        </div>
      )}

      {guidedError && (
        <div className="pulso-acreditacion-batch-guide" role="alert">
          <ShieldCheck size={14} aria-hidden="true" />
          <div>
            <strong>Falta asignar un formulario publicado a uno o más públicos</strong>
            <span>Cada público detectado en Monitoreo debe quedar vinculado con una única revisión publicada.</span>
          </div>
          <a href="#processing-intake-plan" onClick={focusAssignmentsHeading}>Asignar formularios</a>
        </div>
      )}

      {preview?.already_materialized && (
        <div className="pulso-acreditacion-batch-state is-complete" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          <div><strong>Bases ya creadas</strong><span>Este mismo corte ya existe y no se volverá a duplicar.</span></div>
        </div>
      )}

      {preview?.replacement_required && !preview.already_materialized && (
        <div className="pulso-acreditacion-batch-state is-replacement" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <div><strong>Las bases ya existen</strong><span>Si continúas, se reemplazarán juntas con este corte actualizado.</span></div>
        </div>
      )}

      {zeroEffective.length > 0 && (
        <div className="pulso-acreditacion-batch-state is-warning" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{zeroEffective.length === 1 ? "Un público no tiene encuestas efectivas" : `${zeroEffective.length} públicos no tienen encuestas efectivas`}</strong>
            <span>Revisa el corte en Monitoreo; el sistema no incorporará respuestas fuera del informe de avance.</span>
          </div>
        </div>
      )}

      {preview?.blockers.length ? (
        <ul className="pulso-acreditacion-batch-blockers">
          {preview.blockers.map((blocker, index) => (
            <li key={`${blocker.code}-${index}`}>
              <AlertTriangle size={13} aria-hidden="true" />
              {blockerMessage(blocker.code, blocker.message)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="pulso-acreditacion-batch-grid" role="list" aria-label="Públicos del corte efectivo">
        {preview?.entries.map((entry) => {
          const ready = (entry.status === "ready" || entry.status === "replacement_required" || entry.status === "already_materialized")
            && entry.compatibility.ok;
          const detail = entry.selected === 0
            ? "Monitoreo no encontró encuestas efectivas para este público."
            : acreditacionBatchEntryDetail(entry);
          const headingId = `acreditacion-batch-${entry.entry_id}`;
          return (
            <article
              key={entry.entry_id}
              className={`pulso-acreditacion-batch-entry${ready ? " is-ready" : " is-blocked"}${entry.selected === 0 ? " is-zero" : ""}`}
              role="listitem"
              aria-labelledby={headingId}
            >
              <div className="pulso-acreditacion-batch-entry-title">
                <h3 id={headingId}>{entry.actor}</h3>
                <span className={`pulso-acreditacion-batch-entry-status${ready ? " is-ready" : " is-blocked"}`}>
                  {entryStatusLabel(entry.status, ready)}
                </span>
              </div>
              <strong className="pulso-acreditacion-batch-count">{entry.selected.toLocaleString("es-PE")} encuestas efectivas</strong>
              <p>{detail}</p>
              {entry.excluded > 0 ? <small>{entry.excluded.toLocaleString("es-PE")} respuestas quedan fuera del informe de avance.</small> : null}
              {entry.compatibility.missing_columns.length > 0 ? (
                <small>Faltan: {entry.compatibility.missing_columns.join(", ")}</small>
              ) : null}
              {entry.extras.length > 0 ? (
                <details>
                  <summary>Ver {entry.extras.length} variables extra excluidas</summary>
                  <ul>{entry.extras.map((item) => <li key={item.name}>{item.name} · {item.fill_pct}% con datos</li>)}</ul>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>

      <footer className="pulso-acreditacion-batch-actions">
        <span id="acreditacion-batch-action-guidance"><ShieldCheck size={14} aria-hidden="true" /> {createReason}</span>
        {preview?.replacement_required ? (
          <label>
            <input
              type="checkbox"
              checked={confirmReplacement}
              onChange={(event) => setConfirmReplacement(event.target.checked)}
              disabled={busy}
            />
            Reemplazar juntas las bases existentes
          </label>
        ) : null}
        <button
          type="button"
          className={!createUnavailable ? "is-primary" : undefined}
          aria-disabled={createUnavailable}
          aria-describedby="acreditacion-batch-action-guidance"
          onClick={() => { if (!createUnavailable) void promote(); }}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
          {preview?.already_materialized
            ? "Bases ya creadas"
            : preview?.replacement_required
              ? "Reemplazar todas las bases"
              : "Crear todas las bases"}
        </button>
      </footer>
    </section>
  );
}
