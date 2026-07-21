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
  apiCargaAcreditacionBatchPreview,
  apiCargaAcreditacionBatchPromote,
  type AcreditacionBatchPreview,
  type EstudioPayload,
} from "../../api/client";
import {
  acreditacionBatchCanPromote,
  acreditacionBatchEntryDetail,
  acreditacionBatchTotalLabel,
} from "./acreditacionBatchModel";

type Props = {
  sessionId: string | null;
  onPromoted: (estudio: EstudioPayload) => void | Promise<void>;
};

export function AcreditacionBatchPanel({ sessionId, onPromoted }: Props) {
  const [preview, setPreview] = useState<AcreditacionBatchPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await apiCargaAcreditacionBatchPreview();
      setPreview(next);
      setConfirmReplacement(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo preparar el corte de Monitoreo.");
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
    void apiCargaAcreditacionBatchPreview()
      .then((next) => { if (!cancelled) setPreview(next); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo preparar el corte de Monitoreo.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

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
      setError(reason instanceof Error ? reason.message : "No se pudo crear el lote de bases.");
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
  return (
    <section
      className="pulso-acreditacion-batch"
      aria-label="Corte efectivo de Monitoreo"
      data-audit-ready="true"
    >
      <header className="pulso-acreditacion-batch-head">
        <span className="pulso-acreditacion-batch-icon" aria-hidden="true"><Database size={18} /></span>
        <div>
          <span className="pulso-acreditacion-batch-kicker">Monitoreo → Procesamiento</span>
          <strong>Encuestas efectivas por actor</strong>
          {preview ? <p>{acreditacionBatchTotalLabel(preview)}</p> : null}
        </div>
        <button type="button" onClick={() => void load()} disabled={busy || loading} title="Recalcular preview">
          <RefreshCw size={14} aria-hidden="true" /> Actualizar
        </button>
      </header>

      {(error || message) && (
        <div className={`pulso-acreditacion-batch-feedback${error ? " is-error" : " is-success"}`} role="status">
          {error ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
          <span>{error || message}</span>
        </div>
      )}

      {preview?.blockers.length ? (
        <ul className="pulso-acreditacion-batch-blockers">
          {preview.blockers.map((blocker, index) => (
            <li key={`${blocker.code}-${index}`}><AlertTriangle size={13} aria-hidden="true" /> {blocker.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="pulso-acreditacion-batch-grid">
        {preview?.entries.map((entry) => {
          const ready = (entry.status === "ready" || entry.status === "replacement_required")
            && entry.compatibility.ok;
          return (
            <article key={entry.entry_id} className={`pulso-acreditacion-batch-entry${ready ? " is-ready" : " is-blocked"}`}>
              <div className="pulso-acreditacion-batch-entry-title">
                <strong>{entry.actor}</strong>
                <span>{entry.selected.toLocaleString("es-PE")} efectivas</span>
              </div>
              <p>{acreditacionBatchEntryDetail(entry)}</p>
              {entry.excluded > 0 ? <small>{entry.excluded.toLocaleString("es-PE")} filas no ingresan al informe.</small> : null}
              {entry.compatibility.missing_columns.length > 0 ? (
                <small>Faltan: {entry.compatibility.missing_columns.join(", ")}</small>
              ) : null}
              {entry.extras.length > 0 ? (
                <details>
                  <summary>Ver {entry.extras.length} extras excluidas</summary>
                  <ul>{entry.extras.map((item) => <li key={item.name}>{item.name} · {item.fill_pct}% con datos</li>)}</ul>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>

      <footer className="pulso-acreditacion-batch-actions">
        <span><ShieldCheck size={14} aria-hidden="true" /> El lote se crea completo o no se crea.</span>
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
          className="is-primary"
          disabled={!canPromote || busy || Boolean(preview?.replacement_required && !confirmReplacement)}
          onClick={() => void promote()}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
          Crear todas las bases
        </button>
      </footer>
    </section>
  );
}
