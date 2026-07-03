import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Database, Plus, Search, X } from "lucide-react";
import { useVariables, parseVarRef, formatVarRef, type VarWithSource } from "./useVariables";
import { safeText } from "./safeText";

type Props = {
  value: string[] | null | undefined;
  onChange: (v: string[]) => void;
};

type SelectedVar = {
  ref: string;
  name: string;
  label: string;
  source: string;
};

export default function VarsListPicker({ value, onChange }: Props) {
  const { variables, multi, loading } = useVariables();
  const vals = Array.isArray(value) ? value.filter(Boolean) : [];
  const selected = useMemo(() => new Set(vals), [vals]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverSide, setPopoverSide] = useState<"top" | "bottom">("bottom");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return variables
      .map((variable) => toOption(variable, multi))
      .filter((variable) => {
        if (!q) return true;
        return (
          variable.ref.toLowerCase().includes(q) ||
          variable.name.toLowerCase().includes(q) ||
          variable.label.toLowerCase().includes(q) ||
          safeText(variable.source).toLowerCase().includes(q) ||
          safeText(variable.seccion).toLowerCase().includes(q) ||
          safeText(variable.list_name).toLowerCase().includes(q)
        );
      });
  }, [multi, query, variables]);

  const visibleOptions = options.slice(0, 160);
  const selectedVars = vals.map((ref) => selectedInfo(ref, variables, multi));

  if (loading) return <span className="pulso-gv2-variable-status">Cargando variables...</span>;

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const nextSide = spaceBelow < 430 && spaceAbove > spaceBelow ? "top" : "bottom";
      const available = nextSide === "top" ? spaceAbove : spaceBelow;
      const width = Math.min(660, window.innerWidth - 28);
      const left = Math.max(14, Math.min(rect.left, window.innerWidth - width - 14));
      setPopoverSide(nextSide);
      setPopoverStyle({
        left,
        width,
        maxHeight: Math.max(300, Math.min(620, available - 16)),
        ...(nextSide === "top"
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    }
    setOpen(true);
  }

  function toggleRef(ref: string) {
    if (!ref) return;
    if (selected.has(ref)) {
      onChange(vals.filter((item) => item !== ref));
      return;
    }
    onChange([...vals, ref]);
    setQuery("");
  }

  function removeRef(ref: string) {
    onChange(vals.filter((item) => item !== ref));
  }

  return (
    <div className="pulso-gv2-vars-picker" ref={rootRef}>
      <div className="pulso-gv2-vars-chips" aria-label="Variables seleccionadas">
        {selectedVars.length === 0 ? (
          <span className="pulso-gv2-vars-empty">Ninguna variable seleccionada</span>
        ) : (
          selectedVars.map((variable) => (
            <button
              key={variable.ref}
              type="button"
              className="pulso-gv2-vars-chip"
              onClick={() => removeRef(variable.ref)}
              title={`Quitar ${variable.label}`}
              aria-label={`Quitar ${variable.label}`}
            >
              <span>{variable.label}</span>
              <code>{multi ? `${variable.source} / ${variable.name}` : variable.name}</code>
              <X size={11} />
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        className="pulso-gv2-vars-trigger"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="pulso-gv2-vars-trigger-icon" aria-hidden="true">
          <Plus size={14} />
        </span>
        <span>
          <strong>Agregar variable</strong>
          <small>{variables.length} disponibles</small>
        </span>
      </button>

      {open && typeof document !== "undefined" && createPortal((
        <div
          ref={popoverRef}
          className="pulso-gv2-vars-popover"
          data-side={popoverSide}
          style={popoverStyle}
          role="dialog"
          aria-label="Agregar variables"
        >
          <div className="pulso-gv2-vars-popover-head">
            <span aria-hidden="true"><Database size={15} /></span>
            <div>
              <strong>Agregar variables</strong>
              <small>{vals.length} seleccionadas · {variables.length} disponibles</small>
            </div>
          </div>

          <div className="pulso-gv2-variable-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, pregunta, sección o lista..."
              aria-label="Buscar variable para agregar"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="pulso-gv2-vars-list" role="listbox" aria-label="Variables disponibles">
            {visibleOptions.map((variable) => {
              const isSelected = selected.has(variable.ref);
              return (
                <button
                  key={variable.ref}
                  type="button"
                  className={`pulso-gv2-vars-option ${isSelected ? "is-selected" : ""}`}
                  onClick={() => toggleRef(variable.ref)}
                  role="option"
                  aria-selected={isSelected}
                  title={variable.label}
                >
                  <span className="pulso-gv2-vars-option-check">
                    {isSelected ? <Check size={13} /> : <Plus size={12} />}
                  </span>
                  <span className="pulso-gv2-vars-option-main">
                    <span className="pulso-gv2-vars-option-title">
                      <strong>{variable.label}</strong>
                      <code>{variable.name}</code>
                    </span>
                    <span className="pulso-gv2-vars-option-meta">
                      {multi && variable.source && <em>{variable.source}</em>}
                      {variable.seccion && <em>{variable.seccion}</em>}
                      {variable.tipo && <em>{friendlyVarType(variable.tipo)}</em>}
                      {typeof variable.n_non_empty === "number" && <em>{variable.n_non_empty} respuestas</em>}
                    </span>
                  </span>
                </button>
              );
            })}

            {visibleOptions.length === 0 && (
              <div className="pulso-gv2-variable-empty">
                No hay variables que coincidan con la búsqueda actual.
              </div>
            )}

            {options.length > visibleOptions.length && (
              <div className="pulso-gv2-variable-more">
                Mostrando {visibleOptions.length} de {options.length}. Afina la búsqueda para ver resultados más precisos.
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function toOption(variable: VarWithSource, multi: boolean) {
  const name = safeText(variable.name);
  const label = safeText(variable.label, name);
  const source = safeText(variable.source);
  return {
    ...variable,
    name,
    label,
    source,
    ref: formatVarRef(source, name, multi),
  };
}

function selectedInfo(ref: string, variables: VarWithSource[], multi: boolean): SelectedVar {
  const parsed = parseVarRef(ref);
  const hit = variables.find((variable) => {
    if (multi) return variable.source === parsed.source && variable.name === parsed.name;
    return variable.name === parsed.name;
  });
  if (!hit) {
    return {
      ref,
      name: parsed.name || ref,
      label: parsed.name || ref,
      source: parsed.source ?? "",
    };
  }
  const source = safeText(hit.source);
  const name = safeText(hit.name);
  return {
    ref: formatVarRef(source, name, multi),
    name,
    label: safeText(hit.label, name),
    source,
  };
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
