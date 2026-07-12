/** Capa de dominio del motor muestral: tipos, cálculo puro y perfiles. */
export * from "./tipos";
export * from "./motor";
export { PERFILES, PERFIL_EJEMPLO, PLANTILLA_UNIVERSIDAD, PLANTILLA_ESCUELA, perfilPorId } from "./presets";
export {
  perfilDesdeFrame,
  coberturaDesdeFrame,
  perfilActivo,
  embudoAulaDesdeFrame,
  impactoOpcionalesDesdeFrame,
  type ImpactoOpcionalAula,
} from "./adaptador";
export {
  seleccionInicial,
  seleccionVariable,
  categoriasDeVariable,
  clavesDeVariable,
  categoriaMarcada,
  toggleCategoria,
  estadoGrupo,
  toggleGrupo,
  setMatch,
  setThreshold,
  ordinalIncluido,
  toggleOrdinal,
  setFromValue,
  capaDe,
  setLayer,
  upsertExcepcion,
  removeExcepcion,
  aulasCubiertas,
  aulasTotales,
  resumenVariable,
  rangosFacultad,
  setRangosFacultad,
  setSeleccionVariable,
  minEligibleThreshold,
  setMinEligible,
  type EstadoGrupo,
  type ResumenVariable,
} from "./criteriosMarco";
export {
  computeImpactoMarco,
  unidadCriterio,
  textKey,
  type ImpactoMarco,
} from "./criteriosImpacto";
