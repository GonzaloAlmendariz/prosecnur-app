import type { CSSProperties } from "react";
import type { VarWithSource } from "./useVariables";
import {
  buildVariableRespondentSummary,
  formatRespondentSourceLabel,
  type VariableRespondentGroup,
} from "./variableRespondentSummary";

type Props = {
  refs: readonly string[];
  variables: readonly VarWithSource[];
  multi: boolean;
};

export default function VariableRespondentSummary({ refs, variables, multi }: Props) {
  const summary = buildVariableRespondentSummary(refs, variables, multi);
  if (!summary.groups.length) return null;

  return (
    <section
      aria-live="polite"
      aria-label="Respondientes de las variables seleccionadas"
      style={containerStyle}
    >
      <strong style={headingStyle}>Respondientes de las variables seleccionadas</strong>
      <div role="list" style={listStyle}>
        {summary.groups.map((group) => {
          const displaySource = formatRespondentSourceLabel(group.source);
          return (
            <span
              key={group.source}
              role="listitem"
              aria-label={accessibleGroupLabel(group, displaySource)}
              style={chipStyle}
            >
              <b style={sourceStyle}>{displaySource}</b>
              <span aria-hidden="true">·</span>
              <span>{visibleGroupLabel(group)}</span>
            </span>
          );
        })}
      </div>
      <small style={noteStyle}>Disponibilidad antes de filtros y exclusiones del gráfico.</small>
    </section>
  );
}

function visibleGroupLabel(group: VariableRespondentGroup): string {
  if (group.status === "exact") {
    return group.minN === 1 ? "1 respuesta no vacía" : `${group.minN} respuestas no vacías`;
  }
  if (group.status === "range") return `${group.minN}-${group.maxN} según variable`;
  if (group.status === "partial") {
    return `conteo disponible en ${group.knownCount} de ${group.variableCount} variables`;
  }
  return "conteo no disponible";
}

function accessibleGroupLabel(group: VariableRespondentGroup, displaySource: string): string {
  if (group.status === "range") {
    return `${displaySource}: entre ${group.minN} y ${group.maxN} respuestas no vacías, según la variable.`;
  }
  return `${displaySource}: ${visibleGroupLabel(group)}.`;
}

const containerStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
  padding: "7px 9px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 9,
  background: "var(--pulso-surface-2)",
};

const headingStyle: CSSProperties = {
  color: "var(--pulso-text)",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.2,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  minWidth: 0,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: 4,
  minWidth: 0,
  maxWidth: "100%",
  padding: "3px 7px",
  border: "1px solid var(--pulso-border)",
  borderRadius: 999,
  background: "var(--pulso-surface)",
  color: "var(--pulso-text-soft)",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.25,
};

const sourceStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: 180,
  overflow: "hidden",
  color: "var(--pulso-text)",
  fontWeight: 800,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const noteStyle: CSSProperties = {
  color: "var(--pulso-text-soft)",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.25,
};
