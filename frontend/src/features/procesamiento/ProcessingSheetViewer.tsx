import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Database, RefreshCw, RotateCcw, Search } from "lucide-react";
import type {
  ProcessingSheetColumn,
  ProcessingSheetMode,
  ProcessingSheetPayload,
  ProcessingSheetRequest,
} from "../../api/client";
import { ErrorBlock, LoadingBlock } from "../../components/States";
import "./processingSheetViewer.css";

type Props = {
  title: string;
  sourceLabel: string;
  enabled?: boolean;
  disabledMessage?: string;
  highlightCoding?: boolean;
  request?: ProcessingSheetRequest;
  load: (opts: ProcessingSheetRequest) => Promise<ProcessingSheetPayload>;
};

type SortState = { col: string; desc: boolean } | null;

const PAGE_SIZES = [25, 50, 100, 200] as const;

const KIND_LABELS: Record<ProcessingSheetColumn["type_kind"], string> = {
  integer: "Entera",
  sm: "Múltiple",
  so: "Única",
  text: "Texto",
  other: "Otro",
};

export function ProcessingSheetViewer({
  title,
  sourceLabel,
  enabled = true,
  disabledMessage = "Base no disponible.",
  highlightCoding = false,
  request,
  load,
}: Props) {
  const [mode, setMode] = useState<ProcessingSheetMode>("codigos");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
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

  const columns = payload?.columns ?? [];
  const total = payload?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleStart = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = payload ? Math.min(total, visibleStart + payload.rows.length - 1) : 0;
  const activeFilters = useMemo(
    () => Object.values(columnFilters).some((value) => value.trim().length > 0) || search.trim().length > 0,
    [columnFilters, search],
  );
  const hasCodingLegend = highlightCoding && columns.some((column) => isRecodedColumn(column));
  const isWideSheet = (payload?.n_columns ?? columns.length) > 8;

  function resetFilters() {
    setSearchDraft("");
    setSearch("");
    setColumnFilters({});
    setSort(null);
    setPage(1);
  }

  function setColumnFilter(key: string, value: string) {
    setPage(1);
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value;
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
    <section className={`pulso-processing-sheet${isWideSheet ? " is-wide" : ""}`} aria-label={title}>
      <div className="pulso-processing-sheet-toolbar">
        <div className="pulso-processing-sheet-title">
          <span className="pulso-processing-sheet-icon" aria-hidden="true">
            <Database size={16} />
          </span>
          <div>
            <strong>{title}</strong>
            <span className="pulso-processing-sheet-source">{sourceLabel}</span>
            {payload && (
              <span className="pulso-processing-sheet-meta">
                {total.toLocaleString("es-PE")} filas · {payload.n_columns.toLocaleString("es-PE")} columnas
              </span>
            )}
          </div>
        </div>

        <div className="pulso-processing-sheet-actions">
          <div className="pulso-processing-sheet-mode" role="tablist" aria-label="Modo de valores">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "codigos"}
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
              role="tab"
              aria-selected={mode === "etiquetas"}
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

      {hasCodingLegend && (
        <div className="pulso-processing-sheet-legend" aria-label="Lectura de columnas recodificadas">
          <span className="is-original">
            <i aria-hidden="true" />
            Originales en gris
          </span>
          <em>Recodificadas por tipo</em>
          {(["integer", "sm", "so", "text"] as const).map((kind) => (
            <span key={kind} className={`is-${kind}`}>
              <i aria-hidden="true" />
              {KIND_LABELS[kind]}
            </span>
          ))}
        </div>
      )}

      {error ? (
        <ErrorBlock label="No se pudo cargar la base" detail={error} />
      ) : !payload && loading ? (
        <div className="pulso-processing-sheet-loading">
          <LoadingBlock label={`Cargando ${title.toLowerCase()}...`} />
          <small>
            {loadingSlow
              ? "El proyecto tiene muchas columnas. Seguimos preparando la vista previa sin cambiar la base."
              : "Preparando las primeras filas, filtros y nombres de columnas."}
          </small>
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
                    return (
                      <th
                        key={column.key}
                        className={columnClass(column, highlightCoding)}
                        data-kind={column.type_kind}
                        aria-sort={sorted ? sort?.desc ? "descending" : "ascending" : "none"}
                        title={column.key}
                      >
                        <button type="button" onClick={() => toggleSort(column)}>
                          <span>{column.label || column.key}</span>
                          <small>{column.key}</small>
                          {isRecodedColumn(column) && highlightCoding ? (
                            <em>{KIND_LABELS[column.type_kind]}</em>
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
                <tr className="pulso-processing-sheet-filter-row">
                  <th className="pulso-processing-sheet-rownum" />
                  {columns.map((column) => (
                    <th key={`filter-${column.key}`} className={columnClass(column, highlightCoding)} data-kind={column.type_kind}>
                      <input
                        type="text"
                        value={columnFilters[column.key] ?? ""}
                        onChange={(event) => setColumnFilter(column.key, event.target.value)}
                        aria-label={`Filtrar ${column.label || column.key}`}
                      />
                    </th>
                  ))}
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
                  payload.rows.map((row, rowIndex) => (
                    <tr key={`${page}-${rowIndex}`}>
                      <td className="pulso-processing-sheet-rownum">
                        {visibleStart + rowIndex}
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className={columnClass(column, highlightCoding)} data-kind={column.type_kind}>
                          {row[column.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))
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

function columnClass(column: ProcessingSheetColumn, highlightCoding: boolean) {
  const recoded = isRecodedColumn(column);
  return [
    highlightCoding && !recoded ? "is-original" : "",
    highlightCoding && recoded ? "is-coded" : "",
    highlightCoding && recoded ? `is-${column.type_kind}` : "",
  ].filter(Boolean).join(" ");
}

export function isRecodedColumn(column: Pick<ProcessingSheetColumn, "key">) {
  return /(?:^|[/._-])recod(?:$|[/._-])/i.test(column.key);
}
