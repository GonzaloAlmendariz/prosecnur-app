import type { TerritorialBlockProgress, TerritorialResponseAuditRow } from "../../api/client";

export type TerritorialGeoAssignmentSource =
  | "advance_block_id"
  | "advance_block_tuple"
  | "advance_block_ump"
  | "declared_ump"
  | "none";

export type TerritorialGeoAssignmentPoint = Partial<Pick<TerritorialResponseAuditRow, "nearest_block_id">>;

export type TerritorialGeoAssignmentResult = {
  block: TerritorialBlockProgress | null;
  source: TerritorialGeoAssignmentSource;
  nearestBlock: TerritorialBlockProgress | null;
  nearestDiffers: boolean;
  nearestMatchesAssigned: boolean;
};

const EMPTY_CODE_VALUES = new Set(["NA", "NAN", "NULL", "NONE", "SD", "SINDATO", "SINDATOS"]);

export function resolveTerritorialGeoAssignment(
  row: Partial<TerritorialResponseAuditRow>,
  blocks: TerritorialBlockProgress[],
  point?: TerritorialGeoAssignmentPoint,
): TerritorialGeoAssignmentResult {
  const nearestBlock = findBlockById(blocks, row.nearest_block_id || point?.nearest_block_id);
  const resolved = resolveDeclaredBlock(row, blocks);
  const block = resolved.block;
  const nearestMatchesAssigned = Boolean(block && nearestBlock && sameBlock(block, nearestBlock));
  return {
    block,
    source: resolved.source,
    nearestBlock,
    nearestDiffers: Boolean(block && nearestBlock && !sameBlock(block, nearestBlock)),
    nearestMatchesAssigned,
  };
}

function resolveDeclaredBlock(
  row: Partial<TerritorialResponseAuditRow>,
  blocks: TerritorialBlockProgress[],
): Pick<TerritorialGeoAssignmentResult, "block" | "source"> {
  const byAdvanceId = findBlockById(blocks, row.advance_block_id);
  if (byAdvanceId) return { block: byAdvanceId, source: "advance_block_id" };

  const byTuple = findBlockByTuple(blocks, row);
  if (byTuple) return { block: byTuple, source: "advance_block_tuple" };

  const byAdvanceUmp = findBlockByOperationalCode(blocks, [row.advance_block_ump], [
    row.advance_block_ubigeo,
    row.ubigeo,
    row.district_code,
  ]);
  if (byAdvanceUmp) return { block: byAdvanceUmp, source: "advance_block_ump" };

  const byDeclaredUmp = findBlockByOperationalCode(blocks, [row.declared_ump_normalized, row.declared_ump_raw], [
    row.advance_block_ubigeo,
    row.ubigeo,
    row.district_code,
  ]);
  if (byDeclaredUmp) return { block: byDeclaredUmp, source: "declared_ump" };

  return { block: null, source: "none" };
}

function findBlockById(blocks: TerritorialBlockProgress[], value: unknown) {
  const ids = assignmentCodeVariants(value);
  if (!ids.length) return null;
  return blocks.find((block) => blockIdCodes(block).some((id) => ids.includes(id))) ?? null;
}

function findBlockByTuple(blocks: TerritorialBlockProgress[], row: Partial<TerritorialResponseAuditRow>) {
  const zones = assignmentCodeSet([row.advance_block_zona]);
  const manzanas = assignmentCodeSet([row.advance_block_manzana]);
  if (!zones.size || !manzanas.size) return null;
  const ubigeos = assignmentCodeSet([row.advance_block_ubigeo, row.ubigeo, row.district_code]);
  return blocks.find((block) => {
    if (ubigeos.size && !codesIntersect(ubigeos, assignmentCodeSet([block.ubigeo]))) return false;
    return codesIntersect(zones, assignmentCodeSet([block.zona]))
      && codesIntersect(manzanas, assignmentCodeSet([block.manzana]));
  }) ?? null;
}

function findBlockByOperationalCode(
  blocks: TerritorialBlockProgress[],
  values: unknown[],
  ubigeoValues: unknown[],
) {
  const wanted = assignmentCodeSet(values);
  if (!wanted.size) return null;
  const ubigeos = assignmentCodeSet(ubigeoValues);
  const matches = blocks.filter((block) => {
    if (ubigeos.size && !codesIntersect(ubigeos, assignmentCodeSet([block.ubigeo]))) return false;
    return codesIntersect(wanted, assignmentCodeSet(blockOperationalValues(block)));
  });
  return matches.find((block) => block.tipo_manzana !== "reemplazo") ?? matches[0] ?? null;
}

function blockOperationalValues(block: TerritorialBlockProgress) {
  return [block.ump, block.hoja_num, block.orden_seleccion];
}

function blockIdCodes(block: TerritorialBlockProgress) {
  return assignmentCodeVariants(block.id_manzana);
}

function sameBlock(a: TerritorialBlockProgress, b: TerritorialBlockProgress) {
  const aId = assignmentCodeSet([a.id_manzana]);
  const bId = assignmentCodeSet([b.id_manzana]);
  if (aId.size && bId.size && codesIntersect(aId, bId)) return true;
  return blockStableKey(a) === blockStableKey(b);
}

function blockStableKey(block: TerritorialBlockProgress) {
  return [
    normalizeTerritorialAssignmentCode(block.ubigeo),
    normalizeTerritorialAssignmentCode(block.zona),
    normalizeTerritorialAssignmentCode(block.manzana),
    normalizeTerritorialAssignmentCode(block.id_manzana),
  ].filter(Boolean).join(":");
}

function assignmentCodeSet(values: unknown[]) {
  const out = new Set<string>();
  values.forEach((value) => {
    assignmentCodeVariants(value).forEach((variant) => out.add(variant));
  });
  return out;
}

function codesIntersect(a: Set<string>, b: Set<string>) {
  return Array.from(a).some((value) => b.has(value));
}

function assignmentCodeVariants(value: unknown) {
  const normalized = normalizeTerritorialAssignmentCode(value);
  const variants = new Set<string>();
  if (!normalized || EMPTY_CODE_VALUES.has(normalized)) return [];
  variants.add(normalized);
  variants.add(stripLeftZeros(normalized));
  const withoutCommonPrefix = normalized.replace(/^(?:UMP|MZ|MANZANA|HOJA)/, "");
  if (withoutCommonPrefix && withoutCommonPrefix !== normalized) {
    variants.add(withoutCommonPrefix);
    variants.add(stripLeftZeros(withoutCommonPrefix));
  }
  return Array.from(variants).filter((variant) => variant && !EMPTY_CODE_VALUES.has(variant));
}

function normalizeTerritorialAssignmentCode(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function stripLeftZeros(value: string) {
  return value.replace(/^0+/, "") || "0";
}
