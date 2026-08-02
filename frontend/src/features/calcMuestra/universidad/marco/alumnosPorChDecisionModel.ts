import {
  alumnosPorChValue,
  type CalcMuestraAlumnosPorCh,
  type CalcMuestraAlumnosPorChDecision,
  type CalcMuestraAlumnosPorChMethod,
} from "../../../../api/calcMuestraAlumnosPorCh";

export const ALUMNOS_POR_CH_METHODS: ReadonlyArray<{
  id: CalcMuestraAlumnosPorChMethod;
  label: string;
  detail: string;
}> = [
  { id: "p25", label: "P25", detail: "Conservador: una cuarta parte de los CH tiene este valor o menos." },
  { id: "mediana", label: "Mediana", detail: "Centro robusto: divide los CH elegibles en dos mitades." },
  { id: "media", label: "Media", detail: "Promedio: sensible a CH excepcionalmente grandes." },
];

export function effectiveAlumnosPorChMethod(
  facultyKey: string,
  defaultMethod: CalcMuestraAlumnosPorChMethod,
  overrides: Readonly<Record<string, CalcMuestraAlumnosPorChMethod>>,
): CalcMuestraAlumnosPorChMethod {
  return overrides[facultyKey] ?? defaultMethod;
}

export function normalizeAlumnosPorChOverrides(
  defaultMethod: CalcMuestraAlumnosPorChMethod,
  overrides: Readonly<Record<string, CalcMuestraAlumnosPorChMethod>>,
): Record<string, CalcMuestraAlumnosPorChMethod> {
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(([, method]) => method !== defaultMethod)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function missingAlumnosPorChFaculties(
  snapshot: CalcMuestraAlumnosPorCh,
  defaultMethod: CalcMuestraAlumnosPorChMethod,
  overrides: Readonly<Record<string, CalcMuestraAlumnosPorChMethod>>,
): string[] {
  return snapshot.filas
    .filter((row) => row.row_kind === "faculty")
    .filter((row) => alumnosPorChValue(
      row.elegible,
      effectiveAlumnosPorChMethod(row.faculty_key, defaultMethod, overrides),
    ) === null)
    .map((row) => row.faculty_label);
}

export function alumnosPorChDecisionIsCurrent(
  snapshot: CalcMuestraAlumnosPorCh | null,
  decision: CalcMuestraAlumnosPorChDecision | null,
): boolean {
  if (!snapshot || !decision || snapshot.frame_hash !== decision.frame_hash) return false;
  return missingAlumnosPorChFaculties(
    snapshot,
    decision.estadistico_default,
    decision.por_facultad,
  ).length === 0;
}

export function alumnosPorChDraftMatchesDecision(
  snapshot: CalcMuestraAlumnosPorCh | null,
  decision: CalcMuestraAlumnosPorChDecision | null,
  defaultMethod: CalcMuestraAlumnosPorChMethod,
  overrides: Readonly<Record<string, CalcMuestraAlumnosPorChMethod>>,
): boolean {
  if (!alumnosPorChDecisionIsCurrent(snapshot, decision) ||
      decision?.estadistico_default !== defaultMethod) return false;
  const draft = normalizeAlumnosPorChOverrides(defaultMethod, overrides);
  const saved = normalizeAlumnosPorChOverrides(defaultMethod, decision.por_facultad);
  const keys = Object.keys(draft);
  return keys.length === Object.keys(saved).length &&
    keys.every((key) => draft[key] === saved[key]);
}
