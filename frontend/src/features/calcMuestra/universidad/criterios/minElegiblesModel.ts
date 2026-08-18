/**
 * Modelo puro del criterio 7 — mínimos de elegibles por curso-horario con
 * overrides por facultad y sugerencia por inasistencia (reunión con el asesor
 * muestral, 2026-07-15). Sin React ni red; lo consume MinElegiblesCard.
 *
 * Regla de la casa: la tasa de asistencia NUNCA auto-aplica la sugerencia.
 * Aquí solo se CALCULA (ceil(mínimo/tasa)); aplicar es decisión del usuario.
 */
import type { CriteriosSeleccionMarco } from "../../../../api/client";

type MinEligible = NonNullable<CriteriosSeleccionMarco["minEligible"]>;

/** Fragmento minEligible vigente, creándolo con el umbral global si no existe. */
function baseMinEligible(seleccion: CriteriosSeleccionMarco, umbralGlobal: number): MinEligible {
  return seleccion.minEligible ?? { threshold: Math.max(1, Math.round(umbralGlobal)) };
}

/** Tasa de asistencia esperada (proporción 0–1) o null si no está definida. */
export function tasaAsistencia(seleccion: CriteriosSeleccionMarco | null | undefined): number | null {
  const rate = seleccion?.minEligible?.attendance_rate;
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : null;
}

/** Override de una facultad (clave normalizada) o null si hereda el global. */
export function minimoFacultad(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  facultadKey: string,
): number | null {
  const valor = seleccion?.minEligible?.byFaculty?.[facultadKey];
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null;
}

/**
 * Fija (valor ≥ 1) o limpia (null) el mínimo propio de una facultad. Inmutable;
 * un byFaculty que queda vacío se retira para que la selección siga "lean"
 * (mismo criterio de vacíos que la comparación de frescura del marco).
 */
export function setMinimoFacultad(
  seleccion: CriteriosSeleccionMarco,
  facultadKey: string,
  valor: number | null,
  umbralGlobal: number,
): CriteriosSeleccionMarco {
  const base = baseMinEligible(seleccion, umbralGlobal);
  const byFaculty = { ...(base.byFaculty ?? {}) };
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    delete byFaculty[facultadKey];
  } else {
    byFaculty[facultadKey] = Math.max(1, Math.round(valor));
  }
  if (Object.keys(byFaculty).length === 0) {
    const { byFaculty: _vacio, ...rest } = base;
    return { ...seleccion, minEligible: rest };
  }
  return { ...seleccion, minEligible: { ...base, byFaculty } };
}

/**
 * Fija (proporción 0–1) o limpia (null) la tasa de asistencia esperada.
 * Solo informativa: no toca threshold ni byFaculty.
 */
export function setTasaAsistencia(
  seleccion: CriteriosSeleccionMarco,
  tasa: number | null,
  umbralGlobal: number,
): CriteriosSeleccionMarco {
  const base = baseMinEligible(seleccion, umbralGlobal);
  if (tasa == null || !Number.isFinite(tasa) || tasa <= 0) {
    const { attendance_rate: _fuera, ...rest } = base;
    return { ...seleccion, minEligible: rest };
  }
  return { ...seleccion, minEligible: { ...base, attendance_rate: Math.min(1, tasa) } };
}

/**
 * Mínimo SUGERIDO por inasistencia: ceil(mínimo_base / tasa). Con asistencia
 * del 70%, un mínimo de 8 "encuentra" ~6 presentes; para encontrar 8 se
 * sugiere matrícula mínima de 12. null si la tasa no está definida o el
 * mínimo base no es utilizable.
 */
export function minimoSugerido(minimoBase: number, tasa: number | null): number | null {
  if (tasa == null || !Number.isFinite(tasa) || tasa <= 0 || tasa > 1) return null;
  if (!Number.isFinite(minimoBase) || minimoBase <= 0) return null;
  return Math.ceil(minimoBase / tasa);
}

/** Presentes esperados de un mínimo dado la tasa (mínimo × tasa, redondeado). */
export function presentesEsperados(minimo: number, tasa: number | null): number | null {
  if (tasa == null || !Number.isFinite(tasa) || tasa <= 0) return null;
  if (!Number.isFinite(minimo) || minimo <= 0) return null;
  return Math.round(minimo * tasa);
}

/**
 * El otro umbral: matriculados por curso-horario.
 *
 * Hay DOS mínimos sobre magnitudes anidadas —elegibles ≤ matriculados siempre—
 * y sólo uno se ve en pantalla. Mientras el de elegibles sea el mayor, el de
 * matriculados no recorta nada: exigir 15 elegibles ya implica 15 matriculados.
 * Medido en HSVG2026 con ambos en 15: **ninguna** de las 5.263 aulas cayó sólo
 * por matriculados.
 *
 * Pero en cuanto una facultad baja su mínimo por debajo de él —Artes Escénicas a
 * 10 con matriculados en 15— el invisible pasa a mandar: allí subió de 44 a 57
 * en vez de a las 103 que el mínimo relajado prometía. Sin este aviso, el
 * analista mueve una perilla y otra que no ve se come el efecto.
 */
export type AvisoMatriculados = {
  umbral: number;
  /** Facultades cuyo mínimo propio queda POR DEBAJO del umbral de matriculados. */
  tapadas: { key: string; label: string; minimo: number }[];
};

export function avisoMatriculados(
  seleccion: CriteriosSeleccionMarco | null | undefined,
  facultades: { key: string; label: string }[],
  umbralGeneral: number,
): AvisoMatriculados | null {
  const thr = seleccion?.byVariable?.enrolled_total?.threshold;
  const umbral = typeof thr?.min === "number" && Number.isFinite(thr.min) ? Math.round(thr.min) : null;
  if (umbral == null || umbral <= 0) return null;
  const tapadas = facultades
    .map((f) => ({ ...f, minimo: minimoFacultad(seleccion, f.key) ?? Math.round(umbralGeneral) }))
    .filter((f) => f.minimo < umbral)
    .sort((a, b) => a.minimo - b.minimo);
  if (!tapadas.length) return null;
  return { umbral, tapadas };
}
