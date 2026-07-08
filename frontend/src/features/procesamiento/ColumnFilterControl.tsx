import { useEffect, useMemo, useState } from "react";
import { Check, Filter, Search, X } from "lucide-react";
import type { ProcessingSheetColumn, ProcessingSheetColumnFilter } from "../../api/client";
import { Popover } from "../../components/Popover";

/** ¿El filtro tiene algún criterio activo? */
export function columnFilterActive(f: ProcessingSheetColumnFilter | undefined): boolean {
  if (f == null) return false;
  if (typeof f === "string") return f.trim().length > 0;
  if (f.op === "in") return (f.values?.length ?? 0) > 0;
  if (f.op === "range") return f.min != null || f.max != null;
  if (f.op === "contains") return (f.value ?? "").trim().length > 0;
  return false;
}

/** Etiqueta corta del filtro para los chips de filtros activos. */
export function describeColumnFilter(
  column: ProcessingSheetColumn,
  f: ProcessingSheetColumnFilter | undefined,
): string {
  const name = column.label || column.key;
  if (f == null) return name;
  if (typeof f === "string") return `${name}: “${f}”`;
  if (f.op === "in") {
    const labels = (f.values ?? []).map((code) => {
      const cat = column.categories?.find((c) => c.code === code);
      return cat?.label ?? code;
    });
    if (labels.length <= 2) return `${name}: ${labels.join(", ")}`;
    return `${name}: ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }
  if (f.op === "range") {
    const lo = f.min != null ? f.min : "";
    const hi = f.max != null ? f.max : "";
    if (lo !== "" && hi !== "") return `${name}: ${lo}–${hi}`;
    if (lo !== "") return `${name}: ≥ ${lo}`;
    return `${name}: ≤ ${hi}`;
  }
  if (f.op === "contains") return `${name}: “${f.value}”`;
  return name;
}

function FilterHead({ column, kind }: { column: ProcessingSheetColumn; kind: string }) {
  return (
    <div className="pulso-sheet-filter-head">
      <span className="pulso-sheet-filter-head-name" title={column.label || column.key}>
        {column.label || column.key}
      </span>
      <span className="pulso-sheet-filter-head-kind">{kind}</span>
    </div>
  );
}

function useDebouncedCommit(commit: () => void, deps: unknown[], delay = 260) {
  useEffect(() => {
    const handle = window.setTimeout(commit, delay);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function CategoryPanel({
  column,
  value,
  onChange,
}: {
  column: ProcessingSheetColumn;
  value: ProcessingSheetColumnFilter | undefined;
  onChange: (next: ProcessingSheetColumnFilter | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value && typeof value !== "string" && value.op === "in" ? value.values : []);
  const cats = column.categories ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter((c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [cats, query]);

  function commit(next: Set<string>) {
    const values = Array.from(next);
    onChange(values.length ? { op: "in", values } : undefined);
  }
  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    commit(next);
  }

  return (
    <div className="pulso-sheet-filter-panel">
      <FilterHead column={column} kind="categorías" />
      {cats.length > 8 ? (
        <label className="pulso-sheet-filter-search">
          <Search size={12} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoría"
            autoFocus
          />
        </label>
      ) : null}
      <div className="pulso-sheet-filter-options" role="group" aria-label={`Categorías de ${column.label || column.key}`}>
        {filtered.length === 0 ? (
          <p className="pulso-sheet-filter-empty">Sin coincidencias</p>
        ) : (
          filtered.map((cat) => {
            const on = selected.has(cat.code);
            return (
              <button
                type="button"
                key={cat.code}
                className={`pulso-sheet-filter-option${on ? " is-on" : ""}`}
                onClick={() => toggle(cat.code)}
                aria-pressed={on}
              >
                <span className="pulso-sheet-filter-check" aria-hidden="true">{on ? <Check size={12} /> : null}</span>
                <span className="pulso-sheet-filter-option-label" title={cat.label}>{cat.label}</span>
                <span className="pulso-sheet-filter-count">{cat.count.toLocaleString("es-PE")}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="pulso-sheet-filter-footer">
        <span>{selected.size ? `${selected.size} de ${cats.length}` : `${cats.length} categorías`}</span>
        {selected.size ? (
          <button type="button" onClick={() => onChange(undefined)}>Limpiar</button>
        ) : null}
      </div>
    </div>
  );
}

function RangePanel({
  column,
  value,
  onChange,
}: {
  column: ProcessingSheetColumn;
  value: ProcessingSheetColumnFilter | undefined;
  onChange: (next: ProcessingSheetColumnFilter | undefined) => void;
}) {
  const current = value && typeof value !== "string" && value.op === "range" ? value : null;
  const [min, setMin] = useState(current?.min != null ? String(current.min) : "");
  const [max, setMax] = useState(current?.max != null ? String(current.max) : "");

  useDebouncedCommit(() => {
    const mn = min.trim() === "" ? null : Number(min);
    const mx = max.trim() === "" ? null : Number(max);
    const mnOk = mn != null && !Number.isNaN(mn);
    const mxOk = mx != null && !Number.isNaN(mx);
    if (!mnOk && !mxOk) onChange(undefined);
    else onChange({ op: "range", min: mnOk ? mn : null, max: mxOk ? mx : null });
  }, [min, max]);

  return (
    <div className="pulso-sheet-filter-panel">
      <FilterHead column={column} kind="rango numérico" />
      <div className="pulso-sheet-filter-range">
        <label>
          <span>Mín</span>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder={column.value_min != null ? String(column.value_min) : ""} />
        </label>
        <label>
          <span>Máx</span>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder={column.value_max != null ? String(column.value_max) : ""} />
        </label>
      </div>
      {column.value_min != null && column.value_max != null ? (
        <p className="pulso-sheet-filter-hint">Rango en la base: {column.value_min.toLocaleString("es-PE")}–{column.value_max.toLocaleString("es-PE")}</p>
      ) : null}
      <div className="pulso-sheet-filter-footer">
        <span />
        {min || max ? (
          <button type="button" onClick={() => { setMin(""); setMax(""); onChange(undefined); }}>Limpiar</button>
        ) : null}
      </div>
    </div>
  );
}

function TextPanel({
  column,
  value,
  onChange,
}: {
  column: ProcessingSheetColumn;
  value: ProcessingSheetColumnFilter | undefined;
  onChange: (next: ProcessingSheetColumnFilter | undefined) => void;
}) {
  const initial =
    typeof value === "string" ? value : value && value.op === "contains" ? value.value : "";
  const [text, setText] = useState(initial);
  useDebouncedCommit(() => {
    onChange(text.trim() ? { op: "contains", value: text } : undefined);
  }, [text]);
  return (
    <div className="pulso-sheet-filter-panel">
      <FilterHead column={column} kind="texto" />
      <label className="pulso-sheet-filter-search">
        <Search size={12} aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Contiene… (${column.label || column.key})`}
          autoFocus
        />
      </label>
      <div className="pulso-sheet-filter-footer">
        <span />
        {text ? <button type="button" onClick={() => { setText(""); onChange(undefined); }}>Limpiar</button> : null}
      </div>
    </div>
  );
}

