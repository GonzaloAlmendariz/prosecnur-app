/**
 * Pestaña "Categorías" de Definición. La elegibilidad es la estrella: el flujo
 * universo → elegibles con la merma real del motor (exclusiones agrupadas por
 * motivo) al lado de los criterios de inclusión editables — condiciones
 * aceptadas como chips con conteo observado, filtros de pregrado/presencial/
 * mayoría de edad y mínimo por aula. Debajo, el mapeo de categorías observadas
 * en master-detail compacto con búsqueda. El término "matriculados elegibles"
 * se explica aquí (única vez).
 */
import { useState } from "react";
import { ArrowRight, PencilLine, Search, Table2, Target } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { fmtInt, rowsFrom, safeNumber } from "../../sharedCore";
import {
  categoryCountBaseLabel,
  categoryUnitLabel,
  normalizeObservedCategoryKey,
  sourceRoleLabel,
  universityObservedCategoryRows,
  upsertWorkspaceCategoryValue,
  type UniversityObservedCategory,
} from "../shared/categorias";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { frameAuditNumber } from "../shared/frame";
import { FlujoVertical, PanelAvanzado, TerminoChip, type FlujoEtapa } from "../ui";
import { useValorSwap } from "../ui/useValorSwap";
import "./definicion.css";

/** Etiquetas legibles para los motivos de exclusión que reporta el motor R. */
const MOTIVO_EXCLUSION_LABELS: Record<string, string> = {
  student_id: "sin identificador",
  age: "menores de edad",
  condition: "condición no aceptada",
  level: "nivel fuera de pregrado",
  modality: "modalidad no presencial",
  session_type: "tipo de sesión excluido",
  classroom_id: "sin aula identificable",
  min_eligible_per_class: "aula bajo el mínimo",
};

/** Conteo del chip de condición: cruza con blur (.cmv2-uni-swap) al cambiar. */
function ConteoCondicion({ count }: { count: number }) {
  const cambiando = useValorSwap(count);
  return (
    <em className="cmv2-uni-swap" data-cambiando={cambiando || undefined}>
      {fmtInt(count)}
    </em>
  );
}

