import type {
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialPhase,
  MonitoreoTerritorialUmpReconciliation,
  TerritorialBlockProgress,
  TerritorialResponseAuditRow,
} from "../../api/client";
import {
  resolveTerritorialGeoAssignment,
  type TerritorialGeoAssignmentPoint,
  type TerritorialGeoAssignmentSource,
} from "./territorialGeoAssignment";

export type TerritorialUmpAuditCandidateReason =
  | "gps_near_target"
  | "same_responsible_window";

export type TerritorialUmpAuditCase = {
  id: string;
  row: TerritorialResponseAuditRow;
  countsInTarget: boolean;
  candidateReasons: TerritorialUmpAuditCandidateReason[];
  assignmentSource: TerritorialGeoAssignmentSource;
  assignedBlock: TerritorialBlockProgress | null;
  nearestBlock: TerritorialBlockProgress | null;
  nearestBlockResponsible: string;
  nearestDiffers: boolean;
  responseId: string;
  rowIndex: number | null;
  responsible: string;
  submittedAtMs: number | null;
  submissionLabel: string;
  age: number | null;
  sex: string;
  sexLabel: string;
  demographicLabel: string;
  declaredUmp: string;
  assignedUmp: string;
  assignedBlockId: string;
  nearestUmp: string;
  nearestBlockId: string;
  distanceM: number | null;
  canReconcileToTarget: boolean;
};

export type TerritorialUmpAuditModel = {
  dataAvailable: boolean;
  targetBlock: TerritorialBlockProgress | null;
  targetQuotaBlock: NonNullable<MonitoreoTerritorialDashboard["route_quota_progress"]>["blocks"][number] | null;
  phase: MonitoreoTerritorialPhase;
  assignedCases: TerritorialUmpAuditCase[];
  candidateCases: TerritorialUmpAuditCase[];
  allCases: TerritorialUmpAuditCase[];
  summary: {
    target: number | null;
    validas: number | null;
    missing: number | null;
    assignedCount: number;
    candidateCount: number;
    gpsNearOtherUmpCount: number;
    sameResponsibleWindowCount: number;
    status: string;
  };
};

export type TerritorialUmpAuditTarget = {
  blockId?: string;
  ump?: string;
};

const TEMPORAL_CANDIDATE_PADDING_MS = 30 * 60 * 1000;

export function buildTerritorialUmpCaseAudit(
  reports: MonitoreoTerritorialDashboard,
  target: TerritorialUmpAuditTarget,
): TerritorialUmpAuditModel {
  const phase = normalizeTerritorialAuditPhase(reports.active_route_phase);
  const blocks = territorialAuditRouteBlocks(reports);
  const targetBlock = findAuditTargetBlock(blocks, target);
  const targetQuotaBlock = targetBlock
    ? findAuditQuotaBlock(reports.route_quota_progress?.blocks ?? [], targetBlock)
    : null;
  const rows = Array.isArray(reports.response_audit) ? reports.response_audit.filter(isTerritorialAuditCountableRow) : [];
  const pointByResponse = new Map<string, TerritorialGeoAssignmentPoint>((reports.map?.points ?? [])
    .flatMap((point) => point.response_id ? [[point.response_id, point] as [string, TerritorialGeoAssignmentPoint]] : []));
  const responsibleByAssignedBlock = buildTerritorialAuditBlockResponsibleIndex(rows, blocks, pointByResponse);
  const assignedRows = targetBlock ? rows.filter((row) => {
    const assignment = resolveTerritorialGeoAssignment(row, blocks, pointByResponse.get(row.response_id));
    return Boolean(assignment.block && sameTerritorialAuditBlock(assignment.block, targetBlock));
  }) : [];
  const targetResponsibles = new Set(assignedRows.map(territorialAuditResponsibleKey).filter(Boolean));
  const timeWindow = territorialAuditTimeWindow(assignedRows);

  const allCases = rows.map((row): TerritorialUmpAuditCase | null => {
    if (!targetBlock) return null;
    const point = pointByResponse.get(row.response_id);
    const assignment = resolveTerritorialGeoAssignment(row, blocks, point);
    const countsInTarget = Boolean(assignment.block && sameTerritorialAuditBlock(assignment.block, targetBlock));
    const candidateReasons: TerritorialUmpAuditCandidateReason[] = [];
    if (!countsInTarget && assignment.nearestBlock && sameTerritorialAuditBlock(assignment.nearestBlock, targetBlock)) {
      candidateReasons.push("gps_near_target");
    }
    if (!countsInTarget && isSameResponsibleWindowCandidate(row, targetBlock, targetResponsibles, timeWindow)) {
      candidateReasons.push("same_responsible_window");
    }
    if (!countsInTarget && !candidateReasons.length) return null;
    return buildTerritorialUmpAuditCase(row, assignment, targetBlock, countsInTarget, candidateReasons, responsibleByAssignedBlock);
  }).filter((item): item is TerritorialUmpAuditCase => Boolean(item));

  const assignedCases = allCases
    .filter((item) => item.countsInTarget)
    .sort(compareTerritorialAuditCases);
  const candidateCases = allCases
    .filter((item) => !item.countsInTarget)
    .sort(compareTerritorialAuditCandidates);
  const targetCount = numberOrNull(targetQuotaBlock?.target ?? targetBlock?.meta ?? targetBlock?.entrevistas);
  const backendValidas = numberOrNull(targetBlock?.validas ?? targetQuotaBlock?.validas);
  const validas = assignedCases.length || backendValidas;
  const missing = targetCount == null || validas == null
    ? numberOrNull(targetBlock?.brecha ?? targetQuotaBlock?.missing_total)
    : Math.max(0, targetCount - validas);

  return {
    dataAvailable: rows.length > 0,
    targetBlock,
    targetQuotaBlock,
    phase,
    assignedCases,
    candidateCases,
    allCases,
    summary: {
      target: targetCount,
      validas,
      missing,
      assignedCount: assignedCases.length,
      candidateCount: candidateCases.length,
      gpsNearOtherUmpCount: candidateCases.filter((item) => item.candidateReasons.includes("gps_near_target")).length,
      sameResponsibleWindowCount: candidateCases.filter((item) => item.candidateReasons.includes("same_responsible_window")).length,
      status: String(targetQuotaBlock?.status ?? targetBlock?.avance_pct ?? ""),
    },
  };
}

