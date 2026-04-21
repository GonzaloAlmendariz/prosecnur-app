import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { VariableInstrumento } from "../../api/client";

// Dropdown interactivo para seleccionar UNA variable del instrumento.
// No es un input de texto con datalist: es un botón que abre un panel
// con búsqueda interna + lista filtrable. Cada opción muestra el
// `name` en monospace + la etiqueta humana + el tipo. Cerrable con
// click-fuera + tecla Escape.

type VariableSelectProps = {
  variables: VariableInstrumento[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  // Filtra la lista antes de mostrarla (p.ej. solo tipos `select_one`).
  filter?: (v: VariableInstrumento) => boolean;
};

export function VariableSelect({
  variables, value, onChange, placeholder = "Seleccionar variable…",
  allowClear = false, filter,
}: VariableSelectProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    // Focus al search input al abrir.
    setTimeout(() => searchRef.current?.focus(), 10);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtradas = useMemo(() => {
    let base = filter ? variables.filter(filter) : variables;
    const query = q.toLowerCase().trim();
    if (!query) return base;
    return base.filter(
      (v) => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query),
    );
  }, [variables, filter, q]);

  const selectedVar = useMemo(
    () => variables.find((v) => v.name === value),
    [variables, value],
  );

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 260 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: "100%",
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 10px", textAlign: "left",
          background: "white",
          border: `1px solid ${open ? "var(--pulso-primary)" : hover ? "var(--pulso-text-soft)" : "var(--pulso-border)"}`,
          borderRadius: 6,
          fontSize: 13,
          cursor: "pointer",
          transition: "border-color 120ms ease",
        }}
      >
        {selectedVar ? (
          <>
            <code style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--pulso-primary)" }}>
              {selectedVar.name}
            </code>
            <span style={{ flex: 1, minWidth: 0, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
              {selectedVar.label}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            {placeholder}
          </span>
        )}
        {allowClear && selectedVar && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="pulso-icon"
            aria-label="Limpiar selección"
            style={{ minWidth: 20, minHeight: 20 }}
          >
            <X size={12} />
          </button>
        )}
        <ChevronDown size={14} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : undefined, transition: "transform 120ms" }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
            zIndex: 20,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            boxShadow: "var(--pulso-shadow-med)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid var(--pulso-border)" }}>
            <Search size={13} color="var(--pulso-text-soft)" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o etiqueta…"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent" }}
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="pulso-icon" aria-label="Limpiar búsqueda">
                <X size={11} />
              </button>
            )}
          </div>
          <div
            style={{
              maxHeight: 260, overflowY: "auto",
              scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
              padding: 4,
            }}
          >
            {filtradas.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center" }}>
                Sin resultados.
              </div>
            ) : (
              filtradas.map((v) => {
                const isSelected = v.name === value;
                return (
                  <button
                    key={v.name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { onChange(v.name); setOpen(false); }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "14px 1fr auto",
                      alignItems: "center",
                      gap: 8,
                      width: "100%", textAlign: "left",
                      padding: "5px 8px",
                      border: "none",
                      background: isSelected ? "var(--pulso-primary-soft)" : "transparent",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--pulso-surface-2)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span>{isSelected && <Check size={12} color="var(--pulso-primary)" />}</span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <code style={{ fontFamily: "monospace", fontWeight: 700, color: isSelected ? "var(--pulso-primary)" : "var(--pulso-text)" }}>
                        {v.name}
                      </code>
                      <span style={{ color: "var(--pulso-text-soft)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.label || <em>(sin etiqueta)</em>}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                      {v.tipo}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
