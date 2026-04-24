// =============================================================================
// CrossBar.tsx — control de cruce co-ubicado para ExplorarTab
// =============================================================================
// Estados visuales:
//   - Sin cruce: botón "+ Cruzar con…" discreto, 1 línea.
//   - Cruce activo: chip con "Cruzando con «varB»" + × para quitar + botón
//     "Cambiar" que vuelve a abrir el picker.
//
// Al abrir: popover anclado al trigger con:
//   - Search input
//   - Sugerencias (variables de la misma sección del dataset — si hay)
//   - Lista completa filtrable por nombre o label
//
// El picker sólo lista variables compatibles: tipo so/sm/num (el resto
// aún no tiene bivariado).
// =============================================================================

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GitCompare, Search, X as XIcon } from "lucide-react";
import type { ExploradorSeccion, ExploradorVariable } from "../types";

export type CrossBarProps = {
  secciones: ExploradorSeccion[];
  /** Variable principal (no se lista en el picker). */
  selfVar: string;
  /** Sección de la variable principal (para ordenar sugerencias). */
  selfSeccion: string | null;
  /** Variable cruzada actualmente, o null si no hay cruce. */
  cruzar: string | null;
  onChange: (v: string | null) => void;
  /** Estilos custom del contenedor. */
  style?: CSSProperties;
};

export default function CrossBar({
  secciones,
  selfVar,
  selfSeccion,
  cruzar,
  onChange,
  style,
}: CrossBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Variables compatibles con cruce (excluye la propia y tipos no soportados).
  const compatibles = useMemo(() => {
    const all = secciones.flatMap((s) =>
      s.variables
        .filter((v) => v.name !== selfVar && (v.tipo === "so" || v.tipo === "sm" || v.tipo === "num"))
        .map((v) => ({ ...v, seccion: s.nombre })),
    );
    return all;
  }, [secciones, selfVar]);

  // Sugerencias: las de la misma sección (primeras 6, excluyendo la propia).
  const suggestions = useMemo(() => {
    if (!selfSeccion) return [];
    return compatibles
      .filter((v) => v.seccion === selfSeccion)
      .slice(0, 6);
  }, [compatibles, selfSeccion]);

  // Búsqueda: filtra por nombre o label.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return compatibles;
    return compatibles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.label ?? "").toLowerCase().includes(q),
    );
  }, [compatibles, query]);

  const crossedVar = useMemo(
    () => (cruzar ? compatibles.find((v) => v.name === cruzar) : null),
    [compatibles, cruzar],
  );

  function handlePick(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", ...style }}>
      {!cruzar && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: "var(--pulso-radius-chip)",
            border: "1px dashed var(--pulso-primary-border)",
            background: open ? "var(--pulso-primary-soft)" : "white",
            color: "var(--pulso-primary)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 120ms ease",
          }}
        >
          <GitCompare size={13} />
          Cruzar con…
        </button>
      )}

      {cruzar && crossedVar && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 4px 4px 10px",
            borderRadius: "var(--pulso-radius-chip)",
            background: "var(--pulso-primary-soft)",
            border: "1px solid var(--pulso-primary-border)",
            color: "var(--pulso-primary)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <GitCompare size={13} />
          <span>Cruzando con</span>
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              background: "white",
              padding: "1px 6px",
              borderRadius: 4,
              color: "var(--pulso-text)",
              border: "1px solid var(--pulso-border)",
            }}
          >
            {crossedVar.name}
          </code>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Cambiar variable de cruce"
            style={{
              padding: "3px 8px",
              fontSize: 11,
              fontWeight: 700,
              background: "white",
              border: "1px solid var(--pulso-primary-border)",
              color: "var(--pulso-primary)",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Quitar cruce"
            aria-label="Quitar cruce"
            style={{
              width: 24,
              height: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              background: "white",
              border: "1px solid var(--pulso-border)",
              color: "var(--pulso-text-soft)",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      <span
        style={{
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          lineHeight: 1.4,
        }}
      >
        SO × SO (barras apiladas) · SO × SM (comparación por opción) · SO × NUM (boxplot)
      </span>

      {open && triggerRef.current && (
        <CrossPopover
          anchorRect={triggerRef.current.getBoundingClientRect()}
          onClose={() => setOpen(false)}
          query={query}
          onQueryChange={setQuery}
          suggestions={suggestions}
          filtered={filtered}
          cruzar={cruzar}
          onPick={handlePick}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Popover portal con sugerencias + search + lista completa
// -----------------------------------------------------------------------------
function CrossPopover({
  anchorRect,
  onClose,
  query,
  onQueryChange,
  suggestions,
  filtered,
  cruzar,
  onPick,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  query: string;
  onQueryChange: (v: string) => void;
  suggestions: Array<ExploradorVariable & { seccion: string }>;
  filtered: Array<ExploradorVariable & { seccion: string }>;
  cruzar: string | null;
  onPick: (name: string) => void;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    // Timeout para dejar pasar el click que abrió el popover.
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onClickOutside);
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickOutside);
      window.clearTimeout(t);
    };
  }, [onClose]);

  // Posicionamiento: debajo del trigger, alineado a la izquierda.
  const top = anchorRect.bottom + 6;
  const left = Math.max(12, Math.min(anchorRect.left, window.innerWidth - 420));

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Seleccionar variable de cruce"
      style={{
        position: "fixed",
        top,
        left,
        width: 400,
        maxHeight: 480,
        zIndex: 90,
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        borderRadius: 12,
        boxShadow: "var(--pulso-shadow-med)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Search */}
      <div
        style={{
          position: "relative",
          padding: "10px 12px",
          borderBottom: "1px solid var(--pulso-border)",
          background: "var(--pulso-surface)",
        }}
      >
        <Search
          size={13}
          style={{
            position: "absolute",
            top: "50%",
            left: 22,
            transform: "translateY(-50%)",
            color: "var(--pulso-text-soft)",
          }}
        />
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar variable por nombre o etiqueta…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 10px 7px 28px",
            fontSize: 12,
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            outline: "none",
            background: "white",
          }}
        />
      </div>

      {/* Sugerencias (solo si no hay búsqueda activa) */}
      {!query && suggestions.length > 0 && (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface-2)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--pulso-text-soft)",
              marginBottom: 6,
            }}
          >
            En la misma sección
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.map((v) => {
              const active = v.name === cruzar;
              return (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onPick(v.name)}
                  title={v.label ?? undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
                    background: active ? "var(--pulso-primary-soft)" : "white",
                    color: "var(--pulso-text)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista completa filtrable */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 20,
              fontSize: 12,
              color: "var(--pulso-text-soft)",
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            Sin resultados.
          </div>
        ) : (
          filtered.map((v) => {
            const active = v.name === cruzar;
            return (
              <button
                key={v.name}
                type="button"
                onClick={() => onPick(v.name)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: active ? "var(--pulso-primary-soft)" : "white",
                  border: "none",
                  borderBottom: "1px solid var(--pulso-surface-2)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 5px",
                    borderRadius: 3,
                    background: "var(--pulso-surface-2)",
                    color: "var(--pulso-text-soft)",
                    fontFamily: "ui-monospace, monospace",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {v.tipo}
                </span>
                <code
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    color: "var(--pulso-text)",
                    flexShrink: 0,
                  }}
                >
                  {v.name}
                </code>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--pulso-text-soft)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--pulso-text-soft)",
                    flexShrink: 0,
                  }}
                >
                  {v.seccion}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}
