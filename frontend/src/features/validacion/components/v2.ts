// =============================================================================
// components/v2.ts — barrel de los componentes nuevos (Fase 1 revamp)
// =============================================================================
// Centraliza los re-exports de los 5 componentes compartidos nuevos:
//   - VariableChip + Var (mención inline con hovercard)
//   - RuleNarrative (compact / hero / inline)
//   - StatCard (KPI con interpretación)
//   - ContextLens (panel lateral deslizable)
//   - DecisionStorageBar (barra segmentada estilo almacenamiento iPhone)
//
// Los tabs los consumen desde aquí:
//   import { RuleNarrative, ContextLens, DecisionStorageBar } from "../components/v2";
// =============================================================================

export { default as VariableChip, Var } from "./VariableChip";
export type { VariableChipProps, VariableHoverData } from "./VariableChip";

export { default as RuleNarrative } from "./RuleNarrative";
export type { RuleNarrativeProps, RuleNarrativeVariant } from "./RuleNarrative";

export { default as StatCard } from "./StatCard";
export type { StatCardProps, StatTone } from "./StatCard";

export { default as ContextLens } from "./ContextLens";
export type { ContextLensProps, ContextLensTab } from "./ContextLens";

export { default as DecisionStorageBar } from "./DecisionStorageBar";
export type {
  DecisionStorageBarProps,
  DecisionCounts,
  DecisionKind,
} from "./DecisionStorageBar";

// Re-export de los helpers narrativos por conveniencia
export {
  ROLE_META,
  buildExpectationHeadline,
  buildActivationSummary,
  buildCompareSummary,
  buildRoleSections,
  displayTargetName,
  normalizeVarType,
  varTypeTokens,
  cleanSentence,
  humanList,
  uniqueStrings,
} from "../narrative";
export type { ReglaLike, RoleKey, RoleSection, VarType } from "../narrative";
