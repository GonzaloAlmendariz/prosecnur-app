// =============================================================================
// RuleDetailPanel.tsx — detalle explicativo de una regla del instrumento.
// =============================================================================
// Al hacer click en CUALQUIER tarjeta de regla (required/skip/range/constraint/
// catalog/coherence/calculate_check/select_multiple_cardinality/outlier/
// duplicate/pattern/odk_raw/relacionales/...) este panel explica su validación:
//
//   (a) Narrativa RICA (RuleNarrative variante "hero"): roles con hovercards
//       (target/drivers/compare/gate), "qué se espera", "por qué aplica",
//       severidad y fuente (XLSForm vs Criterio). Es el MISMO nivel de detalle
//       para reglas consistentes y con casos.
//   (b) DIAGRAMA DE FLUJO de la lógica (RuleFlowDiagram + ruleFlowModel), que
//       resume visualmente gate→objetivo→regla→comparación→veredicto.
//   (c) "Reglas aplicadas": referencia técnica auditable.
//
// No depende del drill de casos: se arma con la fila del resumen, así funciona
// también para reglas no evaluadas / no aplicables / pull-data.
// =============================================================================

import { useMemo, type ReactNode } from "react";
import type { ReglaLike } from "../narrative";
import { cleanSentence } from "../narrative";
import { buildRuleFlow, humanizeRuleType } from "../ruleFlowModel";
import RuleNarrative from "./RuleNarrative";
import type { VariableHoverData } from "./VariableChip";
import RuleFlowDiagram from "./RuleFlowDiagram";
import "./ruleDetail.css";

export type RuleDetailInput = {
  regla: ReglaLike;
  displayName: string;
  estadoDinamico: string | null;
  issueCode: string | null;
  detalle: string | null;
  nInconsistencias: number | null;
  porcentaje: number | null;
  requiresExternalDataset: boolean;
  relationalConditionCopy: string | null;
  seccion: string | null;
  labelLookup: (v: string) => string | null;
};

export default function RuleDetailPanel({ input }: { input: RuleDetailInput }) {
  const { regla, labelLookup } = input;

  const flow = useMemo(
    () =>
      buildRuleFlow({
        regla,
        estadoDinamico: input.estadoDinamico,
        issueCode: input.issueCode,
        detalle: input.detalle,
        nInconsistencias: input.nInconsistencias,
        porcentaje: input.porcentaje,
        requiresExternalDataset: input.requiresExternalDataset,
        relationalConditionCopy: input.relationalConditionCopy,
        labelLookup,
      }),
    [
      regla,
      input.estadoDinamico,
      input.issueCode,
      input.detalle,
      input.nInconsistencias,
      input.porcentaje,
      input.requiresExternalDataset,
      input.relationalConditionCopy,
      labelLookup,
    ],
  );

  // Hovercards de variables: label humano + sección (lo disponible en el
  // resumen; el drill de casos, cuando existe, ya trae stats más ricos abajo).
  const hoverLookup = useMemo(() => {
    const seccion = input.seccion;
    return (name: string): VariableHoverData | undefined => {
      const label = labelLookup(name);
      if (!label && !seccion) return undefined;
      return { label: label ?? undefined, seccion: seccion ?? undefined };
    };
  }, [labelLookup, input.seccion]);

  // El CaseBadge de la narrativa sólo tiene sentido cuando la regla realmente
  // se evaluó (con o sin casos). En estados no evaluados/no aplicables el
  // conteo "0" es engañoso — el veredicto real vive en el diagrama.
  const heroEvaluated =
    flow.verdictKind === "issues" || flow.verdictKind === "clean";
  const heroCasos = heroEvaluated ? input.nInconsistencias ?? 0 : null;

  const typeLabel = humanizeRuleType(regla.tipo_regla, regla.tipo_observacion);
  const conditionText = firstText(
    regla.presentation?.detalle_condicion,
    input.detalle,
  );
  const objetivoText = firstText(regla.presentation?.objetivo, regla.objetivo);
  const variableKeys = uniqueKeys(regla.variables ?? []);

  return (
    <div className="pulso-ruledetail" data-audit-ready="true">
      {/* Narrativa rica: roles con hovercards + qué se espera + por qué aplica
          + severidad + fuente. Mismo detalle para consistentes y con casos. */}
      <RuleNarrative
        rule={regla}
        variant="hero"
        labelLookup={labelLookup}
        variableHoverLookup={hoverLookup}
        nCasos={heroCasos}
        porcentaje={heroCasos != null ? input.porcentaje : null}
      />

      {/* Diagrama de flujo — resumen visual de la lógica + veredicto real. */}
      <div>
        <div className="pulso-ruledetail__section-title">Cómo se valida</div>
        <RuleFlowDiagram flow={flow} />
      </div>

      {/* Reglas aplicadas — referencia auditable. */}
      <div>
        <div className="pulso-ruledetail__section-title">Reglas aplicadas</div>
        <div className="pulso-ruledetail__applied">
          <AppliedRow label="Tipo">
            {typeLabel}
            {regla.tipo_regla && (
              <>
                {" "}
                <code>{regla.tipo_regla}</code>
              </>
            )}
          </AppliedRow>
          {objetivoText && <AppliedRow label="Objetivo">{objetivoText}</AppliedRow>}
          {conditionText && (
            <AppliedRow label="Condición">
              <code>{conditionText}</code>
            </AppliedRow>
          )}
          {variableKeys.length > 0 && (
            <AppliedRow label="Variables">
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                {variableKeys.map((v) => (
                  <code key={v} title={labelLookup(v) ?? undefined}>
                    {v}
                  </code>
                ))}
              </span>
            </AppliedRow>
          )}
          <AppliedRow label="Estado">
            {stateHuman(input.estadoDinamico)}
            {input.issueCode && (
              <>
                {" "}
                <code>{input.issueCode}</code>
              </>
            )}
          </AppliedRow>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-componentes / helpers de presentación.
// -----------------------------------------------------------------------------

function AppliedRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pulso-ruledetail__applied-row">
      <span className="pulso-ruledetail__applied-key">{label}</span>
      <span className="pulso-ruledetail__applied-val">{children}</span>
    </div>
  );
}

function stateHuman(estado: string | null): string {
  switch (estado) {
    case "correcta":
      return "Evaluada correctamente";
    case "no_aplicable":
      return "No aplicable a esta base";
    case "no_evaluada":
      return "No evaluada automáticamente";
    case "incorrecta_ejecucion":
      return "Error de ejecución";
    case "desalineada":
      return "Desalineada con los datos";
    default:
      return estado ?? "—";
  }
}

function firstText(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const clean = cleanSentence(c);
    if (clean) return clean;
  }
  return null;
}

function uniqueKeys(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const k = (v ?? "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
