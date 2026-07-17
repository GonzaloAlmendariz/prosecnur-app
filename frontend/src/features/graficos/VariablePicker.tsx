import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Database, Search, X } from "lucide-react";
import { useVariables, parseVarRef, formatVarRef } from "./useVariables";
import { safeText } from "./safeText";
import { getDerivedReportVariable } from "./derivedReportVariables";

type Props = {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  filter?: (tipo: string) => boolean;
  allowEmpty?: boolean;
};

// VariablePicker multi-base (v0.2+).
//
// Si el estudio tiene 1 sola base (`multi=false`), el UI es el mismo de
// siempre: un dropdown con todas las variables y un input de búsqueda.
// El `value` se guarda sin prefijo ("sexo", "p5").
//
// Si hay >1 base (`multi=true`), aparece un dropdown adicional "Fuente"
// arriba. El `value` se guarda con prefijo ("docentes$sexo"). Al cambiar
// la fuente, el dropdown de variables se re-filtra.
//
// Si el value ya viene prefijado (de un plan guardado en una sesión
// anterior), se respeta la fuente — incluso en single-base (se asume que
// el analista lo guardó conscientemente así).

export default function VariablePicker({
  value, onChange, placeholder = "Selecciona variable…", filter, allowEmpty = false,
}: Props) {
  const { sources, multi, loading, error } = useVariables();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const [popoverSide, setPopoverSide] = useState<"top" | "bottom">("bottom");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Parsear el value actual a (source, name).
  const parsed = useMemo(() => parseVarRef(value), [value]);
  const derivedVariable = useMemo(() => getDerivedReportVariable(value), [value]);
  const sourceKey = sources.map((source) => source.name).join("\u001F");
  const firstSourceName = sources[0]?.name ?? null;
  const valueSource = parsed.source && sources.some((source) => source.name === parsed.source)
    ? parsed.source
    : null;

  // Fuente visible en el popover: arranca desde la variable guardada, pero
  // puede cambiarse libremente antes de confirmar otra variable.
  const pickerSource = draftSource && sources.some((source) => source.name === draftSource)
    ? draftSource
    : (valueSource ?? firstSourceName);

  useEffect(() => {
    const names = new Set(sourceKey.split("\u001F").filter(Boolean));
    if (parsed.source && names.has(parsed.source)) {
      setDraftSource(parsed.source);
      return;
    }
    setDraftSource((current) => current && names.has(current) ? current : firstSourceName);
  }, [firstSourceName, parsed.source, sourceKey]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  if (loading) return <span className="pulso-gv2-variable-status">Cargando variables...</span>;
  if (error) {
    const isSessionLost = error.includes("E_NO_SESSION");
    return (
      <span className="pulso-gv2-variable-status is-error">
        {isSessionLost ? "Sesión no disponible" : error}
      </span>
    );
  }

  if (derivedVariable) {
    return (
      <div className="pulso-gv2-variable-picker is-derived">
        <div
          className="pulso-gv2-variable-trigger has-value is-derived"
          aria-label={`${derivedVariable.label}, variable derivada del informe`}
        >
          <span className="pulso-gv2-variable-trigger-icon" aria-hidden="true">
            <Database size={14} />
          </span>
          <span className="pulso-gv2-variable-trigger-copy">
            <strong>{derivedVariable.label}</strong>
            <small>{derivedVariable.name}</small>
          </span>
          <span className="pulso-gv2-variable-trigger-source">Derivada del informe</span>
        </div>
        <span className="pulso-gv2-variable-derived-note">{derivedVariable.origin}</span>
      </div>
    );
  }

  // Variables de la fuente activa (con filtro de tipo + búsqueda).
  const source = sources.find((s) => s.name === pickerSource) ?? sources[0];
  const allVars = source?.variables ?? [];
  let eligible = allVars;
  if (filter) eligible = eligible.filter((v) => filter(v.tipo));
  let filtered = eligible;
  const q = query.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((v) =>
      safeText(v.name).toLowerCase().includes(q) ||
      safeText(v.label).toLowerCase().includes(q) ||
      safeText(v.seccion).toLowerCase().includes(q) ||
      safeText(v.list_name).toLowerCase().includes(q),
    );
  }
  const visibleVars = filtered.slice(0, 120);
  const selectedSourceName = valueSource ?? pickerSource;
  const selectedSource = sources.find((s) => s.name === selectedSourceName) ?? source;
  const selectedVar = selectedSource?.variables.find((v) => safeText(v.name) === parsed.name) ?? null;
  const selectedLabel = selectedVar ? safeText(selectedVar.label, selectedVar.name) : "";
  const selectedCode = selectedVar ? safeText(selectedVar.name) : "";
  const selectedSourceLabel = selectedVar ? (selectedSource?.name ?? "") : (pickerSource ?? "");

  function handleSourceChange(newSource: string) {
    if (!sources.some((s) => s.name === newSource)) return;
    setDraftSource(newSource);
  }

  function commitVariable(newName: string) {
    if (!newName) {
      onChange(allowEmpty ? null : "");
      setOpen(false);
      return;
    }
    onChange(formatVarRef(pickerSource, newName, multi));
    setOpen(false);
    setQuery("");
  }

  function clearVariable(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onChange(allowEmpty ? null : "");
    setQuery("");
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const nextSide = spaceBelow < 420 && spaceAbove > spaceBelow ? "top" : "bottom";
      const available = nextSide === "top" ? spaceAbove : spaceBelow;
      const width = Math.min(620, window.innerWidth - 28);
      const left = Math.max(14, Math.min(rect.left, window.innerWidth - width - 14));
      setPopoverSide(nextSide);
      const maxHeight = Math.max(280, Math.min(580, available - 16));
      setPopoverStyle({
        left,
        width,
        maxHeight,
        ...(nextSide === "top"
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    }
    setOpen(true);
  }

  return (
    <div className="pulso-gv2-variable-picker" ref={rootRef}>
      <button
        type="button"
        className={`pulso-gv2-variable-trigger ${selectedVar ? "has-value" : ""}`}
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="pulso-gv2-variable-trigger-icon" aria-hidden="true">
          <Database size={14} />
        </span>
        <span className="pulso-gv2-variable-trigger-copy">
          <strong>{selectedVar ? selectedLabel : placeholder}</strong>
          <small>
            {selectedVar
              ? selectedCode
              : `${eligible.length} variable${eligible.length === 1 ? "" : "s"} disponible${eligible.length === 1 ? "" : "s"}`}
          </small>
        </span>
        {selectedVar && selectedSourceLabel && (
          <span className="pulso-gv2-variable-trigger-source">{selectedSourceLabel}</span>
        )}
        <ChevronDown size={14} className="pulso-gv2-variable-trigger-chevron" />
      </button>

      {allowEmpty && selectedVar && (
        <button
          type="button"
          className="pulso-gv2-variable-clear"
          onClick={clearVariable}
          aria-label="Quitar variable"
          title="Quitar variable"
        >
          <X size={13} />
        </button>
      )}

      {open && typeof document !== "undefined" && createPortal((
        <div
          ref={popoverRef}
          className="pulso-gv2-variable-popover"
          data-side={popoverSide}
          style={popoverStyle}
          role="dialog"
          aria-label="Seleccionar variable"
        >
          <div className="pulso-gv2-variable-popover-head">
            <span aria-hidden="true"><Database size={15} /></span>
            <div>
              <strong>Elegir variable</strong>
              <small>{source?.name ?? "Base activa"} · {eligible.length} disponibles</small>
            </div>
          </div>

          {multi && (
            <div className="pulso-gv2-variable-sources" aria-label="Bases disponibles">
              {sources.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className={s.name === pickerSource ? "is-active" : ""}
                  onClick={() => handleSourceChange(s.name)}
                >
                  <span>{s.name}</span>
                  <b>{s.variables.length}</b>
                </button>
              ))}
            </div>
          )}

          <div className="pulso-gv2-variable-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, pregunta, sección o lista..."
              aria-label="Buscar variable"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="pulso-gv2-variable-list" role="listbox" aria-label="Variables disponibles">
            {allowEmpty && (
              <button
                type="button"
                className={`pulso-gv2-variable-option is-empty ${!parsed.name ? "is-selected" : ""}`}
                onClick={() => commitVariable("")}
                role="option"
                aria-selected={!parsed.name}
              >
                <span className="pulso-gv2-variable-option-check">{!parsed.name && <Check size={13} />}</span>
                <span className="pulso-gv2-variable-option-main">
                  <strong>Sin variable</strong>
                  <small>Dejar este campo sin asignar.</small>
                </span>
              </button>
            )}

            {visibleVars.map((v) => {
              const name = safeText(v.name);
              const label = safeText(v.label, name);
              const selected = name === parsed.name && (!valueSource || pickerSource === valueSource);
              return (
                <button
                  key={name}
                  type="button"
                  className={`pulso-gv2-variable-option ${selected ? "is-selected" : ""}`}
                  onClick={() => commitVariable(name)}
                  role="option"
                  aria-selected={selected}
                  title={label}
                >
                  <span className="pulso-gv2-variable-option-check">
                    {selected && <Check size={13} />}
                  </span>
                  <span className="pulso-gv2-variable-option-main">
                    <span className="pulso-gv2-variable-option-title">
                      <strong>{label}</strong>
                      <code>{name}</code>
                    </span>
                    <span className="pulso-gv2-variable-option-meta">
                      {multi && source?.name && <em>{source.name}</em>}
                      {v.seccion && <em>{v.seccion}</em>}
                      {v.tipo && <em>{friendlyVarType(v.tipo)}</em>}
                      {typeof v.n_non_empty === "number" && <em>{v.n_non_empty} respuestas</em>}
                      {v.is_recoded && <em>recodificada</em>}
                      {v.data_available === false && <em className="is-muted">sin datos</em>}
                    </span>
                  </span>
                </button>
              );
            })}

            {visibleVars.length === 0 && (
              <div className="pulso-gv2-variable-empty">
                No hay variables que coincidan con la búsqueda actual.
              </div>
            )}

            {filtered.length > visibleVars.length && (
              <div className="pulso-gv2-variable-more">
                Mostrando {visibleVars.length} de {filtered.length}. Afina la búsqueda para ver resultados más precisos.
              </div>
            )}
          </div>
        </div>
      ), document.body)}

      {allVars.length === 0 && (
        <span className="pulso-gv2-variable-status">
          Sin variables. Prepara datos en Analítica antes de configurar el gráfico.
        </span>
      )}
    </div>
  );
}

function friendlyVarType(tipo: string) {
  const normalized = safeText(tipo).toLowerCase();
  if (!normalized) return "tipo no definido";
  if (normalized.includes("select_one")) return "selección única";
  if (normalized.includes("select_multiple")) return "selección múltiple";
  if (normalized.includes("integer")) return "entero";
  if (normalized.includes("decimal")) return "decimal";
  if (normalized.includes("text")) return "texto";
  if (normalized.includes("date")) return "fecha";
  return normalized.replaceAll("_", " ");
}
