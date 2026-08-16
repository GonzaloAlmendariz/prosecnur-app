/**
 * Fachada de compatibilidad para las piezas compartidas de Aulas.
 * La implementación vive en módulos dueños para evitar que este barrel vuelva
 * a convertirse en un monolito. Los módulos internos nunca importan de aquí.
 */
import "./aulas.css";
import "../shared/aviso.css";

export { NumberCell } from "./NumberCell";
export { ClassroomEmptyState, Metric } from "./ClassroomPrimitives";
export {
  classroomMethodLabel,
  classroomMethodReason,
  classroomNumberText,
  classroomOperationalCode,
  classroomPlanLabel,
  classroomProbabilitySourceLabel,
  classroomScore,
  classroomWaveNumber,
  selectorFieldLabel,
  selectorFieldLabelTitulo,
} from "./classroomLabels";
export { buildClassroomLabModel, type ClassroomLabModel } from "./classroomLabModel";
export { ClassroomLabCommandBar } from "./ClassroomLabCommandBar";
export { ObjectiveWeightsPanel } from "./ObjectiveWeightsPanel";
export {
  ClassroomBalanceTable,
  ClassroomRecommendation,
  CoverageOverlapPanel,
  MethodSummaryCard,
  ProfileBalanceChart,
  RepresentativityMetricGrid,
  SimulationSummaryPanel,
  motorCopyText,
} from "./ClassroomMethodPanels";
export {
  ClassroomOverlapGraph,
  ClassroomSelectionPreparationPanel,
  ClassroomSelectionRationaleDashboard,
  ClassroomSelectionTable,
} from "./ClassroomSelectionPanels";
export {
  ClassroomReplacementBlueprintPanel,
  ClassroomReplacementChainPanel,
  ClassroomReplacementTables,
  classroomReplacementChains,
  profundidadCadenaPedida,
} from "./ClassroomReplacementPanels";
export {
  ClassroomMethodSources,
  ClassroomOperationalHandoffPanel,
} from "./ClassroomAuditPanels";
