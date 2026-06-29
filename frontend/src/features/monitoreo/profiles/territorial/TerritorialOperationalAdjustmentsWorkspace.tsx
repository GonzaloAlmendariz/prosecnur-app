import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Target,
  XCircle,
} from "lucide-react";
import type {
  MonitoreoTerritorialOperationalAdjustment,
  MonitoreoTerritorialOperationalAdjustmentsPayload,
} from "../../../../api/client";
import { formatInternalQueryDateAxisLabel } from "../../internalQueries";

export function TerritorialOperationalAdjustmentsWorkspace({
  model,
  phaseLabel,
  saving,
  onApply,
  onRevert,
  onReset,
}: {
  model: MonitoreoTerritorialOperationalAdjustmentsPayload | null;
  phaseLabel: string;
  saving: boolean;
  onApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<MonitoreoTerritorialOperationalAdjustment>;
  onRevert?: (id: string, reason?: string) => Promise<string>;
  onReset?: () => Promise<number>;
}) {
  const suggestions = useMemo(
    () => [...(model?.suggestions ?? [])].sort(territorialOperationalAdjustmentCompare),
    [model?.suggestions],
  );
  const deficits = model?.deficits ?? [];
  const applied = model?.applied ?? [];
  const active = applied.filter((item) => stringOrEmpty(item.status || "active") === "active");
  const summary = model?.summary ?? {};
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const selected = suggestions.find((item) => item.id === selectedId) ?? suggestions[0] ?? null;

  useEffect(() => {
    if (!suggestions.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!selected || !suggestions.some((item) => item.id === selectedId)) {
      setSelectedId(suggestions[0].id);
    }
  }, [selected, selectedId, suggestions]);

  useEffect(() => {
    if (!selected) {
      setNote("");
      return;
    }
    setNote(territorialOperationalAdjustmentDefaultNote(selected));
  }, [selected?.id]);

  const canApply = Boolean(selected && onApply && note.trim().length >= 8 && !saving && !busyId);
  const summaryCards = [
    { label: "Faltantes compatibles", value: summary.pending_cells ?? deficits.length, tone: "pending" },
    { label: "Sobrantes disponibles", value: summary.eligible_surplus ?? 0, tone: "surplus" },
    {
      label: "Casos para cerrar UMP",
      value: summary.suggestions ?? suggestions.reduce((total, item) => total + (numberOrNull(item.count) ?? 0), 0),
      tone: "bridge",
    },
    { label: "Completas", value: summary.active ?? active.length, tone: "complete" },
  ];

  const applySelected = async () => {
    if (!selected || !onApply || !canApply) return;
    setBusyId(selected.id);
    setMessage("");
    setLocalError("");
    try {
      await onApply({
        ...selected,
        note: note.trim(),
        reason: selected.reason || "Excedente compatible usado como subsanación operativa",
      });
      setMessage("Subsanación guardada. El avance se recalculó con esta lectura operativa.");
    } catch (error) {
      setLocalError((error as Error).message || String(error));
    } finally {
      setBusyId("");
    }
  };

  const revertItem = async (item: MonitoreoTerritorialOperationalAdjustment) => {
    const id = stringOrEmpty(item.id).trim();
    if (!id || !onRevert || saving || busyId) return;
    const confirmed = window.confirm("¿Revertir esta subsanación operativa? El registro quedará en el historial del proyecto.");
    if (!confirmed) return;
    setBusyId(id);
    setMessage("");
    setLocalError("");
    try {
      await onRevert(id, "Revertida desde Consultas");
      setMessage("Subsanación revertida. Las respuestas originales nunca se modificaron.");
    } catch (error) {
      setLocalError((error as Error).message || String(error));
    } finally {
      setBusyId("");
    }
  };

  const resetAll = async () => {
    if (!onReset || saving || busyId) return;
    const confirmed = window.confirm("¿Reiniciar las subsanaciones operativas de esta fase? Se limpiará la capa local y se recalcularán paquetes completos desde cero. Kobo no se modifica.");
    if (!confirmed) return;
    setBusyId("__reset__");
    setMessage("");
    setLocalError("");
    try {
      const activeBefore = await onReset();
      setMessage(`${formatMetric(activeBefore)} subsanaciones reiniciadas. Revisa los paquetes sugeridos antes de aplicar nuevamente.`);
    } catch (error) {
      setLocalError((error as Error).message || String(error));
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mon-operational-adjustments" aria-label="Subsanaciones operativas de avance">
      <header className="mon-operational-adjustments__header">
        <div>
          <span><ArrowRight size={14} /> Subsanaciones operativas · {phaseLabel}</span>
          <strong>Paquetes que cierran UMP pendientes</strong>
          <p>Primero se priorizan las pendientes más antiguas. Solo se sugieren conjuntos que pueden dejar una UMP completa, respetando distrito, sexo, rango etario y cercanía.</p>
        </div>
        <div className="mon-operational-adjustments__status">
          <span className="is-surplus">Sobrante</span>
          <span className="is-pending">Faltante</span>
          <span className="is-complete"><CheckCircle2 size={13} /> {formatMetric(active.length)} completas</span>
          {onReset ? (
            <button type="button" className="mon-operational-reset-button" onClick={resetAll} disabled={saving || Boolean(busyId)}>
              {busyId === "__reset__" ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
              <span>Reiniciar</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="mon-operational-adjustments__metrics">
        {summaryCards.map((item) => (
          <span key={item.label} className={`is-${item.tone}`}>
            <strong>{formatMetric(numberOrNull(item.value) ?? 0)}</strong>
            <em>{item.label}</em>
          </span>
        ))}
      </div>

      {message ? <div className="mon-operational-adjustments__notice is-ready"><CheckCircle2 size={14} /> {message}</div> : null}
      {localError ? <div className="mon-operational-adjustments__notice is-error"><AlertTriangle size={14} /> {localError}</div> : null}

      {!model || model.reason ? (
        <div className="mon-operational-adjustments__empty">
          <Target size={18} />
          <strong>Sin matriz operativa lista</strong>
          <span>Prepara Consultas o Avance para ver brechas y excedentes compatibles.</span>
          {model?.reason ? <em>{model.reason}</em> : null}
        </div>
      ) : (
        <div className="mon-operational-adjustments__grid">
          <section className="mon-operational-adjustments__suggestions" aria-label="Sugerencias de subsanación">
            <header>
              <div>
                <span>Sugerencias</span>
                <strong>{formatMetric(suggestions.length)} paquete(s) para cerrar UMP</strong>
              </div>
            </header>
            {suggestions.length ? (
              <div className="mon-operational-adjustments__list">
                {suggestions.map((item) => {
                  const isSelected = selected?.id === item.id;
                  const distanceLabel = territorialOperationalAdjustmentDistanceLabel(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`mon-operational-suggestion${isSelected ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="mon-operational-node is-surplus">
                        <small>Sobrante</small>
                        <strong>{territorialOperationalAdjustmentBlockLabel(item, "source")}</strong>
                        <em>{formatMetric(numberOrNull(item.count) ?? 0)} caso(s) del paquete</em>
                        <span className="mon-operational-node-meta">
                          <b>{territorialOperationalAdjustmentSideResponsibleLabel(item, "source")}</b>
                        </span>
                      </span>
                      <span className="mon-operational-transfer">
                        <ArrowRight size={14} />
                        <em>pasa a</em>
                        {distanceLabel ? <strong>{distanceLabel}</strong> : null}
                      </span>
                      <span className="mon-operational-node is-pending">
                        <small>Faltante</small>
                        <strong>{territorialOperationalAdjustmentBlockLabel(item, "target")}</strong>
                        <em>{territorialOperationalAdjustmentCellLabel(item)}</em>
                        <span className="mon-operational-node-meta">
                          <b>{territorialOperationalAdjustmentSideResponsibleLabel(item, "target")}</b>
                          <i className="is-priority">Últ. aplicación UMP: {territorialOperationalAdjustmentDateLabel(territorialOperationalAdjustmentTargetActivity(item), "Sin actividad")}</i>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mon-operational-adjustments__empty is-compact">
                <CheckCircle2 size={16} />
                <strong>Sin sugerencias pendientes</strong>
                <span>No hay excedentes compatibles para las brechas abiertas.</span>
              </div>
            )}
          </section>

          <aside className="mon-operational-adjustments__detail" aria-label="Detalle de la subsanación seleccionada">
            {selected ? (
              <>
                <header>
                  <span><Target size={14} /> Revisión operativa</span>
                  <strong>{formatMetric(numberOrNull(selected.count) ?? 0)} caso(s) para cerrar la UMP</strong>
                </header>
                <dl>
                  <div className="is-surplus">
                    <dt>Sobrante</dt>
                    <dd>{territorialOperationalAdjustmentBlockLabel(selected, "source")}</dd>
                  </div>
                  <div className="is-pending">
                    <dt>Faltante</dt>
                    <dd>{territorialOperationalAdjustmentBlockLabel(selected, "target")}</dd>
                  </div>
                  <div className="is-pending">
                    <dt>Celda faltante</dt>
                    <dd>{territorialOperationalAdjustmentCellLabel(selected)}</dd>
                  </div>
                  <div>
                    <dt>Movimientos del paquete</dt>
                    <dd>{formatMetric(numberOrNull(selected.package_movements) ?? selected.adjustments?.length ?? 1)}</dd>
                  </div>
                  <div>
                    <dt>Casos disponibles</dt>
                    <dd>{formatMetric(selected.source_response_ids?.length ?? selected.count ?? 0)}</dd>
                  </div>
                  {territorialOperationalAdjustmentDistanceLabel(selected) ? (
                    <div className="is-distance">
                      <dt>Cercanía</dt>
                      <dd><MapPin size={13} /> {territorialOperationalAdjustmentDistanceLabel(selected)}</dd>
                    </div>
                  ) : null}
                  <div className="is-surplus">
                    <dt>Responsable sobrante</dt>
                    <dd>{territorialOperationalAdjustmentSideResponsibleLabel(selected, "source")}</dd>
                  </div>
                  <div className="is-pending">
                    <dt>Responsable faltante</dt>
                    <dd>{territorialOperationalAdjustmentSideResponsibleLabel(selected, "target")}</dd>
                  </div>
                  <div className="is-pending is-priority">
                    <dt>Última aplicación de la UMP</dt>
                    <dd>{territorialOperationalAdjustmentDateLabel(territorialOperationalAdjustmentTargetActivity(selected), "Sin actividad")}</dd>
                  </div>
                </dl>
                <label className="mon-operational-adjustments__note">
                  <span>Nota de decisión</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.currentTarget.value)}
                    rows={3}
                    disabled={saving || Boolean(busyId)}
                  />
                </label>
                <footer>
                  <button type="button" className="mon-operational-apply-button" onClick={applySelected} disabled={!canApply}>
                    {busyId === selected.id ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
                    <span>Completar UMP con este paquete</span>
                  </button>
                  <small>Solo se aplica si el conjunto cierra la UMP. No mueve registros entre proyectos ni toca Kobo.</small>
                </footer>
              </>
            ) : (
              <div className="mon-operational-adjustments__empty is-compact">
                <Target size={16} />
                <strong>Selecciona una sugerencia</strong>
                <span>Cuando haya excedentes compatibles aparecerán aquí.</span>
              </div>
            )}
          </aside>

          {applied.length ? (
            <section className="mon-operational-adjustments__applied" aria-label="Subsanaciones aplicadas">
              <header>
                <div>
                  <span>Historial operativo</span>
                  <strong>{formatMetric(applied.length)} movimientos</strong>
                </div>
              </header>
              <div className="mon-operational-adjustments__applied-list">
                {applied.map((item) => {
                  const id = stringOrEmpty(item.id).trim();
                  const isActive = stringOrEmpty(item.status || "active") === "active";
                  return (
                    <article key={id || `${item.source_block_id}-${item.target_block_id}`} className={`mon-operational-applied is-${isActive ? "active" : "reverted"}`}>
                      <div>
                        <strong>{territorialOperationalAdjustmentBlockLabel(item, "target")}</strong>
                        <span>{territorialOperationalAdjustmentCellLabel(item)} · {formatMetric(numberOrNull(item.count) ?? 0)} caso(s)</span>
                        <em>Sobrante usado: {territorialOperationalAdjustmentBlockLabel(item, "source")}</em>
                      </div>
                      {isActive ? (
                        <button type="button" onClick={() => revertItem(item)} disabled={!onRevert || saving || Boolean(busyId)}>
                          {busyId === id ? <Loader2 size={12} className="pulso-spin" /> : <XCircle size={12} />}
                          <span>Revertir</span>
                        </button>
                      ) : (
                        <span className="mon-operational-applied__tag">Revertida</span>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}

function territorialOperationalAdjustmentBlockLabel(item: MonitoreoTerritorialOperationalAdjustment, side: "source" | "target") {
  const ump = stringOrEmpty(side === "source" ? item.source_ump : item.target_ump).trim();
  const manzana = stringOrEmpty(side === "source" ? item.source_manzana : item.target_manzana).trim();
  const block = stringOrEmpty(side === "source" ? item.source_block_id : item.target_block_id).trim();
  const base = ump || (block ? shortenMiddle(block, 18) : "UMP sin código");
  return manzana ? `${base} · Mz ${manzana}` : base;
}

function territorialOperationalAdjustmentCellLabel(item: MonitoreoTerritorialOperationalAdjustment) {
  return [
    stringOrEmpty(item.district).trim() || "Sin distrito",
    stringOrEmpty(item.sex).trim() || "S/D",
    stringOrEmpty(item.age_group).trim() || "sin edad",
  ].join(" · ");
}

function territorialOperationalAdjustmentSideResponsibleLabel(item: MonitoreoTerritorialOperationalAdjustment, side: "source" | "target") {
  const raw = stringOrEmpty(side === "source" ? item.source_responsible : item.target_responsible).trim();
  if (raw && raw !== "-") return raw;
  return side === "source" ? "Sobrante sin responsable" : "Faltante sin responsable";
}

function territorialOperationalAdjustmentTargetActivity(item: MonitoreoTerritorialOperationalAdjustment) {
  return stringOrEmpty(item.target_latest_activity).trim();
}

function territorialOperationalAdjustmentDistanceLabel(item: MonitoreoTerritorialOperationalAdjustment) {
  const distance = numberOrNull(item.distance_km);
  if (distance === null || !Number.isFinite(distance) || distance < 0) return "";
  if (distance < 1) return `${Math.max(1, Math.round(distance * 1000))} m`;
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
}

function territorialOperationalAdjustmentActivitySortValue(value: unknown) {
  const raw = stringOrEmpty(value).trim();
  if (!raw) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const date = raw.slice(0, 10);
  const dateParsed = Date.parse(date);
  return Number.isFinite(dateParsed) ? dateParsed : Number.POSITIVE_INFINITY;
}

function territorialOperationalAdjustmentCompare(
  a: MonitoreoTerritorialOperationalAdjustment,
  b: MonitoreoTerritorialOperationalAdjustment,
) {
  const activityDelta =
    territorialOperationalAdjustmentActivitySortValue(territorialOperationalAdjustmentTargetActivity(a)) -
    territorialOperationalAdjustmentActivitySortValue(territorialOperationalAdjustmentTargetActivity(b));
  if (activityDelta !== 0) return activityDelta;
  const distanceDelta = (numberOrNull(a.distance_km) ?? Number.POSITIVE_INFINITY) -
    (numberOrNull(b.distance_km) ?? Number.POSITIVE_INFINITY);
  if (Number.isFinite(distanceDelta) && distanceDelta !== 0) return distanceDelta;
  return territorialOperationalAdjustmentBlockLabel(a, "target").localeCompare(
    territorialOperationalAdjustmentBlockLabel(b, "target"),
    "es",
  );
}

function territorialOperationalAdjustmentDateLabel(value: unknown, emptyLabel = "S/D") {
  const raw = stringOrEmpty(value).trim();
  if (!raw) return emptyLabel;
  const date = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatInternalQueryDateAxisLabel(date) : raw;
}

function territorialOperationalAdjustmentDefaultNote(item: MonitoreoTerritorialOperationalAdjustment) {
  return `Sobrante de ${territorialOperationalAdjustmentBlockLabel(item, "source")} pasa a cubrir el faltante de ${territorialOperationalAdjustmentBlockLabel(item, "target")} en ${territorialOperationalAdjustmentCellLabel(item)}.`;
}

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrEmpty(value: unknown) {
  return value == null ? "" : String(value);
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const side = Math.max(3, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}
