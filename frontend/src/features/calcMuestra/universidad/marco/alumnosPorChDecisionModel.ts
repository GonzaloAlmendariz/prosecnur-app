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
  {
    id: "min_mediana_media",
    label: "mín(mediana, media)",
    detail: "El menor de los dos centros: es el estadístico que aplicó el diseño de 2025.",
  },
];

/**
 * Etiqueta legible de un método.
 *
 * Existe porque el id viaja en la decisión firmada y en la auditoría del
 * cálculo, y dos superficies lo imprimían crudo. Con `p25` colaba; con
 * `min_mediana_media` sería jerga del motor puesta delante del analista.
 *
 * Un id ausente devuelve cadena vacía —la celda de la auditoría ya se pintaba
 * así— y uno desconocido se muestra tal cual: preferimos un id feo a una celda
 * en blanco que borre la trazabilidad de lo que el motor usó.
 */
export function etiquetaAlumnosPorChMetodo(id: string | null | undefined): string {
  if (!id) return "";
  return ALUMNOS_POR_CH_METHODS.find((method) => method.id === id)?.label ?? id;
}

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

/**
 * Método utilizable de verdad.
 *
 * Una decisión heredada o a medio guardar llega con `estadistico_default: ""`.
 * Como es cadena vacía y no `undefined`, el `?? "p25"` de la superficie no caía
 * al recomendado: el método quedaba vacío, ninguna facultad resolvía valor y el
 * botón «Confirmar decisión» se deshabilitaba **para siempre** — justo el botón
 * que habría reparado el estado. Trampa que se perpetúa sola.
 */
export function esMetodoAlumnosPorChValido(
  value: unknown,
): value is CalcMuestraAlumnosPorChMethod {
  return ALUMNOS_POR_CH_METHODS.some((method) => method.id === value);
}

/** Método de arranque: el guardado solo si sirve; si no, el recomendado. */
/**
 * Método que la pestaña PROPONE cuando el estudio todavía no decidió nada.
 *
 * Es `min_mediana_media` por decisión de Gonzalo —«usa mín(mediana, media) por
 * defecto y déjalo cambiable por facultad»— y porque es el estadístico que
 * aplicó el diseño de 2025: la hoja «TD Estudiantes» lo llama «Mínimo entre
 * mediana y media». Antes proponía `p25`, que es más conservador todavía y no
 * coincide con el precedente.
 *
 * Sólo es una PROPUESTA: la decisión sigue exigiendo la firma del analista
 * (`confirmado_at`), y hasta que la firme el motor calcula con el promedio
 * global avisándolo en cada facultad.
 */
export function metodoAlumnosPorChInicial(
  guardado: unknown,
): CalcMuestraAlumnosPorChMethod {
  return esMetodoAlumnosPorChValido(guardado) ? guardado : "min_mediana_media";
}

export function missingAlumnosPorChFaculties(
  snapshot: CalcMuestraAlumnosPorCh,
  defaultMethod: CalcMuestraAlumnosPorChMethod,
  overrides: Readonly<Record<string, CalcMuestraAlumnosPorChMethod>>,
): string[] {
  return snapshot.filas
    .filter((row) => row.row_kind === "faculty")
    // Una facultad sin CH elegibles no tiene distribución de la que salga un
    // estadístico, y tampoco aporta unidades a la muestra: exigirle una decisión
    // bloqueaba la confirmación —y con ella todo el cálculo aguas abajo— por
    // facultades que no participan. Medido en el instrumento: dos facultades con
    // 0 de 852 y 0 de 10 CH dejaban la decisión inconfirmable para siempre.
    .filter((row) => (row.elegible?.n_ch ?? 0) > 0)
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
