/** Variables que se dejan fuera de la auditoría, con su motivo. Salió de `tabs/InstrumentoTab.tsx`. */
import { useState, type CSSProperties } from "react";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import type { InstrumentoVariablesExcluidas } from "../types";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { formatoConteo } from "../../../lib/formatoNumero";
import { formatCompactNumber } from "./modeloInstrumento";

export const linkButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--pulso-text-soft)",
  fontSize: "var(--pulso-type-caption-size)",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

export function VariableExclusionsPanel({
  options,
  excluded,
  query,
  onQuery,
  onToggle,
  disabled = false,
}: {
  options: InstrumentoVariablesExcluidas["opciones"];
  excluded: Set<string>;
  query: string;
  onQuery: (value: string) => void;
  onToggle: (variable: string, checked: boolean, motivo?: string) => void;
  disabled?: boolean;
}) {
  const selectedCount = excluded.size;
  const totalCases = options.reduce((sum, option) => sum + (option.n_inconsistencias ?? 0), 0);
  // Vara V5: excluir silencia todas las reglas de esa variable, así que pide el
  // porqué antes de aplicarlo. Reponer no lo pide.
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        background: "var(--pulso-surface-2)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={14} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--pulso-type-subtitle-size)", fontWeight: 700, color: "var(--pulso-text)" }}>
              Variables fuera de auditoría
            </div>
            <div style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", lineHeight: 1.45, marginTop: 2 }}>
              Filtra reglas cuyo objetivo sea una variable marcada. La data no se modifica.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            fontSize: "var(--pulso-type-caption-size)",
            color: "var(--pulso-text-soft)",
          }}
        >
          <span style={variableExclusionBadgeStyle("var(--pulso-primary-soft)", "var(--pulso-primary)")}>
            {selectedCount} excluidas
          </span>
          <span style={variableExclusionBadgeStyle("white", "var(--pulso-text-soft)")}>
            {formatoConteo(options.length)} visibles
          </span>
          {totalCases > 0 && (
            <span style={variableExclusionBadgeStyle("var(--pulso-warn-bg)", "var(--pulso-warn-fg)")}>
              {formatCompactNumber(totalCases)} casos
            </span>
          )}
        </div>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Buscar variable..."
        disabled={disabled}
        style={{
          width: "100%",
          minHeight: 32,
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          background: disabled ? "var(--pulso-surface-3)" : "white",
          color: "var(--pulso-text)",
          padding: "7px 10px",
          fontSize: "var(--pulso-type-body-size)",
          outline: "none",
        }}
      />
      {options.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--pulso-border)",
            borderRadius: 8,
            background: "white",
            color: "var(--pulso-text-soft)",
            fontSize: "var(--pulso-type-body-size)",
            padding: "10px 12px",
          }}
        >
          No hay variables disponibles para el filtro actual.
        </div>
      ) : (
        <div
          data-qa-geometry-group="validacion/instrumento-exclusiones"
          data-qa-geometry-contract="intrinsic"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            // C1 `intrinsic`: cada tarjeta mide lo que pide su etiqueta (1 o 2
            // líneas, o el motivo abierto); sin estirarlas a la fila no queda
            // hueco al pie (C3).
            alignItems: "start",
            gap: 8,
            maxHeight: 260,
            overflow: "auto",
            paddingRight: 2,
          }}
        >
          {options.map((option) => {
            const checked = excluded.has(option.variable);
            return (
              <label
                key={option.variable}
                style={{
                  // Sin minHeight: la tarjeta es intrínseca (C1) y no deja hueco al pie.
                  border: `1px solid ${checked ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
                  borderRadius: 8,
                  background: checked ? "var(--pulso-primary-soft)" : "white",
                  padding: "9px 10px",
                  display: "grid",
                  gridTemplateColumns: "30px minmax(0, 1fr)",
                  gap: 8,
                  alignItems: "flex-start",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.68 : 1,
                }}
              >
                <PulsoSwitch
                  size="sm"
                  ariaLabel={`Excluir ${option.variable}`}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(excluir) => {
                    if (excluir) {
                      setMotivo("");
                      setPidiendo(option.variable);
                    } else {
                      onToggle(option.variable, false);
                    }
                  }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "var(--pulso-type-body-size)",
                        color: "var(--pulso-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.variable}
                    </strong>
                    <span style={{ fontSize: "var(--pulso-type-micro-size)", color: "var(--pulso-text-soft)", whiteSpace: "nowrap" }}>
                      {option.n_reglas} reglas
                    </span>
                  </span>
                  <span
                    title={option.label}
                    style={{
                      fontSize: "var(--pulso-type-caption-size)",
                      color: "var(--pulso-text-soft)",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {option.label || "Sin etiqueta"}
                  </span>
                  {pidiendo === option.variable && (
                    <span
                      onClick={(e) => e.preventDefault()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}
                    >
                      <input
                        autoFocus
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && motivo.trim()) {
                            onToggle(option.variable, true, motivo.trim());
                            setPidiendo(null);
                          }
                          if (e.key === "Escape") setPidiendo(null);
                        }}
                        placeholder={`Por qué se deja "${option.variable}" fuera`}
                        aria-label={`Motivo para excluir ${option.variable}`}
                        style={{
                          minWidth: 200, padding: "4px 8px", borderRadius: 6, fontSize: "var(--pulso-type-caption-size)",
                          border: "1px solid var(--pulso-border)",
                          background: "var(--pulso-surface)", color: "var(--pulso-text)",
                        }}
                      />
                      <button
                        type="button"
                        disabled={!motivo.trim()}
                        onClick={() => { onToggle(option.variable, true, motivo.trim()); setPidiendo(null); }}
                        style={{ ...linkButtonStyle, opacity: motivo.trim() ? 1 : 0.5 }}
                      >
                        Excluir
                      </button>
                      <button type="button" onClick={() => setPidiendo(null)} style={linkButtonStyle}>
                        Cancelar
                      </button>
                    </span>
                  )}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                      fontSize: "var(--pulso-type-micro-size)",
                      color: "var(--pulso-text-soft)",
                    }}
                  >
                    <span>{formatCompactNumber(option.n_inconsistencias ?? 0)} inconsistencias</span>
                    {option.n_reglas_con_casos > 0 && <span>{option.n_reglas_con_casos} con casos</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function variableExclusionBadgeStyle(background: string, color: string): CSSProperties {
  return {
    minHeight: 22,
    padding: "3px 8px",
    borderRadius: 999,
    background,
    color,
    border: "1px solid var(--pulso-border)",
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    display: "inline-flex",
    alignItems: "center",
  };
}
