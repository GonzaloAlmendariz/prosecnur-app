import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Target,
  XCircle,
} from "lucide-react";
import type {
  MonitoreoTerritorialOperationalAdjustment,
  MonitoreoTerritorialOperationalAdjustmentsPayload,
} from "../../../../api/client";
import { formatInternalQueryDateAxisLabel } from "../../internalQueries";

type AppliedStatusFilter = "all" | "active" | "reverted";

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
  const active = applied.filter((item) => territorialOperationalAppliedStatus(item) === "active");
  const reverted = applied.filter((item) => territorialOperationalAppliedStatus(item) === "reverted");
  const appliedRows = useMemo(() => [...applied].sort(territorialOperationalAppliedCompare), [applied]);
  const summary = model?.summary ?? {};
  const [selectedId, setSelectedId] = useState("");
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<AppliedStatusFilter>("all");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const suggestionSearchNeedle = normalizeOperationalSearch(suggestionSearch);
  const appliedSearchNeedle = normalizeOperationalSearch(appliedSearch);
  const visibleSuggestions = useMemo(() => {
    if (!suggestionSearchNeedle) return suggestions;
    return suggestions.filter((item) => territorialOperationalAdjustmentSearchText(item).includes(suggestionSearchNeedle));
  }, [suggestionSearchNeedle, suggestions]);
  const statusFilteredAppliedRows = useMemo(() => {
    if (appliedStatusFilter === "active") {
      return appliedRows.filter((item) => territorialOperationalAppliedStatus(item) === "active");
    }
    if (appliedStatusFilter === "reverted") {
      return appliedRows.filter((item) => territorialOperationalAppliedStatus(item) === "reverted");
    }
    return appliedRows;
  }, [appliedRows, appliedStatusFilter]);
  const visibleAppliedRows = useMemo(() => {
    if (!appliedSearchNeedle) return statusFilteredAppliedRows;
    return statusFilteredAppliedRows.filter((item) => territorialOperationalAdjustmentSearchText(item).includes(appliedSearchNeedle));
  }, [appliedSearchNeedle, statusFilteredAppliedRows]);
  const appliedFilterLabel = appliedStatusFilter === "active"
    ? "activas"
    : appliedStatusFilter === "reverted"
      ? "revertidas"
      : "movimientos";
  const appliedStatusOptions: Array<{
    key: AppliedStatusFilter;
    label: string;
    count: number;
    ariaLabel: string;
  }> = [
    {
      key: "all",
      label: "Todas",
      count: applied.length,
      ariaLabel: `Ver todas las subsanaciones auditadas (${formatMetric(applied.length)})`,
    },
    {
      key: "active",
      label: "Activas",
      count: active.length,
      ariaLabel: `Ver subsanaciones activas (${formatMetric(active.length)})`,
    },
    {
      key: "reverted",
      label: "Revertidas",
      count: reverted.length,
      ariaLabel: `Ver subsanaciones revertidas (${formatMetric(reverted.length)})`,
    },
  ];
  const appliedHeaderLabel = appliedSearchNeedle
    ? `${formatMetric(visibleAppliedRows.length)} de ${formatMetric(statusFilteredAppliedRows.length)} ${appliedFilterLabel}`
    : `${formatMetric(statusFilteredAppliedRows.length)} ${appliedFilterLabel}`;
  const selected = visibleSuggestions.find((item) => item.id === selectedId) ?? visibleSuggestions[0] ?? null;

  useEffect(() => {
    if (!visibleSuggestions.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!selected || !visibleSuggestions.some((item) => item.id === selectedId)) {
      setSelectedId(visibleSuggestions[0].id);
    }
  }, [selected, selectedId, visibleSuggestions]);

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
  const selectedMovements = selected ? territorialOperationalAdjustmentMovements(selected) : [];
  const selectedResponseCount = territorialOperationalAdjustmentResponseCount(selectedMovements);
  const selectedMovementCount = selected
    ? numberOrNull(selected.package_movements) ?? selected.adjustments?.length ?? 1
    : 0;
  const selectedDistanceLabel = selected ? territorialOperationalAdjustmentDistanceLabel(selected) : "";
  const selectedTargetActivityLabel = selected
    ? territorialOperationalAdjustmentDateLabel(territorialOperationalAdjustmentTargetActivity(selected), "Sin actividad")
    : "Sin actividad";

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
          <span><ArrowRight size={14} /> Subsanador operativo · {phaseLabel}</span>
          <strong>Excedentes reales, paquetes completos</strong>
          <p>Solo aparecen movimientos que cierran una UMP pendiente con respuestas sobrantes trazables y que conservan completa la UMP origen.</p>
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
                <strong>{formatMetric(visibleSuggestions.length)} de {formatMetric(suggestions.length)} paquete(s)</strong>
              </div>
              <label className="mon-operational-adjustments__search">
                <Search size={13} />
                <input
                  value={suggestionSearch}
                  onChange={(event) => setSuggestionSearch(event.currentTarget.value)}
                  placeholder="Filtrar UMP, responsable, celda o ID..."
                />
                {suggestionSearch ? (
                  <button type="button" onClick={() => setSuggestionSearch("")} aria-label="Limpiar filtro de sugerencias">
                    <XCircle size={12} />
                  </button>
                ) : null}
              </label>
            </header>
            {visibleSuggestions.length ? (
              <div className="mon-operational-adjustments__list">
                {visibleSuggestions.map((item) => {
                  const isSelected = selected?.id === item.id;
                  const distanceLabel = territorialOperationalAdjustmentDistanceLabel(item);
                  const movementCount = numberOrNull(item.package_movements) ?? item.adjustments?.length ?? 1;
                  const responseCount = territorialOperationalAdjustmentResponseCount(territorialOperationalAdjustmentMovements(item));
                  const cellLabel = territorialOperationalAdjustmentCellLabel(item);
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
                      <span className="mon-operational-suggestion__chips">
                        <i className="is-cell"><strong>Celda</strong><em>{cellLabel}</em></i>
                        <i className="is-movement"><strong>{formatMetric(movementCount)}</strong><em>movimientos</em></i>
                        <i className="is-source"><strong>{formatMetric(responseCount)}</strong><em>ID fuente</em></i>
                        <i className="is-safe"><CheckCircle2 size={11} /><strong>Origen ok</strong><em>cuota conserva</em></i>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mon-operational-adjustments__empty is-compact">
                <CheckCircle2 size={16} />
                <strong>{suggestionSearch ? "Sin paquetes con ese filtro" : "Sin sugerencias pendientes"}</strong>
                <span>{suggestionSearch ? "Prueba con UMP, distrito, responsable, sexo, edad o ID fuente." : "No hay excedentes compatibles para las brechas abiertas."}</span>
                {suggestionSearch ? (
                  <button type="button" onClick={() => setSuggestionSearch("")}>Limpiar filtro</button>
                ) : null}
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
                <div className="mon-operational-adjustments__detail-body">
                  <div className="mon-operational-decision-spine" aria-label="Ruta del paquete seleccionado">
                    <article className="is-surplus">
                      <span>Sobrante protegido</span>
                      <strong>{territorialOperationalAdjustmentBlockLabel(selected, "source")}</strong>
                      <em>{territorialOperationalAdjustmentSideResponsibleLabel(selected, "source")}</em>
                    </article>
                    <div className="mon-operational-decision-spine__flow">
                      <ArrowRight size={16} />
                      <strong>{formatMetric(numberOrNull(selected.count) ?? 0)} caso(s)</strong>
                      <em>{selectedDistanceLabel || "misma ruta operativa"}</em>
                    </div>
                    <article className="is-pending">
                      <span>UMP faltante</span>
                      <strong>{territorialOperationalAdjustmentBlockLabel(selected, "target")}</strong>
                      <em>{territorialOperationalAdjustmentSideResponsibleLabel(selected, "target")}</em>
                    </article>
                  </div>
                  <div className="mon-operational-decision-facts" aria-label="Evidencia de trazabilidad del paquete">
                    <span className="is-complete"><strong>{formatMetric(selectedMovementCount)}</strong><em>movimientos</em></span>
                    <span className="is-surplus"><strong>{formatMetric(selectedResponseCount)}</strong><em>ID fuente</em></span>
                    <span className="is-pending is-cell"><strong title={territorialOperationalAdjustmentCellLabel(selected)}>{territorialOperationalAdjustmentCellLabel(selected)}</strong><em>celda compatible</em></span>
                    <span className="is-activity"><strong title={selectedTargetActivityLabel}>{selectedTargetActivityLabel}</strong><em>últ. aplicación UMP</em></span>
                  </div>
                  <div className="mon-operational-guardrails" aria-label="Reglas de seguridad del paquete">
                    <span className="is-complete"><CheckCircle2 size={13} /> Origen conserva cuota</span>
                    <span className="is-pending">Sexo + rango + distrito</span>
                    <span className="is-surplus">{formatMetric(selectedResponseCount)} ID(s) reales</span>
                    <span className="is-complete">Sin duplicar respuestas</span>
                  </div>
                  <dl>
                    <div className="is-pending">
                      <dt>Celda faltante</dt>
                      <dd>{territorialOperationalAdjustmentCellLabel(selected)}</dd>
                    </div>
                    <div>
                      <dt>Movimientos del paquete</dt>
                      <dd>{formatMetric(selectedMovementCount)}</dd>
                    </div>
                    <div>
                      <dt>Casos disponibles</dt>
                      <dd>{formatMetric(selectedResponseCount)}</dd>
                    </div>
                    {selectedDistanceLabel ? (
                      <div className="is-distance">
                        <dt>Cercanía</dt>
                        <dd><MapPin size={13} /> {selectedDistanceLabel}</dd>
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
                      <dd>{selectedTargetActivityLabel}</dd>
                    </div>
                  </dl>
                  <div className="mon-operational-package-ledger" aria-label="Desglose del paquete seleccionado">
                    <header>
                      <span>Contabilidad del paquete</span>
                      <strong>{formatMetric(selectedMovements.length)} línea(s)</strong>
                    </header>
                    <div>
                      {selectedMovements.slice(0, 6).map((movement, index) => (
                        <article key={`${movement.source_block_id}-${movement.target_block_id}-${movement.sex}-${movement.age_group}-${index}`}>
                          <span>{formatMetric(numberOrNull(movement.count) ?? movement.source_response_ids?.length ?? 0)}</span>
                          <strong>{territorialOperationalAdjustmentBlockLabel(movement, "source")} → {territorialOperationalAdjustmentBlockLabel(movement, "target")}</strong>
                          <em>{territorialOperationalAdjustmentCellLabel(movement)}</em>
                        </article>
                      ))}
                    </div>
                  </div>
                  <label className="mon-operational-adjustments__note">
                    <span>Nota de decisión</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.currentTarget.value)}
                      rows={3}
                      disabled={saving || Boolean(busyId)}
                    />
                  </label>
                </div>
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
                  <strong>{appliedHeaderLabel}</strong>
                </div>
                <div className="mon-operational-adjustments__panel-tools">
                  <div className="mon-operational-applied-segment" aria-label="Filtrar historial operativo por estado">
                    {appliedStatusOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`status-${option.key}${appliedStatusFilter === option.key ? " is-active" : ""}`}
                        aria-pressed={appliedStatusFilter === option.key}
                        aria-label={option.ariaLabel}
                        onClick={() => setAppliedStatusFilter(option.key)}
                      >
                        <span>{option.label}</span>
                        <strong>{formatMetric(option.count)}</strong>
                      </button>
                    ))}
                  </div>
                  <label className="mon-operational-adjustments__search">
                    <Search size={13} />
                    <input
                      value={appliedSearch}
                      onChange={(event) => setAppliedSearch(event.currentTarget.value)}
                      placeholder="Filtrar historial..."
                    />
                    {appliedSearch ? (
                      <button type="button" onClick={() => setAppliedSearch("")} aria-label="Limpiar filtro de historial">
                        <XCircle size={12} />
                      </button>
                    ) : null}
                  </label>
                  <div className="mon-operational-applied-audit" aria-label="Resumen de auditoría de subsanaciones">
                    <span className="is-active"><strong>{formatMetric(active.length)}</strong><em>activas</em></span>
                    <span className="is-reverted"><strong>{formatMetric(reverted.length)}</strong><em>revertidas</em></span>
                    <span className="is-gain"><strong>{formatMetric(summary.operational_gain ?? active.reduce((total, item) => total + (numberOrNull(item.count) ?? 0), 0))}</strong><em>ganancia</em></span>
                  </div>
                </div>
              </header>
              <div className="mon-operational-adjustments__applied-list">
                {visibleAppliedRows.length ? visibleAppliedRows.map((item) => {
                  const id = stringOrEmpty(item.id).trim();
                  const isActive = territorialOperationalAppliedStatus(item) === "active";
                  const movementCount = numberOrNull(item.package_movements) ?? item.adjustments?.length ?? 1;
                  const responseCount = territorialOperationalAdjustmentResponseCount(territorialOperationalAdjustmentMovements(item));
                  const caseCount = numberOrNull(item.count) ?? 0;
                  const targetLabel = territorialOperationalAdjustmentBlockLabel(item, "target");
                  const sourceLabel = territorialOperationalAdjustmentBlockLabel(item, "source");
                  const cellLabel = territorialOperationalAdjustmentCellLabel(item);
                  const stateLabel = isActive ? "Activa" : "Revertida";
                  return (
                    <article key={id || `${item.source_block_id}-${item.target_block_id}`} className={`mon-operational-applied is-${isActive ? "active" : "reverted"}`}>
                      <span className="mon-operational-applied__state">{stateLabel}</span>
                      <div className="mon-operational-applied__ledger">
                        <div className="mon-operational-applied__cell is-target">
                          <small>UMP cerrada</small>
                          <strong>{targetLabel}</strong>
                          <em>{cellLabel}</em>
                        </div>
                        <div className="mon-operational-applied__cell is-source">
                          <small>Sobrante usado</small>
                          <strong>{sourceLabel}</strong>
                          <em>{formatMetric(movementCount)} movimiento(s)</em>
                        </div>
                        <div className="mon-operational-applied__cell is-audit">
                          <small>Evidencia</small>
                          <strong>{formatMetric(caseCount)} caso(s)</strong>
                          <em>{formatMetric(responseCount)} ID(s) · {territorialOperationalAppliedDateLabel(item)}</em>
                        </div>
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
                }) : (
                  <div className="mon-operational-adjustments__empty is-compact">
                    <Search size={16} />
                    <strong>{appliedSearch ? "Sin historial con ese filtro" : `Sin subsanaciones ${appliedFilterLabel}`}</strong>
                    <span>{appliedSearch ? "Prueba con UMP, distrito, responsable, sexo, edad o ID fuente." : "Cambia el estado del historial para ver otros movimientos auditados."}</span>
                    {appliedSearch ? (
                      <button type="button" onClick={() => setAppliedSearch("")}>Limpiar filtro</button>
                    ) : null}
                  </div>
                )}
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

function territorialOperationalAdjustmentMovements(item: MonitoreoTerritorialOperationalAdjustment) {
  return item.adjustments?.length ? item.adjustments : [item];
}

function territorialOperationalAdjustmentResponseCount(items: MonitoreoTerritorialOperationalAdjustment[]) {
  const ids = new Set<string>();
  let fallback = 0;
  items.forEach((item) => {
    const responseIds = item.source_response_ids ?? [];
    responseIds.forEach((id) => {
      const normalized = stringOrEmpty(id).trim();
      if (normalized) ids.add(normalized);
    });
    if (!responseIds.length) fallback += numberOrNull(item.count) ?? 0;
  });
  return ids.size || fallback;
}

function territorialOperationalAppliedStatus(item: MonitoreoTerritorialOperationalAdjustment): "active" | "reverted" {
  return stringOrEmpty(item.status || "active").trim().toLowerCase() === "active" ? "active" : "reverted";
}

function territorialOperationalAppliedDateLabel(item: MonitoreoTerritorialOperationalAdjustment) {
  const status = territorialOperationalAppliedStatus(item);
  const date = status === "active"
    ? stringOrEmpty(item.created_at || item.latest_activity || item.target_latest_activity)
    : stringOrEmpty(item.reverted_at || item.created_at || item.latest_activity || item.target_latest_activity);
  const label = territorialOperationalAdjustmentDateLabel(date, "Sin fecha");
  return status === "active" ? `Activa desde ${label}` : `Revertida el ${label}`;
}

function territorialOperationalAppliedCompare(
  a: MonitoreoTerritorialOperationalAdjustment,
  b: MonitoreoTerritorialOperationalAdjustment,
) {
  const aActive = territorialOperationalAppliedStatus(a) === "active";
  const bActive = territorialOperationalAppliedStatus(b) === "active";
  if (aActive !== bActive) return aActive ? -1 : 1;
  const aDate = territorialOperationalAdjustmentActivitySortValue(
    aActive ? (a.created_at || a.latest_activity || a.target_latest_activity) : (a.reverted_at || a.created_at || a.latest_activity || a.target_latest_activity),
  );
  const bDate = territorialOperationalAdjustmentActivitySortValue(
    bActive ? (b.created_at || b.latest_activity || b.target_latest_activity) : (b.reverted_at || b.created_at || b.latest_activity || b.target_latest_activity),
  );
  if (aDate !== bDate) return bDate - aDate;
  return territorialOperationalAdjustmentBlockLabel(a, "target").localeCompare(
    territorialOperationalAdjustmentBlockLabel(b, "target"),
    "es",
  );
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

function territorialOperationalAdjustmentSearchText(item: MonitoreoTerritorialOperationalAdjustment) {
  const movements = territorialOperationalAdjustmentMovements(item);
  return normalizeOperationalSearch([
    item.id,
    item.package_id,
    item.status,
    item.reason,
    item.note,
    item.district,
    item.ubigeo,
    item.source_ump,
    item.source_manzana,
    item.source_block_id,
    item.source_responsible,
    item.target_ump,
    item.target_manzana,
    item.target_block_id,
    item.target_responsible,
    item.sex,
    item.age_group,
    item.created_at,
    item.reverted_at,
    territorialOperationalAdjustmentBlockLabel(item, "source"),
    territorialOperationalAdjustmentBlockLabel(item, "target"),
    territorialOperationalAdjustmentCellLabel(item),
    territorialOperationalAdjustmentDistanceLabel(item),
    ...movements.flatMap((movement) => [
      movement.id,
      movement.package_id,
      movement.district,
      movement.ubigeo,
      movement.source_ump,
      movement.source_manzana,
      movement.source_block_id,
      movement.source_responsible,
      movement.target_ump,
      movement.target_manzana,
      movement.target_block_id,
      movement.target_responsible,
      movement.sex,
      movement.age_group,
      territorialOperationalAdjustmentBlockLabel(movement, "source"),
      territorialOperationalAdjustmentBlockLabel(movement, "target"),
      territorialOperationalAdjustmentCellLabel(movement),
      ...(movement.source_response_ids ?? []),
    ]),
    ...(item.source_response_ids ?? []),
  ].join(" "));
}

function normalizeOperationalSearch(value: unknown) {
  return stringOrEmpty(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
