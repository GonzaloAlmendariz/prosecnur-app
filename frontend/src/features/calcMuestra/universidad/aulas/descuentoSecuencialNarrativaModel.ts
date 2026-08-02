import type { CalcMuestraAulasSelection } from "../../../../api/client";
import { safeNumber } from "../../sharedCore";
import { classroomRowText, rowKeyForCandidates } from "../shared/format";
import { canonicalClassroomOperationalCode } from "./classroomOperationalCode";
import { resolveDiscountMode, rowHasDiscountData, type DiscountMode } from "./descuentoRepetidosModel";

export type DiscountEngineBehavior = DiscountMode | "unknown";

export type DiscountNarrativeStep = {
  row: Record<string, unknown>;
  step: number;
  code: string;
  label: string;
  faculty: string;
  bruto: number | null;
  yaCubiertos: number | null;
  neto: number | null;
  aporteNeto: number | null;
};

export type DiscountNarrative = {
  mode: DiscountMode;
  causal: boolean;
  steps: DiscountNarrativeStep[];
};

export function discountBehaviorForEngine(selectorEngine: unknown): DiscountEngineBehavior {
  const key = String(selectorEngine ?? "").trim().toLowerCase();
  if (["sistematico_pps", "estratificado_aleatorio", "pool_controlado"].includes(key)) return "sequential";
  if (["cube_balanceado", "local_pivotal_balanceado", "manual_auditable", "pps_balanceado"].includes(key)) return "post_hoc";
  return "unknown";
}

function optionalNumber(row: Record<string, unknown>, keys: string[]): number | null {
  return rowKeyForCandidates(row, keys) ? safeNumber(row[keys.find((key) => Object.prototype.hasOwnProperty.call(row, key)) ?? keys[0]], 0) : null;
}

export function buildDiscountNarrative(
  selection: Pick<CalcMuestraAulasSelection, "sequential_discount"> | null | undefined,
  rows: Array<Record<string, unknown>>,
): DiscountNarrative | null {
  const mode = resolveDiscountMode(selection);
  if (!mode) return null;
  const steps = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => rowHasDiscountData(row))
    .map(({ row, index }) => ({
      row,
      step: Math.max(1, optionalNumber(row, ["discount_step"]) ?? index + 1),
      code: canonicalClassroomOperationalCode(
        classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]),
        `CH ${index + 1}`,
      ),
      label: classroomRowText(row, ["course_name", "label", "classroom_id"]) || "Curso-horario",
      faculty: classroomRowText(row, ["faculty", "facultad", "stratum"]),
      bruto: optionalNumber(row, ["eligible_n_bruto", "eligible_n"]),
      yaCubiertos: optionalNumber(row, ["ya_cubiertos"]),
      neto: optionalNumber(row, ["eligible_n_neto"]),
      aporteNeto: optionalNumber(row, ["aporte_neto"]),
    }))
    .sort((a, b) => a.step - b.step);
  if (!steps.length) return null;
  return { mode, causal: mode === "sequential", steps };
}
