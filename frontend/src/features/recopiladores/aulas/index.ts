// Adapter `aulas_v1` de Recopiladores: todo lo que sabe leer un plan de
// cursos-horario y convertirlo en accesos, materiales y manifiesto de entrega.
//
// Salió de `RecopiladoresPage.tsx` en la unidad 2 del plan
// (docs/plan-recopiladores-2026-07.md §11.1). La página consume este barrel y no
// los módulos por separado: cuando el ADR 0046 materialice
// `collection_deployment/v1`, lo que se reemplaza es este contrato y no 40
// imports repartidos por la vista.
//
// Es puro: cero React, cero fetch, cero estado. Por eso se puede testear sin
// montar nada, que es la mitad del punto de haberlo extraído.

export {
  fmt,
  isUrl,
  normalizeHeader,
  normalizeMatchKey,
  normalizeText,
  sourceRowNumber,
  sourceRowText,
} from "./texto";

export {
  classroomLabel,
  fichaId,
  fichaVenue,
  hasQr,
  packageLabel,
  roleLabel,
  rowFaculty,
  rowKey,
  rowLink,
  rowMatchKeys,
  sampleLabel,
  savedQrSrc,
  statusLabel,
} from "./filas";

export {
  KOBO_DEFAULT_BASE_URL,
  KOBO_PARAM_TEMPLATE,
  appendPersonalizedParams,
  cleanKoboBaseUrl,
  fillTemplate,
  koboProfileLabel,
  rowTemplateContext,
} from "./plantilla";
export type { TemplateContext } from "./plantilla";

export {
  RETURN_MANIFEST_HEADERS,
  returnAgendaUpdate,
  returnManifestCell,
  returnManifestRecord,
  returnManifestTsv,
} from "./manifiesto";

export {
  LINK_IMPORT_EXAMPLE,
  applyManualLinks,
  headerIndex,
  parseLinkClipboard,
  splitImportLine,
} from "./importarEnlaces";
export type { LinkParseResult, ManualLinkRecord } from "./importarEnlaces";

export {
  buildPackageOutputGroups,
  calcSelectionAgenda,
  dashboardFromState,
  facultyOptions,
  monitorAgendaFromState,
} from "./agenda";
export type { PackageOutputGroup } from "./agenda";
