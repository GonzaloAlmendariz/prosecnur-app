import { fmtInt } from "../../sharedCore";
import { UNIVERSITY_AULAS_SELECTOR_OPTIONS } from "../shared/constants";
import { classroomRowNumber, classroomRowText } from "../shared/format";

export function classroomNumberText(row: Record<string, unknown>, keys: string[]) {
  const n = classroomRowNumber(row, keys);
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) >= 100 ? fmtInt(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

export function classroomMethodLabel(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.label ?? methodId;
}

export function classroomMethodReason(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.detail ??
    "Método auditable registrado en la bitácora metodológica.";
}

export function classroomProbabilitySourceLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Diseño probabilístico base";
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    prescribed_design: "Diseño definido por el cálculo",
    design: "Diseño probabilístico base",
    base_design: "Diseño probabilístico base",
    pps: "PPS sistemático",
    pps_systematic: "PPS sistemático",
    balanced_probability: "Balance probabilístico",
    probability_with_operational_optimization: "Optimización con probabilidad auditada",
    simulation: "Simulación de probabilidades",
    simulated: "Simulación de probabilidades",
    monte_carlo: "Simulación Monte Carlo",
    monte_carlo_after_optimization: "Simulación Monte Carlo tras optimización",
  };
  return labels[key] ?? raw.replace(/_/g, " ");
}

export function classroomScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  // Formato único "N/100" para todos los puntajes, vengan en escala 0-1 o 0-100,
  // para que un score de 0 no se lea distinto ("0%") al resto de tarjetas.
  const score = value >= 0 && value <= 1 ? value * 100 : value;
  return `${Math.round(score)}/100`;
}

export function selectorFieldLabel(field: string) {
  const labels: Record<string, string> = {
    faculty: "facultad",
    sex_top_1: "sexo esperado",
    size_group: "tamaño del curso-horario",
  };
  return labels[field] ?? field;
}

/** Variante capitalizada para celdas de tabla (QA H4: nada de `faculty` crudo). */
export function selectorFieldLabelTitulo(field: string) {
  const label = selectorFieldLabel(field);
  return label ? label.charAt(0).toLocaleUpperCase("es") + label.slice(1) : label;
}

export function classroomWaveNumber(wave: string) {
  const match = String(wave ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

export function classroomPlanLabel(row: Record<string, unknown>) {
  const role = classroomRowText(row, ["sample_role"]);
  const wave = classroomRowText(row, ["wave"]);
  if (role === "titular" || wave === "M1") return "Titular";
  if (role === "extra_reserve_pool") return "Extra";
  const order = classroomRowNumber(row, ["replacement_order"]);
  if (order > 0) return `Reemplazo ${fmtInt(order)}`;
  const waveNumber = classroomWaveNumber(wave);
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return wave || "Plan";
}

export function classroomOperationalCode(row: Record<string, unknown>, fallback: string) {
  const raw = classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]) || fallback;
  return raw.replace(/^AULA\b/i, "CH");
}