export function buildTerritorialUmpResponseReconciliation(
  item: TerritorialUmpAuditCase,
  targetBlock: TerritorialBlockProgress,
  phase: MonitoreoTerritorialPhase,
  note: string,
): MonitoreoTerritorialUmpReconciliation | null {
  const responseId = stringOrEmpty(item.row.response_id).trim();
  const rawUmp = stringOrEmpty(item.row.declared_ump_raw || item.row.declared_ump_normalized || item.row.advance_block_ump).trim();
  const assignedBlockId = stringOrEmpty(targetBlock.id_manzana).trim();
  const assignedUmp = territorialAuditBlockUmp(targetBlock);
  if (!responseId || !rawUmp || !assignedBlockId || !assignedUmp) return null;
  return {
    response_id: responseId,
    response_id_field: "row_index",
    raw_ump: rawUmp,
    assigned_block_id: assignedBlockId,
    assigned_ump: assignedUmp,
    assigned_district: stringOrEmpty(targetBlock.distrito),
    assigned_ubigeo: stringOrEmpty(targetBlock.ubigeo),
    phase,
    note: note.trim(),
    created_at: new Date().toISOString(),
    scope: "response",
  };
}

export function territorialAuditBlockLabel(block: TerritorialBlockProgress | null | undefined) {
  if (!block) return "Sin UMP";
  const ump = territorialAuditBlockUmp(block);
  const manzana = stringOrEmpty(block.manzana || block.id_manzana);
  return [ump ? `UMP ${ump}` : "", manzana ? `Mz. ${manzana}` : ""].filter(Boolean).join(" · ") || "UMP";
}

export function territorialAuditBlockUmp(block: TerritorialBlockProgress | null | undefined) {
  return stringOrEmpty(block?.ump || block?.hoja_num || block?.orden_seleccion).trim();
}

