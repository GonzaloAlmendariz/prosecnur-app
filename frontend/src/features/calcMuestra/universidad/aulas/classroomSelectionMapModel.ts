import type {
  CalcMuestraAulasReplacementSimulation,
  CalcMuestraAulasReplacementSuggestion,
} from "../../../../api/client";
import { rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowText } from "../shared/format";
import { aulaInspectorRol } from "./aulaInspectorModel";
import { canonicalClassroomOperationalCode } from "./classroomOperationalCode";

export type SelectionMapEquivalence =
  | "misma_celda"
  | "celda_equivalente"
  | "misma_facultad"
  | "desconocido";

export type SelectionMapNode = {
  id: string;
  code: string;
  label: string;
  /**
   * P3 · docente principal del curso-horario. Sin esto la lista no sirve para
   * coordinar: dice QUÉ curso salió pero no a quién hay que escribirle.
   * "" cuando el marco no lo trae — se declara, no se inventa.
   */
  teacher: string;
  equivalence: SelectionMapEquivalence;
  order: number;
  row: Record<string, unknown>;
};

export type SelectionMapChain = {
  key: string;
  faculty: string;
  titular: SelectionMapNode;
  reserves: SelectionMapNode[];
  sequence: number;
};

export type SelectionMapGroup = {
  key: string;
  faculty: string;
  chains: SelectionMapChain[];
  unlinkedReserves: SelectionMapNode[];
};

export type SelectionMapVirtualRow =
  | { kind: "group"; key: string; group: SelectionMapGroup }
  | { kind: "chain"; key: string; chain: SelectionMapChain }
  | { kind: "unlinked"; key: string; node: SelectionMapNode };

export type ClassroomSelectionMapModel = {
  groups: SelectionMapGroup[];
  virtualRows: SelectionMapVirtualRow[];
  titularCount: number;
  reserveCount: number;
  unlinkedReserveCount: number;
  maxDepth: number;
};

const UNKNOWN_FACULTY = "Facultad no informada";

export function normalizeSelectionMapEquivalence(value: unknown): SelectionMapEquivalence {
  const key = String(value ?? "").trim().toLowerCase();
  if (key === "misma_celda" || key === "celda_equivalente" || key === "misma_facultad") return key;
  return "desconocido";
}

function waveNumber(value: unknown): number {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? safeNumber(match[1], 0) : 0;
}

function codeSequence(value: string, fallback: number): number {
  const match = value.match(/(?:CH|R)\s+(\d+)/i);
  const parsed = match ? safeNumber(match[1], 0) : 0;
  return parsed > 0 ? parsed : fallback;
}

function reserveOrder(row: Record<string, unknown>, suggestion?: CalcMuestraAulasReplacementSuggestion): number {
  const explicit = safeNumber(row.replacement_order, 0) || safeNumber(suggestion?.rank, 0);
  if (explicit > 0) return explicit;
  const wave = waveNumber(row.wave);
  return wave > 1 ? wave - 1 : 0;
}

function facultyFor(row: Record<string, unknown>): string {
  return classroomRowText(row, ["faculty", "facultad", "stratum"]) || UNKNOWN_FACULTY;
}

// La posición en la ruta es el sufijo del código operativo («R 1.3» → 3); el
// campo `order` es el respaldo. Sin ninguno, el nodo va al final sin reordenar.
function reserveRouteIndex(node: SelectionMapNode): number {
  const match = node.code.match(/\.(\d+)\s*$/);
  const parsed = match ? safeNumber(match[1], 0) : 0;
  if (parsed > 0) return parsed;
  return node.order > 0 ? node.order : Number.MAX_SAFE_INTEGER;
}

/** Devuelve exactamente la fila del payload que el botón del mapa inspecciona. */
export function selectionMapInspectionTarget(node: SelectionMapNode): Record<string, unknown> {
  return node.row;
}

/**
 * Índices de una sola pasada + unión explícita por replacement_for/slot/sugerencia.
 * No compara atributos ni infiere equivalencias; la ausencia queda "desconocido".
 */