export function DefCategoriasTab({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const config = normalizeUniversityAulasConfig(workspace.aulas_config);
  const frame = aulasState?.frame ?? null;
  const exclusionRows = rowsFrom<Record<string, unknown>>(frame?.exclusions);
  const inputRows = frameAuditNumber(frame, "input_rows");
  const eligibleRows = frameAuditNumber(frame, "eligible_student_rows");
  const populationN = Math.max(rowsFrom(frame?.population).length, frameAuditNumber(frame, "population_n"));
  const excludedRows = frameAuditNumber(frame, "excluded_rows") || exclusionRows.length;
  const observedRows = universityObservedCategoryRows(workspace, aulasState);
  const conditionRows = observedRows.filter((row) => row.role === "condition");
  const accepted = config.accepted_conditions ?? ["regular"];
  const acceptedKeys = new Set(accepted.map((value) => normalizeObservedCategoryKey(value)));

  const motivoCounts = new Map<string, number>();
  exclusionRows.forEach((row) => {
    String(row.exclude_reason ?? "")
      .split("|")
      .map((flag) => flag.trim())
      .filter(Boolean)
      .forEach((flag) => motivoCounts.set(flag, (motivoCounts.get(flag) ?? 0) + 1));
  });
  const topMotivos = Array.from(motivoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  function updateConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({ ...workspace, aulas_config: normalizeUniversityAulasConfig({ ...config, ...patch }) });
  }

  function updateConditions(value: string) {
    const nextAccepted = value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    updateConfig({ accepted_conditions: nextAccepted.length ? nextAccepted : ["regular"] });
  }

  function toggleCondition(raw: string) {
    const key = normalizeObservedCategoryKey(raw);
    const has = acceptedKeys.has(key);
    const next = has
      ? accepted.filter((value) => normalizeObservedCategoryKey(value) !== key)
      : [...accepted, raw];
    updateConfig({ accepted_conditions: next.length ? next : ["regular"] });
  }

  const etapas: FlujoEtapa[] = [
    {
      id: "universo",
      label: "Universo",
      valor: inputRows > 0 ? fmtInt(inputRows) : undefined,
      detalle: inputRows > 0 ? "filas leídas del archivo" : "se conoce al construir el marco",
      estado: inputRows > 0 ? "ready" : "pending",
      merma: excludedRows > 0 ? { n: excludedRows, label: "filas excluidas" } : undefined,
    },
    {
      id: "elegibles",
      label: "Elegibles",
      valor: eligibleRows > 0 ? fmtInt(eligibleRows) : undefined,
      detalle: eligibleRows > 0
        ? populationN > 0 ? `${fmtInt(populationN)} estudiantes únicos` : "filas que cumplen los criterios"
        : "según los criterios de esta pestaña",
      estado: eligibleRows > 0 ? "ready" : "pending",
    },
  ];

  return (
    <>
      <section className="cmv2-panel cmv2-eligibility-panel">
        <p className="cmv2-defi-intro">
          El universo son todas las filas de la base; los{" "}
          <TerminoChip termino="matriculados elegibles">matriculados elegibles</TerminoChip> son
          quienes cumplen los criterios de inclusión que fijas aquí. Todo lo que queda fuera se
          audita con su motivo, nunca se descarta en silencio.
        </p>
        <div className="cmv2-defi-eleg-layout">
          <div className="cmv2-defi-eleg-flujo cmv2-defi-stagger">
            <FlujoVertical etapas={etapas} ariaLabel="Del universo a los elegibles" />
            {topMotivos.length > 0 ? (
              <div className="cmv2-defi-motivos">
                <small>Motivos principales</small>
                <div className="cmv2-defi-motivos-list">
                  {topMotivos.map(([flag, count]) => (
                    <span key={flag}>
                      {MOTIVO_EXCLUSION_LABELS[flag] ?? flag.replace(/_/g, " ")}
                      <em>{fmtInt(count)}</em>
                    </span>
                  ))}
                </div>
              </div>
            ) : !frame ? (
              <EmptyState
                variant="inline"
                icon={<Target size={18} />}
                title="La merma real aparece al construir el marco"
                hint="Cuando la base esté leída verás cuántas filas quedaron fuera y por qué motivo."
              />
            ) : null}
          </div>
          <div className="cmv2-defi-criterios">
            <div className="cmv2-defi-cond">
              <small>Condiciones aceptadas</small>
              {conditionRows.length > 0 ? (
                <>
                  <div className="cmv2-defi-cond-chips" role="group" aria-label="Valores de condición observados">
                    {conditionRows.map((row) => {
                      const active = acceptedKeys.has(normalizeObservedCategoryKey(row.raw));
                      return (
                        <button
                          key={row.raw}
                          type="button"
                          className="cmv2-defi-cond-chip"
                          aria-pressed={active}
                          title={active ? `Dejar de aceptar "${row.raw}"` : `Aceptar "${row.raw}" como elegible`}
                          onClick={() => toggleCondition(row.raw)}
                        >
                          {row.raw}
                          <ConteoCondicion count={row.count} />
                        </button>
                      );
                    })}
                  </div>
                  <p className="cmv2-defi-cond-hint">
                    Cada chip es un valor real de la columna de condición con su conteo. Los marcados definen quién entra a la población objetivo.
                  </p>
                  <PanelAvanzado titulo="Editar valores aceptados a mano" descripcion="para valores que aún no aparecen en la base">
                    <label className="cmv2-compact-field">
                      <span>Valores aceptados en condición/elegibilidad</span>
                      <input
                        value={accepted.join(", ")}
                        placeholder="regular, elegible, válido"
                        onChange={(e) => updateConditions(e.currentTarget.value)}
                      />
                      <em>Separar varios valores con coma. La app buscará coincidencias normalizadas.</em>
                    </label>
                  </PanelAvanzado>
                </>
              ) : (
                <label className="cmv2-compact-field">
                  <span>Valores aceptados en condición/elegibilidad</span>
                  <input
                    value={accepted.join(", ")}
                    placeholder="regular, elegible, válido"
                    onChange={(e) => updateConditions(e.currentTarget.value)}
                  />
                  <em>Separar varios valores con coma. Cuando la base esté leída verás aquí los valores reales con su conteo.</em>
                </label>
              )}
            </div>
            <div className="cmv2-eligibility-toggles">
              <label className="cmv2-classroom-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(config.require_undergraduate)}
                  onChange={(e) => updateConfig({ require_undergraduate: e.currentTarget.checked })}
                />
                <span><strong>Restringir a pregrado</strong><em>Excluye posgrado cuando se detecta en nivel/ciclo.</em></span>
              </label>
              <label className="cmv2-classroom-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(config.require_in_person)}
                  onChange={(e) => updateConfig({ require_in_person: e.currentTarget.checked })}
                />
                <span><strong>Exigir aplicación presencial</strong><em>Excluye modalidades virtuales/remotas para selección de aulas.</em></span>
              </label>
              <label className="cmv2-classroom-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(config.require_adult)}
                  onChange={(e) => updateConfig({ require_adult: e.currentTarget.checked })}
                />
                <span><strong>Aplicar mayoría de edad si existe</strong><em>Útil cuando el protocolo exige filtrar por edad declarada.</em></span>
              </label>
            </div>
            <div className="cmv2-defi-criterios-mins">
              <label className="cmv2-compact-field">
                <span>Mínimo de elegibles por aula</span>
                <input
                  type="number"
                  min={1}
                  value={config.min_elegibles_aula}
                  onChange={(e) => updateConfig({ min_elegibles_aula: Math.max(1, Math.round(safeNumber(e.currentTarget.value, config.min_elegibles_aula))) })}
                />
                <em>Aulas menores quedan auditadas, pero no entran como titulares.</em>
              </label>
              <label className="cmv2-compact-field">
                <span>Edad mínima, si la base trae edad</span>
                <input
                  type="number"
                  min={0}
                  value={config.min_age ?? 18}
                  disabled={!config.require_adult}
                  onChange={(e) => updateConfig({ min_age: Math.max(0, Math.round(safeNumber(e.currentTarget.value, config.min_age ?? 18))) })}
                />
                <em>Solo se aplica si la columna existe y el filtro está activo.</em>
              </label>
            </div>
          </div>
        </div>
        <div className="cmv2-classroom-note">
          <Target size={15} />
          <span>Estos criterios no seleccionan aulas todavía. Solo definen quién pertenece al universo y qué filas pueden entrar al marco de aplicación.</span>
        </div>
      </section>
      <CategoriasObservadas workspace={workspace} observedRows={observedRows} frameReady={Boolean(
        rowsFrom(frame?.population).length || rowsFrom(frame?.aula_frame).length
      )} onWorkspace={onWorkspace} />
    </>
  );
}

/** Mapeo de categorías observadas: master-detail compacto con búsqueda de valores. */
function CategoriasObservadas({
  workspace,
  observedRows,
  frameReady,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  observedRows: UniversityObservedCategory[];
  frameReady: boolean;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  const groups = observedRows.reduce<Array<{ key: string; variableLabel: string; column: string; sourceRole?: string; unitLabel: string; rows: UniversityObservedCategory[] }>>((acc, row) => {
    const key = `${row.role}::${row.column}`;
    const existing = acc.find((item) => item.key === key);
    if (existing) {
      existing.rows.push(row);
      return acc;
    }
    acc.push({ key, variableLabel: row.variableLabel, column: row.column, sourceRole: row.sourceRole, unitLabel: categoryUnitLabel(row.role, row.unitLabel), rows: [row] });
    return acc;
  }, []);
  const [activeGroupKey, setActiveGroupKey] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  function updateCategory(row: UniversityObservedCategory, label: string) {
    onWorkspace({
      ...workspace,
      category_mappings: upsertWorkspaceCategoryValue(workspace.category_mappings, row, label),
    });
  }

  function categoryRowKey(row: UniversityObservedCategory) {
    return `${row.role}::${row.column}::${row.raw}`;
  }

  const effectiveActiveGroupKey = groups.some((group) => group.key === activeGroupKey)
    ? activeGroupKey
    : groups[0]?.key ?? "";
  const selectedGroup = groups.find((group) => group.key === effectiveActiveGroupKey) ?? groups[0] ?? null;
  const selectedRows = selectedGroup?.rows ?? [];
  const query = busqueda.trim().toLowerCase();
  const visibleRows = query
    ? selectedRows.filter((row) => row.raw.toLowerCase().includes(query) || row.label.toLowerCase().includes(query))
    : selectedRows;
  const selectedEditedCount = selectedRows.filter((row) => row.saved).length;
  const selectedTotalRows = selectedRows.reduce((sum, row) => sum + row.count, 0);
  const selectedCountBase = selectedGroup ? categoryCountBaseLabel(selectedGroup.unitLabel) : "filas con valor";

  return (
    <section className="cmv2-panel cmv2-university-category-map">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Categorías observadas</span>
          <strong>Revisa el significado de los valores encontrados</strong>
        </div>
        <span className="cmv2-pill-soft">{observedRows.length ? `${observedRows.length} valores` : frameReady ? "sin categorías" : "requiere lectura"}</span>
      </div>
      {observedRows.length ? (
        <div className="cmv2-category-browser">
          <aside className="cmv2-category-variable-pane" aria-label="Variables con categorías observadas">
            <div className="cmv2-category-pane-head">
              <span>Variables</span>
              <strong>{groups.length}</strong>
            </div>
            <div className="cmv2-category-variable-list" role="listbox" aria-label="Variables observadas">
              {groups.map((group) => {
                const active = group.key === effectiveActiveGroupKey;
                const editedCount = group.rows.filter((row) => row.saved).length;
                const totalRows = group.rows.reduce((sum, row) => sum + row.count, 0);
                return (
                  <button
                    key={group.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`cmv2-category-variable-row ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveGroupKey(group.key);
                      setEditingCategoryKey(null);
                      setBusqueda("");
                    }}
                  >
                    <span className="cmv2-category-variable-main">
                      <span>
                        <strong>{group.variableLabel}</strong>
                        <small>{sourceRoleLabel(group.sourceRole ?? "") || "Base"}</small>
                      </span>
                      <span className="cmv2-category-variable-meta">
                        <em>{group.rows.length} categorías</em>
                        <em>{fmtInt(totalRows)} {group.unitLabel}</em>
                        {editedCount > 0 && <em>{editedCount} editadas</em>}
                      </span>
                    </span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedGroup && (
            <article
              key={selectedGroup.key}
              className="cmv2-category-detail-card"
              aria-label={`Categorías de ${selectedGroup.variableLabel}`}
            >
              <header className="cmv2-category-detail-head">
                <div>
                  <small>{sourceRoleLabel(selectedGroup.sourceRole ?? "") || "Base"}</small>
                  <strong>{selectedGroup.variableLabel}</strong>
                  <span className="cmv2-defi-cat-meta">
                    {selectedGroup.rows.length} categorías · {fmtInt(selectedTotalRows)} {selectedCountBase}
                    {selectedEditedCount > 0 ? ` · ${selectedEditedCount} editadas` : ""}
                  </span>
                </div>
              </header>
              <div className="cmv2-defi-cat-search">
                <Search size={13} aria-hidden="true" />
                <input
                  value={busqueda}
                  placeholder={`Buscar valor en ${selectedGroup.variableLabel.toLowerCase()}`}
                  aria-label={`Buscar valor en ${selectedGroup.variableLabel}`}
                  onChange={(e) => setBusqueda(e.currentTarget.value)}
                />
                {query && <span className="cmv2-defi-cat-meta">{visibleRows.length}/{selectedRows.length}</span>}
              </div>
              <div className="cmv2-category-detail-list">
                {visibleRows.map((row) => {
                  const rowKey = categoryRowKey(row);
                  const editing = editingCategoryKey === rowKey;
                  return (
                    <div key={rowKey} className={`cmv2-category-detail-row ${editing ? "is-editing" : ""}`}>
                      <span className="cmv2-category-raw">
                        <b>{row.raw}</b>
                        <small>{fmtInt(row.count)} {categoryUnitLabel(row.role, row.unitLabel)}</small>
                      </span>
                      <span className="cmv2-category-meaning">
                        <small>Se leerá como</small>
                        {editing ? (
                          <input
                            autoFocus
                            value={row.label}
                            onChange={(event) => updateCategory(row, event.currentTarget.value)}
                            onBlur={() => setEditingCategoryKey(null)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") {
                                event.currentTarget.blur();
                              }
                            }}
                            aria-label={`Lectura para ${row.variableLabel}: ${row.raw}`}
                          />
                        ) : (
                          <strong>{row.label}</strong>
                        )}
                      </span>
                      <button
                        type="button"
                        className={`cmv2-icon-button cmv2-category-edit ${editing ? "is-active" : ""}`}
                        onClick={() => setEditingCategoryKey(editing ? null : rowKey)}
                        title={`Editar lectura de ${row.raw}`}
                        aria-label={`Editar lectura de ${row.raw}`}
                      >
                        <PencilLine size={14} />
                      </button>
                    </div>
                  );
                })}
                {!visibleRows.length && (
                  <p className="cmv2-defi-cat-meta">Ningún valor coincide con "{busqueda}".</p>
                )}
              </div>
            </article>
          )}
        </div>
      ) : (
        <EmptyState
          variant="inline"
          icon={<Table2 size={18} />}
          title={frameReady ? "Sin categorías en las columnas elegidas" : "Lee la base para ver categorías"}
          hint={frameReady
            ? "Revisa en Variables que las columnas de sexo, facultad, ciclo, condición, horario o modalidad estén bien asignadas."
            : "Cuando la base esté leída, esta pestaña mostrará los valores reales encontrados en sexo, facultad, ciclo, condición, horario o modalidad para confirmar qué significa cada uno."}
        />
      )}
    </section>
  );
}