function buildTerritorialUmpAuditCase(
  row: TerritorialResponseAuditRow,
  assignment: ReturnType<typeof resolveTerritorialGeoAssignment>,
  targetBlock: TerritorialBlockProgress,
  countsInTarget: boolean,
  candidateReasons: TerritorialUmpAuditCandidateReason[],
  responsibleByAssignedBlock: Map<string, string>,
): TerritorialUmpAuditCase {
  const submittedAtMs = territorialAuditSubmittedAtMs(row);
  const sexLabel = territorialAuditSexLabel(row.sex);
  const age = numberOrNull(row.age);
  const declaredUmp = stringOrEmpty(row.declared_ump_raw || row.declared_ump_normalized);
  const assignedUmp = territorialAuditBlockUmp(assignment.block) || stringOrEmpty(row.advance_block_ump);
  const nearestUmp = territorialAuditBlockUmp(assignment.nearestBlock);
  return {
    id: stringOrEmpty(row.response_id) || `row-${row.row_index}`,
    row,
    countsInTarget,
    candidateReasons,
    assignmentSource: assignment.source,
    assignedBlock: assignment.block,
    nearestBlock: assignment.nearestBlock,
    nearestBlockResponsible: territorialAuditResponsibleForBlock(assignment.nearestBlock, responsibleByAssignedBlock),
    nearestDiffers: assignment.nearestDiffers,
    responseId: stringOrEmpty(row.response_id),
    rowIndex: numberOrNull(row.row_index),
    responsible: territorialAuditResponsibleLabel(row),
    submittedAtMs,
    submissionLabel: territorialAuditSubmissionLabel(row),
    age,
    sex: stringOrEmpty(row.sex),
    sexLabel,
    demographicLabel: [sexLabel, age == null ? "edad S/D" : `${age}`].filter(Boolean).join(" "),
    declaredUmp,
    assignedUmp,
    assignedBlockId: stringOrEmpty(assignment.block?.id_manzana || row.advance_block_id),
    nearestUmp,
    nearestBlockId: stringOrEmpty(assignment.nearestBlock?.id_manzana || row.nearest_block_id),
    distanceM: numberOrNull(row.distance_m),
    canReconcileToTarget: Boolean(!countsInTarget && row.response_id && declaredUmp && targetBlock.id_manzana && territorialAuditBlockUmp(targetBlock)),
  };
}

