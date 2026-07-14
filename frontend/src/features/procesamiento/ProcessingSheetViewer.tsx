import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Database, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import type {
  ProcessingSheetColumn,
  ProcessingSheetColumnFilter,
  ProcessingSheetMode,
  ProcessingSheetPayload,
  ProcessingSheetRequest,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";
import { RepeatBadge } from "../../components/RepeatBadge";
import { RepeatGrainNote } from "../../components/RepeatGrainNote";
import {
  buildExplorerGrain,
  formatPersonTag,
  markRosterRows,
  orderColumnsForRoster,
  resolveRosterColumns,
  type ProcessingSheetRepeatContext,
} from "../../lib/rosterExplorer";
import { ColumnFilterControl, columnFilterActive, describeColumnFilter } from "./ColumnFilterControl";
import "./processingSheetViewer.css";

type Props = {
  title: string;
  sourceLabel: string;
  enabled?: boolean;
  disabledMessage?: string;
  highlightCoding?: boolean;
  request?: ProcessingSheetRequest;
  load: (opts: ProcessingSheetRequest) => Promise<ProcessingSheetPayload>;
  /**
   * Contexto relacional cuando la base mostrada es una hija repeat (ADR 0030
   * Fase 5). Activa la lectura roster: banner de grano, badge naranja, columna
   * de vínculo a la persona y agrupamiento visual. `null`/ausente = tabla normal.
   */
  repeat?: ProcessingSheetRepeatContext | null;
};

/** Etiqueta de cabecera para las columnas guía de las respuestas repetidas. */
const ROSTER_HEAD_LABEL = {
  person: "Persona",
  "service-label": "Registro",
  "service-code": "Código",
} as const;
type RosterRole = keyof typeof ROSTER_HEAD_LABEL;

type SortState = { col: string; desc: boolean } | null;

const PAGE_SIZES = [25, 50, 100, 200] as const;

const KIND_LABELS: Record<ProcessingSheetColumn["type_kind"], string> = {
  integer: "Entera",
  sm: "Múltiple",
  so: "Única",
  text: "Texto",
  other: "Otro",
};
const TEXT_TO_MULTIPLE_LABEL = "Abierta a múltiple";

export function ProcessingSheetViewer({
  title,
  sourceLabel,
  enabled = true,
  disabledMessage = "Base no disponible.",
  highlightCoding = false,
  request,
  load,
  repeat = null,
}: Props) {
  const [mode, setMode] = useState<ProcessingSheetMode>("codigos");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, ProcessingSheetColumnFilter>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [payload, setPayload] = useState<ProcessingSheetPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = useMemo(() => JSON.stringify(request ?? {}), [request]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      setSearch(searchDraft);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [requestKey]);

  useEffect(() => {
    if (!enabled) {
      setPayload(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    load({
      ...(request ?? {}),
      modo: mode,
      page,
      page_size: pageSize,
      search,
      column_filters: columnFilters,
      sort,
    })
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [columnFilters, enabled, load, mode, page, pageSize, reloadKey, requestKey, search, sort]);

  useEffect(() => {
    if (!loading) {
      setLoadingSlow(false);
      return;
    }
    const handle = window.setTimeout(() => setLoadingSlow(true), 2500);
    return () => window.clearTimeout(handle);
  }, [loading]);

  const rawColumns = payload?.columns ?? [];
  // --- Lectura relacional de una base hija repeat (ADR 0030 Fase 5) ----------
  // No se cambia el modelo de datos: sólo se reinterpreta la tabla como
  // respuesta-por-instancia con vínculo a la persona.
  const isRoster = !!repeat;
  const rosterCols = useMemo(
    () =>
      isRoster
        ? resolveRosterColumns(rawColumns.map((column) => column.key), { linkKey: repeat?.linkKey })
        : { personKey: null, serviceLabelKey: null, serviceCodeKey: null },
    [isRoster, rawColumns, repeat?.linkKey],
  );
  const columns = useMemo(() => {
    const ordered = orderColumnsForCoding(rawColumns, highlightCoding);
    return isRoster ? orderColumnsForRoster(ordered, rosterCols) : ordered;
  }, [highlightCoding, rawColumns, isRoster, rosterCols]);
  const total = payload?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleStart = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = payload ? Math.min(total, visibleStart + payload.rows.length - 1) : 0;
  const activeColumnFilters = useMemo(
    () => Object.entries(columnFilters).filter(([, value]) => columnFilterActive(value)),
    [columnFilters],
  );
  const activeFilters = activeColumnFilters.length > 0 || search.trim().length > 0;
  const columnByKey = useMemo(() => {
    const map = new Map<string, ProcessingSheetColumn>();
    for (const column of rawColumns) map.set(column.key, column);
    return map;
  }, [rawColumns]);
  const hasCodingLegend = highlightCoding && columns.some((column) => isColumnWithKindColor(column));
  const hasOpenTextMultipleLegend = highlightCoding && columns.some((column) => isOpenTextMultipleRecodColumn(column));
  const isWideSheet = (payload?.n_columns ?? columns.length) > 8;

  const rosterGrain = useMemo(
    () =>
      isRoster
        ? buildExplorerGrain({
            grain: repeat?.grain,
            nInstancias: repeat?.nInstancias ?? (total > 0 ? total : null),
            nPersonas: repeat?.grain?.n_personas ?? null,
            repeatGroup: repeat?.repeatGroup,
            parentBase: repeat?.parentBase,
          })
        : null,
    [isRoster, repeat, total],
  );
  const rowMarks = useMemo(
    () => (isRoster && rosterCols.personKey ? markRosterRows(payload?.rows ?? [], rosterCols.personKey) : []),
    [isRoster, rosterCols.personKey, payload],
  );
  const rosterRole = (key: string): RosterRole | null => {
    if (!isRoster) return null;
    if (key === rosterCols.personKey) return "person";
    if (key === rosterCols.serviceLabelKey) return "service-label";
    if (key === rosterCols.serviceCodeKey) return "service-code";
    return null;
  };
  const rosterUnitLabel = total === 1 ? "fila repetida" : "filas repetidas";

  function resetFilters() {
    setSearchDraft("");
    setSearch("");
    setColumnFilters({});
    setSort(null);
    setPage(1);
  }

  function setColumnFilterValue(key: string, value: ProcessingSheetColumnFilter | undefined) {
    setPage(1);
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value != null && columnFilterActive(value)) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  function toggleSort(column: ProcessingSheetColumn) {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.col !== column.key) return { col: column.key, desc: false };
      if (!prev.desc) return { col: column.key, desc: true };
      return null;
    });
  }

  if (!enabled) {
    return (
      <section className="pulso-processing-sheet is-disabled" aria-label={title}>
        <div className="pulso-processing-sheet-empty">
          <Database size={20} />
          <strong>{disabledMessage}</strong>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`pulso-processing-sheet${isWideSheet ? " is-wide" : ""}${isRoster ? " is-roster" : ""}`}
      aria-label={title}
      data-repeat-roster={isRoster ? "true" : undefined}
      data-audit-ready={isRoster ? "true" : undefined}
    >
      <div className="pulso-processing-sheet-toolbar">
        <div className="pulso-processing-sheet-title">
          <span className="pulso-processing-sheet-icon" aria-hidden="true">
            <Database size={16} />
          </span>
          <div>
            <strong>
              {title}
              {isRoster && (
                <RepeatBadge
                  repeatGroup={repeat?.repeatGroup}
                  compact
                  className="pulso-processing-sheet-roster-badge"
                  title={
                    repeat?.parentBase
                      ? `Respuestas repetidas de «${repeat.parentBase}» (una fila por opción marcada)`
                      : "Base de respuestas repetidas"
                  }
                />
              )}
            </strong>
            <span className="pulso-processing-sheet-source">{sourceLabel}</span>
            {payload && (
              <span className="pulso-processing-sheet-meta">
                {total.toLocaleString("es-PE")} {isRoster ? rosterUnitLabel : "filas"} ·{" "}
                {payload.n_columns.toLocaleString("es-PE")} columnas
              </span>
            )}
          </div>
        </div>

        <div className="pulso-processing-sheet-actions">
          <div className="pulso-processing-sheet-mode" role="group" aria-label="Modo de valores">
            <button
              type="button"
              aria-pressed={mode === "codigos"}
              className={mode === "codigos" ? "is-active" : ""}
              onClick={() => {
                setPage(1);
                setMode("codigos");
              }}
            >
              Códigos
            </button>
            <button
              type="button"
              aria-pressed={mode === "etiquetas"}
              className={mode === "etiquetas" ? "is-active" : ""}
              onClick={() => {
                setPage(1);
                setMode("etiquetas");
              }}
            >
              Etiquetas
            </button>
          </div>

          <label className="pulso-processing-sheet-search">
            <Search size={13} aria-hidden="true" />
            <span className="pulso-sr-only">Buscar</span>
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar"
            />
          </label>

          <button
            type="button"
            className="pulso-processing-sheet-icon-button"
            onClick={resetFilters}
            disabled={!activeFilters && !sort}
            title="Restablecer"
            aria-label="Restablecer filtros"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="pulso-processing-sheet-icon-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            title="Actualizar"
            aria-label="Actualizar tabla"
          >
            <RefreshCw size={14} className={loading ? "pulso-spin" : ""} />
          </button>
        </div>
      </div>

      {isRoster && rosterGrain && (
        <div className="pulso-processing-sheet-roster">
          <RepeatGrainNote grain={rosterGrain} />
          {rosterCols.personKey && (
            <p className="pulso-processing-sheet-roster-hint">
              Cada fila es un registro repetido, no una persona. La columna{" "}
              <strong>Persona</strong> indica quién respondió; las filas de una
              misma persona van agrupadas.
            </p>
          )}
        </div>
      )}

      {activeColumnFilters.length > 0 && (
        <div className="pulso-processing-sheet-chips" aria-label="Filtros activos">
          {activeColumnFilters.map(([key, value]) => {
            const column = columnByKey.get(key);
            if (!column) return null;
            return (
              <button
                type="button"
                key={`chip-${key}`}
                className="pulso-processing-sheet-chip"
                onClick={() => setColumnFilterValue(key, undefined)}
                title="Quitar filtro"
              >
                <span>{describeColumnFilter(column, value)}</span>
                <X size={12} aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            className="pulso-processing-sheet-chip is-clear"
            onClick={() => { setColumnFilters({}); setPage(1); }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {hasCodingLegend && (
        <div className="pulso-processing-sheet-legend" aria-label="Lectura de columnas recodificadas">
          <span className="is-original">
            <i aria-hidden="true" />
            Variables originales
          </span>
          <em>Recodificadas y dummies múltiples usan color</em>
          {(["integer", "sm", "so", "text"] as const).map((kind) => (
            <span key={kind} className={`is-${kind}`}>
              <i aria-hidden="true" />
              {KIND_LABELS[kind]}
            </span>
          ))}
          {hasOpenTextMultipleLegend && (
            <span className="is-text-sm">
              <i aria-hidden="true" />
              {TEXT_TO_MULTIPLE_LABEL}
            </span>
          )}
        </div>
      )}

      {error ? (
        <ErrorBlock label="No se pudo cargar la base" detail={error} />
      ) : !payload && loading ? (
        <div className="pulso-processing-sheet-loading" role="status" aria-live="polite">
          <div className="pulso-processing-sheet-loading-card">
            <span className="pulso-processing-sheet-loading-icon" aria-hidden="true">
              <RefreshCw size={17} className="pulso-spin" />
            </span>
            <div>
              <strong>Armando vista previa</strong>
              <span>
                {loadingSlow
                  ? "El proyecto tiene muchas columnas. Seguimos preparando la tabla sin cambiar la base."
                  : `Cargando ${title.toLowerCase()} con filtros y nombres de columnas.`}
              </span>
            </div>
          </div>

          <div className="pulso-processing-sheet-loading-steps" aria-hidden="true">
            <span><i /> Primeras filas</span>
            <span><i /> Filtros por columna</span>
            <span><i /> {highlightCoding ? "Recodificadas al lado" : "Columnas listas"}</span>
          </div>

          <div className="pulso-processing-sheet-loading-skeleton" aria-hidden="true">
            {Array.from({ length: 5 }, (_, rowIndex) => (
              <div key={rowIndex}>
                {Array.from({ length: 6 }, (_, colIndex) => (
                  <span key={colIndex} className={colIndex === 0 ? "is-short" : ""} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="pulso-processing-sheet-scroll">
            <table className="pulso-processing-sheet-table">
              <thead>
                <tr>
                  <th className="pulso-processing-sheet-rownum" aria-label="Fila">
                    <BookOpen size={13} />
                  </th>
                  {columns.map((column) => {
                    const sorted = sort?.col === column.key;
                    const displayKind = columnDisplayKind(column);
                    const role = rosterRole(column.key);
                    return (
                      <th
                        key={column.key}
                        className={rosterHeadClass(columnClass(column, highlightCoding), role)}
                        data-kind={displayKind}
                        aria-sort={sorted ? sort?.desc ? "descending" : "ascending" : "none"}
                        title={role ? ROSTER_HEAD_LABEL[role] : column.key}
                      >
                        <button type="button" onClick={() => toggleSort(column)}>
                          <span>{role ? ROSTER_HEAD_LABEL[role] : column.label || column.key}</span>
                          {role === "person" ? (
                            <small>quién respondió</small>
                          ) : role ? null : (
                            <small>{column.key}</small>
                          )}
                          {role ? (
                            <em className="pulso-processing-sheet-roster-tag">
                              {role === "person" ? "vínculo" : "identidad"}
                            </em>
                          ) : isColumnWithKindColor(column) && highlightCoding ? (
                            <em>{columnKindLabel(column)}</em>
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
                <tr className="pulso-processing-sheet-filter-row">
                  <th className="pulso-processing-sheet-rownum" />
                  {columns.map((column) => {
                    const displayKind = columnDisplayKind(column);
                    return (
                      <th
                        key={`filter-${column.key}`}
                        className={rosterHeadClass(columnClass(column, highlightCoding), rosterRole(column.key))}
                        data-kind={displayKind}
                      >
                        <ColumnFilterControl
                          column={column}
                          value={columnFilters[column.key]}
                          onChange={(next) => setColumnFilterValue(column.key, next)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {!payload || payload.rows.length === 0 ? (
                  <tr>
                    <td className="pulso-processing-sheet-empty-cell" colSpan={columns.length + 1}>
                      {loading ? "Cargando..." : "Sin filas"}
                    </td>
                  </tr>
                ) : (
                  payload.rows.map((row, rowIndex) => {
                    const mark = rowMarks[rowIndex];
                    const groupStart = isRoster && !!mark?.isGroupStart && rowIndex > 0;
                    return (
                      <tr
                        key={`${page}-${rowIndex}`}
                        className={groupStart ? "is-roster-group-start" : undefined}
                      >
                        <td className="pulso-processing-sheet-rownum">
                          {visibleStart + rowIndex}
                        </td>
                        {columns.map((column) => {
                          const value = row[column.key] ?? "";
                          const displayKind = columnDisplayKind(column);
                          const role = rosterRole(column.key);
                          const display = role === "person" ? formatPersonTag(value) : value;
                          return (
                            <td
                              key={column.key}
                              className={rosterCellClass(columnClass(column, highlightCoding), role)}
                              data-kind={displayKind}
                              title={value || undefined}
                            >
                              <span className="pulso-processing-sheet-cell-text">{display}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pulso-processing-sheet-footer">
            <span>
              {total > 0
                ? `${visibleStart.toLocaleString("es-PE")}-${visibleEnd.toLocaleString("es-PE")} de ${total.toLocaleString("es-PE")}`
                : "0 filas"}
              {payload ? ` · ${payload.n_columns.toLocaleString("es-PE")} columnas` : ""}
              {isWideSheet ? " · desplaza horizontalmente" : ""}
            </span>
            <div className="pulso-processing-sheet-pager">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                }}
                aria-label="Filas por página"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <button
                type="button"
                className="pulso-processing-sheet-icon-button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
                title="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <strong>{page} / {totalPages}</strong>
              <button
                type="button"
                className="pulso-processing-sheet-icon-button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
                title="Página siguiente"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Añade la clase de rol relacional (persona/servicio) a un `<th>` del roster. */
function rosterHeadClass(base: string, role: RosterRole | null) {
  if (!role) return base;
  return [base, "is-roster-col", `is-roster-${role}`].filter(Boolean).join(" ");
}

/** Añade la clase de rol relacional a una celda `<td>` del roster. */
function rosterCellClass(base: string, role: RosterRole | null) {
  return rosterHeadClass(base, role);
}

function columnClass(column: ProcessingSheetColumn, highlightCoding: boolean) {
  const colorized = isColumnWithKindColor(column);
  const kindClass = isOpenTextMultipleRecodColumn(column) ? "is-text-sm" : `is-${columnDisplayKind(column)}`;
  return [
    highlightCoding && !colorized ? "is-original" : "",
    highlightCoding && colorized ? "is-coded" : "",
    highlightCoding && colorized ? kindClass : "",
    highlightCoding && isSelectMultipleDummyColumn(column) ? "is-sm-dummy" : "",
  ].filter(Boolean).join(" ");
}

type ProcessingSheetVisualColumn = Pick<ProcessingSheetColumn, "key" | "type_kind"> &
  Partial<Pick<ProcessingSheetColumn, "dummy_parent" | "is_recoded" | "source_type_base" | "source_type_kind" | "type" | "type_base">>;

export function columnDisplayKind(column: ProcessingSheetVisualColumn): ProcessingSheetColumn["type_kind"] {
  if (column.type_kind !== "other") return column.type_kind;
  if (isSelectMultipleDummyColumn(column)) return "sm";
  return column.type_kind;
}

export function columnKindLabel(column: ProcessingSheetVisualColumn) {
  if (isOpenTextMultipleRecodColumn(column)) return TEXT_TO_MULTIPLE_LABEL;
  return KIND_LABELS[columnDisplayKind(column)];
}

export function isSelectMultipleDummyColumn(
  column: Pick<ProcessingSheetColumn, "key"> & Partial<Pick<ProcessingSheetColumn, "dummy_parent">>,
) {
  if (typeof column.dummy_parent === "string" && column.dummy_parent.trim()) return true;
  return /(?:^|[/._-])recod[._-][^/._-]+$/i.test(column.key) || /\/[^/]+_recod$/i.test(column.key);
}

export function isOpenTextMultipleRecodColumn(column: ProcessingSheetVisualColumn) {
  if (columnDisplayKind(column) !== "sm" || !isRecodedColumn(column)) return false;
  const sourceKind = column.source_type_kind || typeBaseKind(column.source_type_base || "");
  const rawKind = typeBaseKind(column.type || "");
  const baseKind = normalizeTypeBase(column.type_base || "");
  return sourceKind === "text" || (rawKind === "text" && baseKind === "dummy_select_multiple");
}

function isColumnWithKindColor(column: ProcessingSheetVisualColumn) {
  return isRecodedColumn(column) || isSelectMultipleDummyColumn(column);
}

function typeBaseKind(value: string) {
  const base = normalizeTypeBase(value);
  if (base === "text" || base === "string") return "text";
  if (base === "select_multiple" || base === "dummy_select_multiple") return "sm";
  if (base === "select_one") return "so";
  if (base === "integer" || base === "decimal") return "integer";
  return "";
}

function normalizeTypeBase(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+.*$/, "");
}

export function isRecodedColumn(column: Pick<ProcessingSheetColumn, "key"> & Partial<Pick<ProcessingSheetColumn, "is_recoded">>) {
  if (typeof column.is_recoded === "boolean") return column.is_recoded;
  return /(?:^|[/._-])recod(?:$|[/._-])/i.test(column.key);
}

function rawParentForRecodedColumn(column: Pick<ProcessingSheetColumn, "key"> & Partial<Pick<ProcessingSheetColumn, "raw_parent">>) {
  if (typeof column.raw_parent === "string" && column.raw_parent.trim()) return column.raw_parent.trim();
  if (!isRecodedColumn(column)) return null;
  const raw = column.key.replace(/[/._-]recod(?:$|[/._-].*)/i, "").trim();
  return raw && raw !== column.key ? raw : null;
}

export function orderColumnsForCoding(columns: ProcessingSheetColumn[], highlightCoding: boolean) {
  if (!highlightCoding || columns.length <= 1) return columns;

  const byKey = new Map(columns.map((column) => [column.key, column]));
  const recodedByParent = new Map<string, ProcessingSheetColumn[]>();

  for (const column of columns) {
    if (!isRecodedColumn(column)) continue;
    const parent = rawParentForRecodedColumn(column);
    if (!parent || !byKey.has(parent)) continue;
    const group = recodedByParent.get(parent) ?? [];
    group.push(column);
    recodedByParent.set(parent, group);
  }

  if (recodedByParent.size === 0) return columns;

  const placed = new Set<string>();
  const ordered: ProcessingSheetColumn[] = [];

  for (const column of columns) {
    if (placed.has(column.key)) continue;
    const parent = rawParentForRecodedColumn(column);
    if (parent && byKey.has(parent)) continue;

    ordered.push(column);
    placed.add(column.key);

    for (const recoded of recodedByParent.get(column.key) ?? []) {
      if (placed.has(recoded.key)) continue;
      ordered.push(recoded);
      placed.add(recoded.key);
    }
  }

  for (const column of columns) {
    if (placed.has(column.key)) continue;
    ordered.push(column);
  }

  return ordered;
}