export function ColumnFilterControl({
  column,
  value,
  onChange,
}: {
  column: ProcessingSheetColumn;
  value: ProcessingSheetColumnFilter | undefined;
  onChange: (next: ProcessingSheetColumnFilter | undefined) => void;
}) {
  const active = columnFilterActive(value);
  const hasCategories = (column.categories?.length ?? 0) > 0;
  const isNumeric = column.type_kind === "integer" && (column.value_min != null || column.value_max != null);
  const kindHint = hasCategories ? "categorías" : isNumeric ? "rango" : "texto";

  return (
    <Popover
      side="bottom"
      align="start"
      maxWidth={280}
      ariaLabel={`Filtrar ${column.label || column.key} por ${kindHint}`}
      className="pulso-sheet-filter-pop"
      trigger={
        <button
          type="button"
          className={`pulso-sheet-filter-trigger${active ? " is-active" : ""}`}
          aria-label={`Filtrar ${column.label || column.key}`}
          title={`Filtrar por ${kindHint}`}
        >
          <Filter size={12} />
          {active ? <span className="pulso-sheet-filter-dot" aria-hidden="true" /> : null}
        </button>
      }
    >
      {hasCategories ? (
        <CategoryPanel column={column} value={value} onChange={onChange} />
      ) : isNumeric ? (
        <RangePanel column={column} value={value} onChange={onChange} />
      ) : (
        <TextPanel column={column} value={value} onChange={onChange} />
      )}
    </Popover>
  );
}
