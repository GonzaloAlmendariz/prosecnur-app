// =============================================================================
// inspector/logic/VariablePicker.tsx — combobox de variable referenciable
// =============================================================================
// Picker visual para elegir una variable como left-operand (o como rhs ref)
// de una condición. Cabe en una sola línea — usa popover con búsqueda igual
// al `TypePicker` del Inspector.
//
// Reglas:
//   - La variable seleccionada se muestra con icono del tipo + nombre
//     técnico + label (acortado).
//   - El popover lista las variables del scope filtradas por query.
//   - Si la variable referenciada existe en el scope → muestra su tipo
//     visual. Si no existe (ej. importada de un xlsx con refs huérfanas)
//     → estado warn con tooltip "no encontrada".
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, AlertTriangle } from "lucide-react";
import { iconForType } from "../../helpers/icons";
import { paletteForType, paletteSoftForType } from "../../helpers/paletteForType";
import { typeLabel } from "../../parsing/parseType";
import type { LogicVariable } from "../../logic";

export type VariablePickerProps = {
  /** Variables disponibles para elegir. */
  variables: LogicVariable[];
  /** Nombre de la variable actualmente seleccionada (puede no existir
   *  en `variables` si fue importada y la pregunta se borró). */
  selected: string;
  onChange: (next: string) => void;
  /** Texto del placeholder cuando no hay selección. */
  placeholder?: string;
  /** Si true, deshabilita la apertura del popover (modo read-only). */
  disabled?: boolean;
};

export function VariablePicker({
  variables,
  selected,
  onChange,
  placeholder = "Elige una pregunta",
  disabled,
}: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedVar = useMemo(
    () => variables.find((v) => v.name === selected) ?? null,
    [variables, selected],
  );
  const isOrphan = !!selected && !selectedVar;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return variables;
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(normalizedQuery) ||
        v.label.toLowerCase().includes(normalizedQuery),
    );
  }, [variables, normalizedQuery]);

  const accent = selectedVar
    ? paletteForType(selectedVar.baseType)
    : "var(--pulso-text-soft)";
  const accentSoft = selectedVar
    ? paletteSoftForType(selectedVar.baseType)
    : "var(--pulso-surface-2)";
  const Icon = selectedVar ? iconForType(selectedVar.baseType) : null;

  return (
    <div
      ref={containerRef}
      className="pulso-logic-varpicker"
      style={{ position: "relative" }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`pulso-logic-varpicker-trigger ${
          isOrphan ? "is-orphan" : selectedVar ? "is-selected" : "is-empty"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isOrphan ? (
          <span className="pulso-logic-varpicker-icon" style={{ color: "var(--pulso-warn-fg)" }}>
            <AlertTriangle size={13} />
          </span>
        ) : Icon ? (
          <span
            className="pulso-logic-varpicker-icon"
            style={{ color: accent, background: accentSoft }}
          >
            <Icon size={13} />
          </span>
        ) : null}
        <span className="pulso-logic-varpicker-text">
          {selected ? (
            <>
              <code>${selected}</code>
              {selectedVar?.label ? (
                <em>{selectedVar.label}</em>
              ) : isOrphan ? (
                <em>· no existe en este formulario</em>
              ) : null}
            </>
          ) : (
            <span style={{ color: "var(--pulso-text-soft)" }}>{placeholder}</span>
          )}
        </span>
        <ChevronDown size={12} style={{ color: "var(--pulso-text-soft)", flexShrink: 0 }} />
      </button>

      {open && (
        <div className="pulso-logic-varpicker-pop" role="listbox">
          <div className="pulso-logic-varpicker-search">
            <Search size={13} style={{ color: "var(--pulso-text-soft)" }} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pregunta…"
              spellCheck={false}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="pulso-logic-varpicker-empty">
              Ninguna pregunta coincide con <em>{query}</em>.
            </div>
          ) : (
            <ul className="pulso-logic-varpicker-list">
              {filtered.map((variable) => {
                const VIcon = iconForType(variable.baseType);
                const vAccent = paletteForType(variable.baseType);
                const vAccentSoft = paletteSoftForType(variable.baseType);
                const isCurrent = variable.name === selected;
                return (
                  <li key={variable.name}>
                    <button
                      type="button"
                      className={`pulso-logic-varpicker-item ${
                        isCurrent ? "is-active" : ""
                      }`}
                      onClick={() => {
                        onChange(variable.name);
                        setOpen(false);
                        setQuery("");
                      }}
                      role="option"
                      aria-selected={isCurrent}
                    >
                      <span
                        className="pulso-logic-varpicker-icon"
                        style={{ color: vAccent, background: vAccentSoft }}
                      >
                        <VIcon size={13} />
                      </span>
                      <span className="pulso-logic-varpicker-itemtext">
                        <code>${variable.name}</code>
                        <em>
                          {typeLabel(variable.baseType)}
                          {variable.label ? ` · ${variable.label}` : ""}
                        </em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
