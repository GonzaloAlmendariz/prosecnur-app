import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Loader2,
  PhoneCall,
  ShieldCheck,
} from "../../vendor/lucide-react";
import {
  apiCargaMonitoreoHandoffStatus,
  apiEstudioProcessingSuggestions,
  type CargaMonitoreoHandoffStatus,
  type EstudioProcessingSuggestions,
} from "../../api/client";
import {
  processingProfileFromMonitoring,
  type ProcessingSourcesProfile,
} from "./CargaSourcesModel";

export type CargaMonitoringDiscoveryResult = {
  suggestions: EstudioProcessingSuggestions | null;
  handoff: CargaMonitoreoHandoffStatus | null;
  profile: ProcessingSourcesProfile | null;
  selectedSourceId: string | null;
};

export function CargaMonitoringDiscovery({
  reviewLabel,
  onDiscovered,
}: {
  reviewLabel: string;
  onDiscovered: (result: CargaMonitoringDiscoveryResult) => void;
}) {
  const [result, setResult] = useState<CargaMonitoringDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reviewMonitoring() {
    const revoked: CargaMonitoringDiscoveryResult = {
      suggestions: null,
      handoff: null,
      profile: null,
      selectedSourceId: null,
    };
    setResult(null);
    onDiscovered(revoked);
    setLoading(true);
    setError("");
    const [handoffResult, suggestionsResult] = await Promise.allSettled([
      apiCargaMonitoreoHandoffStatus(),
      apiEstudioProcessingSuggestions(),
    ]);

    if (handoffResult.status !== "fulfilled" || suggestionsResult.status !== "fulfilled") {
      const reason = handoffResult.status === "rejected"
        ? handoffResult.reason
        : suggestionsResult.status === "rejected"
          ? suggestionsResult.reason
          : null;
      setResult(null);
      onDiscovered(revoked);
      setError(reason instanceof Error ? reason.message : "No se pudo revisar Monitoreo.");
      setLoading(false);
      return;
    }

    const handoff = handoffResult.value;
    const suggestions = suggestionsResult.value;
    const next = {
      suggestions,
      handoff,
      profile: processingProfileFromMonitoring(suggestions),
      selectedSourceId: handoff.sources?.[0]?.source_id ?? handoff.source?.source_id ?? null,
    };
    setResult(next);
    onDiscovered(next);
    setLoading(false);
  }

  const sources = result?.handoff?.sources ?? [];
  const groups = result?.suggestions?.groups ?? [];
  const counts = result?.handoff?.counts;

  return (
    <section className="pulso-carga-monitoring-discovery" aria-label="Descubrimiento de Monitoreo">
      {!result ? (
        <div className="pulso-carga-monitoring-consent">
          <span className="pulso-carga-monitoring-consent-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
          <div>
            <strong>Monitoreo permanece local y sin explorar</strong>
            <p>Revisa el snapshot del proyecto solo cuando quieras preparar sus fuentes para Procesamiento. No se contactan servicios externos.</p>
          </div>
          <button type="button" className="pulso-primary" disabled={loading} onClick={() => void reviewMonitoring()}>
            {loading ? <Loader2 size={14} className="pulso-spin" /> : <ClipboardCheck size={14} />}
            {loading ? "Revisando…" : reviewLabel}
          </button>
        </div>
      ) : (
        <div className="pulso-carga-monitoring-summary" data-audit-ready="monitoring-reviewed">
          <div className="pulso-carga-monitoring-summary-head">
            <span aria-hidden="true"><CheckCircle2 size={16} /></span>
            <div>
              <strong>Monitoreo revisado</strong>
              <small>
                {result.profile === "multi_actor"
                  ? `${groups.length} ${groups.length === 1 ? "actor" : "actores"} con fuentes declaradas.`
                  : result.profile === "telefonico"
                    ? "Corte telefónico PDM: las llamadas y todas sus fuentes quedan visibles antes de traer datos."
                    : result.profile === "territorial"
                      ? "Corte territorial ACG: entran las validadas y las que requieren revisión; las no defendibles quedan fuera."
                      : "Fuentes locales disponibles para revisión."}
              </small>
            </div>
            <button type="button" disabled={loading} onClick={() => void reviewMonitoring()}>
              {loading ? <Loader2 size={13} className="pulso-spin" /> : <ClipboardCheck size={13} />}
              Actualizar revisión
            </button>
          </div>

          {result.profile === "multi_actor" ? (
            <ul className="pulso-carga-monitoring-actors" aria-label="Actores detectados">
              {groups.map((group) => (
                <li key={group.id}>
                  <Database size={14} aria-hidden="true" />
                  <span><strong>{group.actor || group.label}</strong><small>{group.sources[0]?.channel || group.platform} · {group.source_count} fuente{group.source_count === 1 ? "" : "s"} · {group.response_count ?? "—"} respuestas</small></span>
                </li>
              ))}
            </ul>
          ) : null}

          {result.profile === "telefonico" ? (
            <div className="pulso-carga-monitoring-source-list" aria-label="Fuentes del corte telefónico">
              <span><PhoneCall size={14} aria-hidden="true" /> Llamadas incluidas en el corte</span>
              <div className="pulso-carga-monitoring-sources" role="radiogroup" aria-label="Fuente de monitoreo para procesamiento">
                {sources.map((source) => (
                  <label
                    key={source.source_id}
                    className={`pulso-carga-monitoring-source ${result.selectedSourceId === source.source_id ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="monitoring-source"
                      checked={result.selectedSourceId === source.source_id}
                      onChange={() => {
                        const next = { ...result, selectedSourceId: source.source_id };
                        setResult(next);
                        onDiscovered(next);
                      }}
                    />
                    <span><strong>{source.label}</strong><small>{source.kind} · {source.counts.processable}/{source.counts.total} procesables</small></span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {result.profile === "territorial" && counts ? (
            <dl className="pulso-carga-monitoring-counts" aria-label="Conteos territoriales">
              <div><dt>Validadas</dt><dd>{counts.validada.toLocaleString("es-PE")}</dd></div>
              <div><dt>En revisión</dt><dd>{counts.revision.toLocaleString("es-PE")}</dd></div>
              <div className="is-excluded"><dt>No defendibles excluidas</dt><dd>{counts.no_defendible.toLocaleString("es-PE")}</dd></div>
            </dl>
          ) : null}
        </div>
      )}
      {error ? <div className="pulso-carga-monitoring-error" role="alert"><AlertTriangle size={14} /> {error}</div> : null}
    </section>
  );
}
