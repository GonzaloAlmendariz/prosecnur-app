import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { ExploradorSeccion, ExploradorVariable } from "../types";

// =============================================================================
// VariablePicker — panel de navegación de variables (Sprint 3)
// =============================================================================
// Lista plegable de secciones con sus variables. Buscador arriba que
// filtra por nombre/label. Al hacer click en una variable, dispara
// onSelect con el nombre y el objeto meta.
//
// Cada variable muestra: chip de tipo (so/sm/num/fecha/texto), nombre
// monoespaciado, label humano, y % missing si > 20% (warn).

const TIPO_COLORS: Record<
  string,
  { bg: string; fg: string; label: string }
> = {
  so: { bg: "#dbeafe", fg: "#1e40af", label: "SO" },
  sm: { bg: "#ede9fe", fg: "#5b21b6", label: "SM" },
  num: { bg: "#d1fae5", fg: "#065f46", label: "123" },
  fecha: { bg: "#ffedd5", fg: "#9a3412", label: "📅" },
  texto: { bg: "#f3f4f6", fg: "#374151", label: "abc" },
  mixto: { bg: "#f3f4f6", fg: "#6b7280", label: "?" },
};

type Props = {
  secciones: ExploradorSeccion[];
  selectedVar: string | null;
  onSelect: (v: ExploradorVariable) => void;
};

export default function VariablePicker({
  secciones,
  selectedVar,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredSecs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return secciones;
    return secciones
      .map((s) => ({
        ...s,
        variables: s.variables.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.label.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.variables.length > 0);
  }, [secciones, query]);

  if (!secciones.length) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 12,
          color: "var(--pulso-text-soft)",
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        Sin variables en esta base.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Buscador */}
      <div style={{ position: "relative" }}>
        <Search
          size={14}
          color="var(--pulso-text-soft)"
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Buscar variable…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            fontSize: 12,
            padding: "8px 10px 8px 32px",
            borderRadius: 8,
            border: "1px solid var(--pulso-border)",
            background: "white",
            outline: "none",
          }}
        />
      </div>

      {/* Secciones */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 560,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {filteredSecs.map((sec) => {
          const isCollapsed = !!collapsed[sec.nombre];
          return (
            <div key={sec.nombre}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({
                    ...c,
                    [sec.nombre]: !c[sec.nombre],
                  }))
                }
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "var(--pulso-text-soft)",
                  cursor: "pointer",
                  borderRadius: 6,
                }}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {sec.nombre}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--pulso-text-soft)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  · {sec.variables.length}
                </span>
              </button>
              {!isCollapsed &&
                sec.variables.map((v) => (
                  <VariableRow
                    key={v.name}
                    v={v}
                    selected={v.name === selectedVar}
                    onClick={() => onSelect(v)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VariableRow({
  v,
  selected,
  onClick,
}: {
  v: ExploradorVariable;
  selected: boolean;
  onClick: () => void;
}) {
  const tipoColors = TIPO_COLORS[v.tipo] ?? TIPO_COLORS.mixto;
  const total = v.n_validos + v.n_nulos;
  const pctMissing = total > 0 ? v.n_nulos / total : 0;
  const showMissing = pctMissing > 0.2;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        background: selected ? "var(--pulso-primary-soft)" : "transparent",
        border: selected
          ? "1px solid var(--pulso-primary-border)"
          : "1px solid transparent",
        borderRadius: 6,
        textAlign: "left",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.background = "var(--pulso-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: 4,
          background: tipoColors.bg,
          color: tipoColors.fg,
          fontFamily: "ui-monospace, monospace",
          minWidth: 32,
          textAlign: "center",
        }}
      >
        {tipoColors.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            color: selected ? "var(--pulso-primary)" : "var(--pulso-text)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {v.name}
        </div>
        {v.label && v.label !== v.name && (
          <div
            style={{
              fontSize: 10,
              color: "var(--pulso-text-soft)",
              marginTop: 1,
              lineHeight: 1.3,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={v.label}
          >
            {v.label}
          </div>
        )}
      </div>
      {showMissing && (
        <span
          title={`${(pctMissing * 100).toFixed(1)}% missing`}
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--pulso-warn-bg)",
            color: "var(--pulso-warn-fg)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {(pctMissing * 100).toFixed(0)}%
        </span>
      )}
    </button>
  );
}
