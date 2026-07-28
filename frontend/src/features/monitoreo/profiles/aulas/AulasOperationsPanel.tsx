// Operación del plan de cursos-horario — unidad 4.1 (piloto modular).
// Estas acciones profundas vivían en el monolito MonitoreoPage.tsx
// (AulasSourceActions + commandbar de AulasUniversitariasView); se MUEVEN
// aquí sin reescribir la lógica: importar el plan desde el cálculo de
// muestra y recalcular el corte de campo (/api/monitoreo/aulas/sync).
// La agenda y las fichas QR siguen viviendo en Recopiladores: ese flujo
// pertenece al módulo de fichas y este monitoreo solo lo lee.
import { Download, FileCheck2, Link2, Loader2, RefreshCw, Target } from "lucide-react";
import type { MonitoreoAulasConfig, MonitoreoSource } from "../../../../api/client";

// Movido del monolito (aulasShortId): compacta hashes/run-ids largos.
function aulasOpsShortId(value: unknown, limit = 18) {
  const text = String(value ?? "").trim();
  if (!text) return "pendiente";
  if (text.length <= limit) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

export function aulasPlanImported(config: MonitoreoAulasConfig | null | undefined) {
  return Boolean(config?.enabled && config?.selection_run_id);
}

export type AulasOperationsPanelProps = {
  config: MonitoreoAulasConfig | null;
  sources: MonitoreoSource[];
  busy: boolean;
  onImportPlan: () => void;
  onSyncField: () => void;
};

export function AulasOperationsPanel({ config, sources, busy, onImportPlan, onSyncField }: AulasOperationsPanelProps) {
  const imported = aulasPlanImported(config);
  const methodologyReady = Boolean(config?.frame_hash || Object.keys(config?.methodology ?? {}).length);
  const activeSources = sources.filter((source) => source.enabled);
  const sourceKinds = Array.from(new Set(activeSources.map((source) => source.kind).filter(Boolean))).join(" · ") || "sin fuentes";
  const cards = [
    {
      key: "seleccion",
      icon: Target,
      label: "Selección",
      value: imported ? "Conectada" : "Pendiente",
      hint: config?.selection_run_id ? aulasOpsShortId(config.selection_run_id) : "selection_run_id",
      ready: imported,
    },
    {
      key: "marco",
      icon: Link2,
      label: "Marco institucional",
      value: config?.frame_hash ? "Hash listo" : "Sin hash",
      hint: config?.frame_hash ? aulasOpsShortId(config.frame_hash) : "requiere marco",
      ready: Boolean(config?.frame_hash),
    },
    {
      key: "metodologia",
      icon: FileCheck2,
      label: "Metodología",
      value: methodologyReady ? "Trazable" : "Pendiente",
      hint: "semilla, cuotas y bitácora",
      ready: methodologyReady,
    },
  ];
  return (
    <section className="mon-profile-panel aulas-ops-panel" aria-label="Operación del plan de cursos-horario">
      <div className="mon-profile-panel-head">
        <h3>Operación del plan</h3>
        <span>{imported ? "plan conectado" : "plan pendiente"}</span>
      </div>
      <div
        className="aulas-ops-grid"
        data-qa-geometry-group="monitoring-aulas-operations"
        data-qa-geometry-contract="equal"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className={card.ready ? "is-ready" : "is-waiting"}>
              <i aria-hidden="true"><Icon size={14} /></i>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.hint}</small>
            </article>
          );
        })}
      </div>
      <div className="aulas-ops-actions">
        <button
          type="button"
          onClick={onImportPlan}
          disabled={busy}
          title="Importar titulares y reservas desde el cálculo de muestra de cursos-horario"
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <Download size={14} />}
          <span>Importar plan</span>
        </button>
        <button
          type="button"
          className="is-primary"
          onClick={onSyncField}
          disabled={busy || !imported}
          title={imported
            ? `Recalcular el corte de campo (${activeSources.length} fuentes activas: ${sourceKinds})`
            : "Primero importa el plan de cursos-horario"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          <span>Sincronizar campo</span>
        </button>
        <em>{activeSources.length ? `${activeSources.length} fuentes activas · ${sourceKinds}` : "Sin fuentes activas conectadas"}</em>
      </div>
    </section>
  );
}
