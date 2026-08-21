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
    // Gonzalo: «el título debería ser mínimo entre media y mediana, y no
    // debería estar jergoso como "es el que se aplicó en 2025"; simplemente
    // explicar a qué se refiere».
    label: "Mínimo entre media y mediana",
    detail: "Toma el menor de los dos: si la media sube por unos pocos CH grandes, manda la mediana.",
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

/**
 * Método que la pestaña PROPONE cuando el estudio todavía no decidió nada.
 *
 * Es `p25`, y esto CORRIGE un default anterior.
 *
 * Historia, porque importa para no volver atrás: durante un tiempo propuso
 * `min_mediana_media`, apoyándose en una indicación de Gonzalo («usa
 * mín(mediana, media) por defecto y déjalo cambiable por facultad») y en que
 * es el estadístico que nombra la hoja «TD Estudiantes» de 2025. El
 * 2026-08-21 lo corrigió sin ambigüedad: «el valor por defecto que calculamos
 * aquí es el primer cuartil, es el P25 y SIEMPRE es el P25, a menos que una
 * persona decida utilizar otro indicador».
 *
 * Y el default anterior contradecía a la propia pantalla, que marca P25 como
 * RECOMENDADO y ofrece un botón «Restablecer P25»: quien abría la pestaña,
 * leía la recomendación, no tocaba nada y confirmaba, se llevaba el estadístico
 * que NO era. Medido en un proyecto real: con mín(mediana, media) el divisor de
 * EE.GG. Letras es 49,5 y con P25 es 25,0 — casi el doble de aulas.
 *
 * Sólo es una PROPUESTA: la decisión sigue exigiendo la firma del analista
 * (`confirmado_at`), y un estudio que ya guardó su método conserva el suyo.
 */
export function metodoAlumnosPorChInicial(
  guardado: unknown,
): CalcMuestraAlumnosPorChMethod {
  return esMetodoAlumnosPorChValido(guardado) ? guardado : "p25";
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