export function buildClassroomSelectionMap(
  selectionRows: Array<Record<string, unknown>>,
  simulation?: CalcMuestraAulasReplacementSimulation | null,
): ClassroomSelectionMapModel {
  const suggestionsByReserve = new Map<string, CalcMuestraAulasReplacementSuggestion>();
  for (const suggestion of rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions)) {
    if (suggestion.reserve_classroom_id && !suggestionsByReserve.has(suggestion.reserve_classroom_id)) {
      suggestionsByReserve.set(suggestion.reserve_classroom_id, suggestion);
    }
  }

  const chains: SelectionMapChain[] = [];
  const chainByTitularId = new Map<string, SelectionMapChain>();
  const chainBySlot = new Map<string, SelectionMapChain>();
  for (const row of selectionRows) {
    if (aulaInspectorRol(row) !== "titular") continue;
    const index = chains.length + 1;
    const id = classroomRowText(row, ["classroom_id"]);
    const slotId = classroomRowText(row, ["selection_slot_id"]);
    const code = canonicalClassroomOperationalCode(
      classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]),
      `CH ${index}`,
    );
    const chain: SelectionMapChain = {
      key: id || slotId || `titular-${index}`,
      faculty: facultyFor(row),
      titular: {
        id,
        code,
        label: classroomRowText(row, ["course_name", "label", "classroom_id"]) || "Curso-horario titular",
        teacher: classroomRowText(row, ["teacher", "docente", "teacher_name"]),
        equivalence: "misma_celda",
        order: 0,
        row,
      },
      reserves: [],
      sequence: codeSequence(code, index),
    };
    chains.push(chain);
    if (id && !chainByTitularId.has(id)) chainByTitularId.set(id, chain);
    if (slotId && !chainBySlot.has(slotId)) chainBySlot.set(slotId, chain);
  }

  const unlinked: Array<{ faculty: string; node: SelectionMapNode }> = [];
  for (const row of selectionRows) {
    if (aulaInspectorRol(row) !== "reemplazo") continue;
    const id = classroomRowText(row, ["classroom_id"]);
    const suggestion = suggestionsByReserve.get(id);
    const replacementFor = classroomRowText(row, ["replacement_for"]);
    const slotId = classroomRowText(row, ["selection_slot_id"]);
    const chain = chainByTitularId.get(replacementFor) ?? chainBySlot.get(slotId) ??
      chainByTitularId.get(String(suggestion?.titular_classroom_id ?? ""));
    const order = reserveOrder(row, suggestion) || (chain?.reserves.length ?? 0) + 1;
    const code = canonicalClassroomOperationalCode(
      classroomRowText(row, ["operational_code", "replacement_chain_code", "codigo_operativo"]),
      chain ? `R ${chain.sequence}.${order}` : "Reemplazo sin código",
    );
    const explicitEquivalence = suggestion?.match_level || classroomRowText(row, ["equivalence_level", "match_level"]);
    const node: SelectionMapNode = {
      id,
      code,
      label: classroomRowText(row, ["course_name", "label", "classroom_id"]) || "Curso-horario de reemplazo",
      teacher: classroomRowText(row, ["teacher", "docente", "teacher_name"]),
      equivalence: normalizeSelectionMapEquivalence(explicitEquivalence),
      order,
      row,
    };
    if (chain) chain.reserves.push(node);
    else unlinked.push({ faculty: facultyFor(row), node });
  }

  // El payload llega en orden de sorteo, no de ruta; la superficie promete
  // «R n.1 → R n.2 → …», así que la ruta se ordena acá, para TODO consumidor.
  for (const chain of chains) {
    chain.reserves.sort((a, b) => reserveRouteIndex(a) - reserveRouteIndex(b));
  }

  const groupsByFaculty = new Map<string, SelectionMapGroup>();
  const ensureGroup = (faculty: string) => {
    const current = groupsByFaculty.get(faculty);
    if (current) return current;
    const group = { key: `facultad-${groupsByFaculty.size + 1}`, faculty, chains: [], unlinkedReserves: [] };
    groupsByFaculty.set(faculty, group);
    return group;
  };
  for (const chain of chains) ensureGroup(chain.faculty).chains.push(chain);
  for (const orphan of unlinked) ensureGroup(orphan.faculty).unlinkedReserves.push(orphan.node);

  const groups = Array.from(groupsByFaculty.values());
  const virtualRows: SelectionMapVirtualRow[] = [];
  let maxDepth = 0;
  for (const group of groups) {
    virtualRows.push({ kind: "group", key: group.key, group });
    for (const chain of group.chains) {
      maxDepth = Math.max(maxDepth, chain.reserves.length);
      virtualRows.push({ kind: "chain", key: `chain-${chain.key}`, chain });
    }
    for (const node of group.unlinkedReserves) {
      virtualRows.push({ kind: "unlinked", key: `unlinked-${node.id}-${virtualRows.length}`, node });
    }
  }

  return {
    groups,
    virtualRows,
    titularCount: chains.length,
    reserveCount: chains.reduce((total, chain) => total + chain.reserves.length, 0) + unlinked.length,
    unlinkedReserveCount: unlinked.length,
    maxDepth,
  };
}
