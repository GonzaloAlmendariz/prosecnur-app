// =============================================================================
// components/v2.ts — barrel de los componentes compartidos del revamp
// =============================================================================
// Centraliza los re-exports del kit nuevo:
//   - VariableChip + Var (mención inline con hovercard)
//   - RuleNarrative (compact / hero / inline)
//   - ContextLens (panel lateral deslizable)
//
// Los tabs los consumen desde aquí:
//   import { RuleNarrative, ContextLens } from "../components/v2";
// =============================================================================

export { default as VariableChip, Var } from "./VariableChip";
export type { VariableChipProps, VariableHoverData } from "./VariableChip";

export { default as RuleNarrative } from "./RuleNarrative";
export type { RuleNarrativeProps, RuleNarrativeVariant } from "./RuleNarrative";

export { default as ContextLens } from "./ContextLens";
export type { ContextLensProps, ContextLensTab } from "./ContextLens";

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
