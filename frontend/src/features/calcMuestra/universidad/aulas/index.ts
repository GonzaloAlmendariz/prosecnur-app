/** Sección Aulas (laboratorio de selección) del desk universitario: 7 pestañas. */
export { AulasMarcoTab } from "./AulasMarcoTab";
export { AulasObjetivoTab } from "./AulasObjetivoTab";
export { AulasMetodoTab } from "./AulasMetodoTab";
export { AulasSimulacionTab } from "./AulasSimulacionTab";
export { AulasSeleccionTab } from "./AulasSeleccionTab";
export { AulasReemplazosTab } from "./AulasReemplazosTab";
export { AulasAuditoriaTab } from "./AulasAuditoriaTab";
export {
  buildClassroomLabModel,
  type ClassroomLabModel,
  // Piezas movidas que el monolito sigue usando en Salidas.
  ClassroomEmptyState,
  ClassroomReplacementTables,
  ClassroomSelectionTable,
  classroomMethodLabel,
  Metric,
  NumberCell,
} from "./aulasParts";