function territorialAuditRouteBlocks(reports: MonitoreoTerritorialDashboard) {
  const candidates = [
    ...(reports.map?.blocks ?? []),
    ...(reports.block_progress ?? []),
    ...(reports.advance?.block_progress ?? []),
  ];
  const seen = new Set<string>();
  return candidates.filter((block) => {
    const key = territorialAuditBlockStableKey(block);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTerritorialAuditBlockResponsibleIndex(
  rows: TerritorialResponseAuditRow[],
  blocks: TerritorialBlockProgress[],
  pointByResponse: Map<string, TerritorialGeoAssignmentPoint>,
) {
  const countsByBlock = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const responsible = territorialAuditResponsibleLabel(row);
    if (isMissingAuditResponsible(responsible)) return;
    const assignment = resolveTerritorialGeoAssignment(row, blocks, pointByResponse.get(row.response_id));
    if (!assignment.block) return;
    territorialAuditBlockLookupKeys(assignment.block).forEach((key) => {
      const counts = countsByBlock.get(key) ?? new Map<string, number>();
      counts.set(responsible, (counts.get(responsible) ?? 0) + 1);
      countsByBlock.set(key, counts);
    });
  });
  const responsibleByBlock = new Map<string, string>();
  countsByBlock.forEach((counts, key) => {
    const selected = Array.from(counts.entries()).sort((a, b) => {
      const countDelta = b[1] - a[1];
      if (countDelta !== 0) return countDelta;
      return a[0].localeCompare(b[0], "es-PE");
    })[0]?.[0];
    if (selected) responsibleByBlock.set(key, selected);
  });
  return responsibleByBlock;
}

function territorialAuditResponsibleForBlock(
  block: TerritorialBlockProgress | null | undefined,
  responsibleByAssignedBlock: Map<string, string>,
) {
  if (!block) return "";
  const directResponsible = stringOrEmpty(block.responsable).trim();
  if (directResponsible && !isMissingAuditResponsible(directResponsible)) return directResponsible;
  for (const key of territorialAuditBlockLookupKeys(block)) {
    const responsible = responsibleByAssignedBlock.get(key);
    if (responsible && !isMissingAuditResponsible(responsible)) return responsible;
  }
  return "";
}

function territorialAuditBlockLookupKeys(block: TerritorialBlockProgress) {
  const keys = new Set<string>();
  const stable = territorialAuditBlockStableKey(block);
  if (stable) keys.add(`stable:${stable}`);
  codeVariants(block.id_manzana).forEach((code) => keys.add(`id:${code}`));
  codeVariants([block.ump, block.hoja_num, block.orden_seleccion]).forEach((code) => keys.add(`ump:${code}`));
  return keys;
}

function findAuditTargetBlock(blocks: TerritorialBlockProgress[], target: TerritorialUmpAuditTarget) {
  const targetId = normalizeTerritorialAuditCode(target.blockId);
  const targetUmp = normalizeTerritorialAuditCode(target.ump).replace(/^UMP/, "");
  return blocks.find((block) => {
    if (targetId && territorialAuditBlockIdCodes(block).has(targetId)) return true;
    if (!targetUmp) return false;
    return territorialAuditOperationalCodes(block).has(targetUmp);
  }) ?? null;
}

function findAuditQuotaBlock(
  blocks: NonNullable<MonitoreoTerritorialDashboard["route_quota_progress"]>["blocks"],
  targetBlock: TerritorialBlockProgress,
) {
  return blocks.find((block) => {
    const id = normalizeTerritorialAuditCode(block.id_manzana);
    if (id && territorialAuditBlockIdCodes(targetBlock).has(id)) return true;
    const ump = normalizeTerritorialAuditCode(block.ump).replace(/^UMP/, "");
    return Boolean(ump && territorialAuditOperationalCodes(targetBlock).has(ump));
  }) ?? null;
}

function isSameResponsibleWindowCandidate(
  row: TerritorialResponseAuditRow,
  targetBlock: TerritorialBlockProgress,
  targetResponsibles: Set<string>,
  timeWindow: { min: number; max: number } | null,
) {
  if (!targetResponsibles.size || !timeWindow) return false;
  if (!targetResponsibles.has(territorialAuditResponsibleKey(row))) return false;
  const submittedAt = territorialAuditSubmittedAtMs(row);
  if (submittedAt == null) return false;
  if (submittedAt < timeWindow.min - TEMPORAL_CANDIDATE_PADDING_MS) return false;
  if (submittedAt > timeWindow.max + TEMPORAL_CANDIDATE_PADDING_MS) return false;
  const targetUbigeo = normalizeTerritorialAuditCode(targetBlock.ubigeo);
  const rowUbigeo = normalizeTerritorialAuditCode(row.advance_block_ubigeo || row.ubigeo || row.district_code);
  if (targetUbigeo && rowUbigeo && targetUbigeo !== rowUbigeo) return false;
  return true;
}

function territorialAuditTimeWindow(rows: TerritorialResponseAuditRow[]) {
  const times = rows.map(territorialAuditSubmittedAtMs).filter((value): value is number => value != null);
  if (!times.length) return null;
  return { min: Math.min(...times), max: Math.max(...times) };
}

function isTerritorialAuditCountableRow(row: TerritorialResponseAuditRow) {
  if (row.source_effective === false) return false;
  if (row.advance_valid === false) return false;
  const status = normalizeTerritorialAuditText(row.status);
  const validation = normalizeTerritorialAuditText(row.validation_status);
  const advance = normalizeTerritorialAuditText(row.advance_status);
  const observation = normalizeTerritorialAuditText(row.observation_status);
  const consent = normalizeTerritorialAuditText(row.consent);
  const blocked = new Set(["no defendible", "no valida", "no valido", "rechazo", "rechazado", "rechazada", "rejected", "disqualified"]);
  if (blocked.has(status) || blocked.has(validation) || blocked.has(advance)) return false;
  if (observation === "no valida") return false;
  if (["0", "no", "false", "rechazo", "rechaza"].includes(consent)) return false;
  return true;
}

function compareTerritorialAuditCases(a: TerritorialUmpAuditCase, b: TerritorialUmpAuditCase) {
  const timeDelta = (a.submittedAtMs ?? Number.MAX_SAFE_INTEGER) - (b.submittedAtMs ?? Number.MAX_SAFE_INTEGER);
  if (timeDelta !== 0) return timeDelta;
  return (a.rowIndex ?? 0) - (b.rowIndex ?? 0);
}

function compareTerritorialAuditCandidates(a: TerritorialUmpAuditCase, b: TerritorialUmpAuditCase) {
  const reasonRank = (candidateReasonRank(a) - candidateReasonRank(b));
  if (reasonRank !== 0) return reasonRank;
  return compareTerritorialAuditCases(a, b);
}

function candidateReasonRank(item: TerritorialUmpAuditCase) {
  if (item.candidateReasons.includes("same_responsible_window")) return 0;
  if (item.candidateReasons.includes("gps_near_target")) return 1;
  return 9;
}

function sameTerritorialAuditBlock(a: TerritorialBlockProgress, b: TerritorialBlockProgress) {
  const aIds = territorialAuditBlockIdCodes(a);
  const bIds = territorialAuditBlockIdCodes(b);
  if (setsIntersect(aIds, bIds)) return true;
  return territorialAuditBlockStableKey(a) === territorialAuditBlockStableKey(b);
}

function territorialAuditBlockIdCodes(block: TerritorialBlockProgress) {
  return codeVariants(block.id_manzana);
}

function territorialAuditOperationalCodes(block: TerritorialBlockProgress) {
  return codeVariants([block.ump, block.hoja_num, block.orden_seleccion])
    .without("UMP");
}

function territorialAuditBlockStableKey(block: TerritorialBlockProgress) {
  return [
    normalizeTerritorialAuditCode(block.ubigeo),
    normalizeTerritorialAuditCode(block.zona),
    normalizeTerritorialAuditCode(block.manzana),
    normalizeTerritorialAuditCode(block.id_manzana),
  ].filter(Boolean).join(":");
}

function codeVariants(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  const out = new Set<string>() as Set<string> & { without: (prefix: string) => Set<string> };
  values.forEach((item) => {
    const normalized = normalizeTerritorialAuditCode(item);
    if (!normalized) return;
    out.add(normalized);
    out.add(stripLeftZeros(normalized));
    const withoutPrefix = normalized.replace(/^(?:UMP|MZ|MANZANA|HOJA)/, "");
    if (withoutPrefix) {
      out.add(withoutPrefix);
      out.add(stripLeftZeros(withoutPrefix));
    }
  });
  out.without = (prefix: string) => {
    const normalizedPrefix = normalizeTerritorialAuditCode(prefix);
    return new Set(Array.from(out).map((item) => item.replace(new RegExp(`^${normalizedPrefix}`), "")).filter(Boolean));
  };
  return out;
}

function setsIntersect(a: Set<string>, b: Set<string>) {
  return Array.from(a).some((item) => b.has(item));
}

function territorialAuditResponsibleLabel(row: TerritorialResponseAuditRow) {
  const assigned = stringOrEmpty(row.enumerator_assigned || row.responsible_display).trim();
  if (assigned && !isMissingAuditResponsible(assigned)) return assigned;
  const code = stringOrEmpty(row.pulso_code || row.pulso_code_raw || row.submitted_by).trim();
  if (code && !isMissingAuditResponsible(code)) return code;
  return "Sin responsable asignado";
}

function territorialAuditResponsibleKey(row: TerritorialResponseAuditRow) {
  return normalizeTerritorialAuditText(territorialAuditResponsibleLabel(row));
}

function isMissingAuditResponsible(value: string) {
  const key = normalizeTerritorialAuditText(value);
  return !key || key === "sd" || key.includes("sin responsable") || key.includes("sin asignar") || key.includes("no identificado");
}

function territorialAuditSubmissionLabel(row: TerritorialResponseAuditRow) {
  const date = stringOrEmpty(row.submission_date).trim() || stringOrEmpty(row.submission_date_iso).trim();
  const hour = stringOrEmpty(row.submission_hour).trim();
  if (date && hour) return `${date} ${hour}`;
  return date || hour || stringOrEmpty(row.submission_datetime || row.submission_time) || `Fila ${row.row_index}`;
}

function territorialAuditSubmittedAtMs(row: TerritorialResponseAuditRow) {
  const candidates = [
    row.submission_datetime,
    row.submission_time,
    [row.submission_date_iso || row.submission_date, row.submission_hour].filter(Boolean).join(" "),
  ].map((item) => String(item ?? "").trim()).filter(Boolean);
  for (const item of candidates) {
    const ms = Date.parse(item);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function territorialAuditSexLabel(value: unknown) {
  const key = normalizeTerritorialAuditText(value);
  if (["1", "h", "hombre", "masculino", "male"].includes(key)) return "H";
  if (["2", "mujer", "femenino", "female", "f"].includes(key)) return "M";
  if (key === "m") return "M";
  return stringOrEmpty(value).trim() || "S/D";
}

function normalizeTerritorialAuditPhase(value: unknown): MonitoreoTerritorialPhase {
  return value === "pilot" ? "pilot" : "field";
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrEmpty(value: unknown) {
  return String(value ?? "");
}

function normalizeTerritorialAuditCode(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeTerritorialAuditText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripLeftZeros(value: string) {
  return value.replace(/^0+/, "") || "0";
}
