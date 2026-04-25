// =============================================================================
// logic/index.ts — barrel del módulo de lógica
// =============================================================================
// Punto único de importación para el AST de expresiones ODK. Cualquier
// componente del editor (builder guiado, canvas, validador) debería
// hacer:
//
//   import { parseExpression, serializeExpression } from "../logic";
//
// y nunca tocar los archivos internos directamente.
// =============================================================================

export type { CompareOp, Expr, LogicalOp } from "./ast";
export {
  and,
  call,
  compare,
  current,
  equalsExpr,
  lit,
  not,
  or,
  raw,
  ref,
} from "./ast";

export { parseExpression, parseExpressionStrict } from "./parse";
export { serializeExpression } from "./serialize";
export {
  collectCalls,
  collectRefs,
  exprStats,
  isSimpleExpression,
  mapExpr,
  renameRef,
  walk,
} from "./inspect";

export type { LogicCatalog, LogicScope, LogicVariable } from "./builderTypes";
export type { PredicateKind } from "./operators";
export {
  defaultPredicate,
  predicateKey,
  predicatesForType,
} from "./operators";
export type { FlatCondition, FlatConstraint } from "./conditionAdapter";
export {
  expandCondition,
  expandConstraint,
  tryFlattenCondition,
  tryFlattenConstraint,
} from "./conditionAdapter";
