/**
 * Modelo del inspector de aula seleccionada (pestaña "Aulas titulares").
 * Helper PURO: lee las filas de la selección del motor (sin cálculos
 * estadísticos nuevos) y arma la vista defendible de un aula: identidad,
 * sorteo (π, peso, rol, método), plan B (cadena de reemplazos o titular) y
 * composición. Campos ausentes se muestran como "—". Los formatos vienen de
 * sharedCore (fmtInt/fmtDec/fmtPct) para no inventar convenciones.
 */
import { fmtDec, fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { classroomRowText, rowValueForCandidates } from "../shared/format";

export const DASH = "—";

export type AulaInspectorRol = "titular" | "reemplazo" | "extra";

export type AulaInspectorEslabon = {
  /** classroom_id del eslabón (para re-apuntar el inspector). */
  id: string;
  /** Código operativo visible (R1.1, R1.2...). */
  code: string;
  label: string;
  equivalencia: string;
  orden: number;
  /** true cuando el eslabón es la fila que se está inspeccionando. */
  activo: boolean;
};

export type AulaInspectorTitularRef = {
  id: string;
  code: string;
  label: string;
};

export type AulaInspectorModel = {
  id: string;
  code: string;
  courseName: string;
  faculty: string;
  program: string;
  level: string;
  schedule: string;
  modality: string;
  teacher: string;
  rol: AulaInspectorRol;
  rolLabel: string;
  wave: string;
  /** Probabilidad de inclusión π con formato % (1 decimal). */
  piText: string;
  /** Peso 1/π con 2 decimales. */
  pesoText: string;
  metodoLabel: string;
  /** Nivel de equivalencia legible (solo reemplazos; "—" en titulares). */
  equivalenciaLabel: string;
  /** Titular al que reemplaza (solo reemplazos). */
  titular: AulaInspectorTitularRef | null;
  /** Cadena de reemplazos del titular (ordenada R.1, R.2...). */
  cadena: AulaInspectorEslabon[];
  elegiblesText: string;
  matriculadosText: string;
  /** Estudiantes únicos aportados; "" cuando el motor no lo reporta. */
  unicosText: string;
  repetidosText: string;
};

/**
 * Etiquetas en español de los niveles de equivalencia que reporta el motor
 * (equivalence_level / match_level). Mismo vocabulario que Reemplazos.
 */
const EQUIVALENCE_LABELS: Record<string, string> = {
  titular: "Titular",
  misma_celda: "Misma celda",
  celda_cercana: "Celda cercana",
  misma_facultad: "Misma facultad",
  mismo_dominio: "Mismo dominio",
  mismo_programa: "Mismo programa",
  cambia_programa: "Cambia programa",
  cambia_carrera: "Cambia carrera",
  cambia_nivel: "Cambia nivel",
  baja_equivalencia: "Baja equivalencia",
  sin_reserva: "Sin reemplazo viable",
};

export function aulaEquivalenceLabel(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return DASH;
  return EQUIVALENCE_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

function textOrDash(row: Record<string, unknown>, keys: string[]) {
  return classroomRowText(row, keys) || DASH;
}

/** Número "honesto": NaN cuando el campo no existe (0 real se conserva). */
function rowNumberOrNaN(row: Record<string, unknown>, keys: string[]) {
  const value = rowValueForCandidates(row, keys);
  return safeNumber(value, Number.NaN);
}

function intOrDash(row: Record<string, unknown>, keys: string[]) {
  const n = rowNumberOrNaN(row, keys);
  return Number.isFinite(n) ? fmtInt(n) : DASH;
}

function waveNumber(wave: string) {
  const match = String(wave ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

export function aulaInspectorRol(row: Record<string, unknown>): AulaInspectorRol {
  const role = classroomRowText(row, ["sample_role"]);
  const wave = classroomRowText(row, ["wave"]);
  if (role === "extra_reserve_pool") return "extra";
  if (role === "titular" || wave === "M1") return "titular";
  if (role === "chain_reserve") return "reemplazo";
  const order = rowNumberOrNaN(row, ["replacement_order"]);
  if (Number.isFinite(order) && order > 0) return "reemplazo";
  const nWave = waveNumber(wave);
  if (Number.isFinite(nWave) && nWave > 1) return "reemplazo";
  return "titular";
}

function replacementCode(row: Record<string, unknown>, fallbackOrder: number) {
  return (
    classroomRowText(row, ["operational_code", "replacement_chain_code"]) ||
    (fallbackOrder > 0 ? `R.${fmtInt(fallbackOrder)}` : DASH)
  );
}

function replacementOrder(row: Record<string, unknown>) {
  const order = rowNumberOrNaN(row, ["replacement_order"]);
  if (Number.isFinite(order) && order > 0) return order;
  const nWave = waveNumber(classroomRowText(row, ["wave"]));
  if (Number.isFinite(nWave) && nWave > 1) return nWave - 1;
  return 99;
}

/**
 * Reemplazos ligados a un titular: por replacement_for (classroom_id del
 * titular) o, si el motor emitió slots, por selection_slot_id compartido.
 */
function reservesForTitular(
  selectionRows: Array<Record<string, unknown>>,
  titularId: string,
  titularSlotId: string,
) {
  return selectionRows
    .filter((row) => aulaInspectorRol(row) === "reemplazo")
    .filter((row) => {
      const forId = classroomRowText(row, ["replacement_for"]);
      if (forId) return forId === titularId;
      const slot = classroomRowText(row, ["selection_slot_id"]);
      return Boolean(titularSlotId && slot && slot === titularSlotId);
    })
    .sort((a, b) => replacementOrder(a) - replacementOrder(b));
}

function titularRowFor(
  reemplazo: Record<string, unknown>,
  selectionRows: Array<Record<string, unknown>>,
) {
  const titularId = classroomRowText(reemplazo, ["replacement_for"]);
  const slotId = classroomRowText(reemplazo, ["selection_slot_id"]);
  return (
    selectionRows.find(
      (row) =>
        aulaInspectorRol(row) === "titular" &&
        Boolean(titularId) &&
        classroomRowText(row, ["classroom_id"]) === titularId,
    ) ??
    selectionRows.find(
      (row) =>
        aulaInspectorRol(row) === "titular" &&
        Boolean(slotId) &&
        classroomRowText(row, ["selection_slot_id"]) === slotId,
    ) ??
    null
  );
}

function eslabonFrom(row: Record<string, unknown>, activeId: string): AulaInspectorEslabon {
  const orden = replacementOrder(row);
  const id = classroomRowText(row, ["classroom_id"]);
  return {
    id,
    code: replacementCode(row, orden === 99 ? 0 : orden),
    label: textOrDash(row, ["course_name", "label", "classroom_id"]),
    equivalencia: aulaEquivalenceLabel(classroomRowText(row, ["equivalence_level"])),
    orden,
    activo: Boolean(activeId) && id === activeId,
  };
}

export function buildAulaInspectorModel({
  row,
  selectionRows,
  methodLabel,
}: {
  row: Record<string, unknown>;
  selectionRows: Array<Record<string, unknown>>;
  /** Método de selección usado (viene del nivel selección del motor). */
  methodLabel?: string;
}): AulaInspectorModel {
  const id = classroomRowText(row, ["classroom_id"]);
  const rol = aulaInspectorRol(row);
  const wave = classroomRowText(row, ["wave"]);
  const slotId = classroomRowText(row, ["selection_slot_id"]);

  const pi = rowNumberOrNaN(row, ["pi_final", "pi_design", "pi_base"]);
  const peso = rowNumberOrNaN(row, ["weight_classroom", "peso_base"]);

  let rolLabel = DASH;
  let titular: AulaInspectorTitularRef | null = null;
  let cadena: AulaInspectorEslabon[] = [];
  let equivalenciaLabel = DASH;

  if (rol === "titular") {
    rolLabel = wave ? `Titular ${wave}` : "Titular";
    cadena = reservesForTitular(selectionRows, id, slotId).map((reserve) => eslabonFrom(reserve, ""));
  } else if (rol === "extra") {
    rolLabel = "Bolsa extra";
  } else {
    const code = classroomRowText(row, ["replacement_chain_code", "operational_code"]);
    const orden = replacementOrder(row);
    rolLabel = `Reemplazo ${code || (orden !== 99 ? `R.${fmtInt(orden)}` : "")}`.trim();
    equivalenciaLabel = aulaEquivalenceLabel(classroomRowText(row, ["equivalence_level"]));
    const titularRow = titularRowFor(row, selectionRows);
    if (titularRow) {
      const titularId = classroomRowText(titularRow, ["classroom_id"]);
      titular = {
        id: titularId,
        code:
          classroomRowText(titularRow, ["operational_code"]) ||
          classroomRowText(row, ["titular_operational_code"]) ||
          DASH,
        label: textOrDash(titularRow, ["course_name", "label", "classroom_id"]),
      };
      cadena = reservesForTitular(
        selectionRows,
        titularId,
        classroomRowText(titularRow, ["selection_slot_id"]),
      ).map((reserve) => eslabonFrom(reserve, id));
    } else {
      const titularCode = classroomRowText(row, ["titular_operational_code"]);
      titular = titularCode ? { id: "", code: titularCode, label: DASH } : null;
    }
  }

  const unicos = rowNumberOrNaN(row, ["unique_added", "unique_students", "unique_students_n"]);
  const repetidos = rowNumberOrNaN(row, ["duplicate_overlap", "titular_overlap", "active_overlap"]);

  return {
    id: id || DASH,
    code:
      classroomRowText(row, ["operational_code", "replacement_chain_code"]) ||
      (rol === "titular" ? "AULA" : DASH),
    courseName: textOrDash(row, ["course_name", "label", "classroom_id"]),
    faculty: textOrDash(row, ["faculty", "stratum"]),
    program: textOrDash(row, ["program"]),
    level: classroomRowText(row, ["level"]),
    schedule: textOrDash(row, ["schedule"]),
    modality: classroomRowText(row, ["modality"]),
    teacher: classroomRowText(row, ["teacher"]),
    rol,
    rolLabel,
    wave,
    piText: Number.isFinite(pi) ? fmtPct(pi) : DASH,
    pesoText: Number.isFinite(peso) && peso > 0 ? fmtDec(peso, 2) : DASH,
    metodoLabel: String(methodLabel ?? "").trim() || DASH,
    equivalenciaLabel,
    titular,
    cadena,
    elegiblesText: intOrDash(row, ["eligible_n"]),
    matriculadosText: intOrDash(row, ["enrolled_total"]),
    unicosText: Number.isFinite(unicos) ? fmtInt(unicos) : "",
    repetidosText: Number.isFinite(repetidos) ? fmtInt(repetidos) : DASH,
  };
}
