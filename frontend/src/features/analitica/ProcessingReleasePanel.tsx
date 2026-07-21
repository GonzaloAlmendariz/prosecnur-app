import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from "../../vendor/lucide-react";
import {
  apiProcessingReleaseApprove,
  apiProcessingReleases,
  type ProcessingReleaseCatalog,
} from "../../api/client";
import { processingReleaseActive, processingReleaseCounts, processingReleaseStatusView } from "./processingReleaseModel";

export function ProcessingReleasePanel({ activeBase }: { activeBase?: string | null }) {
  const [catalog, setCatalog] = useState<ProcessingReleaseCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setCatalog(await apiProcessingReleases());
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  useEffect(() => { void load(); }, [activeBase]);

  const active = useMemo(() => processingReleaseActive(catalog, activeBase), [catalog, activeBase]);
  const counts = processingReleaseCounts(catalog);
  if (!catalog?.detected && !error) return null;
  const view = processingReleaseStatusView(active?.status ?? "pending");

  async function approve() {
    if (!active || !active.ready || busy) return;
    setBusy(true);
    setError("");
    try {
      setCatalog(await apiProcessingReleaseApprove({
        base: active.base,
        expected_input_fingerprint: active.input_fingerprint,
      }));
    } catch (reason) {
      setError((reason as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pulso-processing-release" aria-label="Aprobación metodológica por base">
      <div className="pulso-processing-release-main">
        <span className={`pulso-processing-release-icon is-${view.tone}`} aria-hidden="true">
          {active?.approved ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
        </span>
        <div>
          <span>Aprobación para informe</span>
          <strong>{active?.actor || active?.base_label || "Base activa"} · {view.label}</strong>
          <small>{counts.approved} de {counts.total} bases aprobadas{counts.stale ? ` · ${counts.stale} desactualizada(s)` : ""}</small>
        </div>
      </div>

      {active?.blockers?.length ? (
        <details className="pulso-processing-release-blockers">
          <summary><CircleAlert size={14} /> {active.blockers.length} requisito(s) pendiente(s)</summary>
          <ul>{active.blockers.map((item) => <li key={item.code}>{item.message}</li>)}</ul>
        </details>
      ) : null}

      {error ? <p className="pulso-processing-release-error">{error}</p> : null}

      <button
        type="button"
        className="pulso-primary"
        disabled={!active?.ready || active.approved || busy}
        onClick={() => { void approve(); }}
      >
        {busy ? <RefreshCw size={14} className="is-spinning" /> : <ShieldCheck size={14} />}
        {active?.approved ? "Aprobada" : active?.status === "stale" ? "Volver a aprobar" : "Aprobar para informe"}
      </button>
    </section>
  );
}
