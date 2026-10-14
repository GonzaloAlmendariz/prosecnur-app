// Estructura de secciones de Analítica: qué se muestra cuando la config no
// declara secciones, y cuánto se espera a que el backend las detecte.
//
// P-M11 de la ronda de pulido. Al entrar a Datos con `config.secciones`
// vacío, la pestaña autodetectaba la estructura del XLSForm EN SILENCIO y la
// escribía en el store (`setSecciones`), que marca la config como sucia: el
// autosave la mandaba al backend y el proyecto pasaba a «sin guardar» sin que
// el usuario hubiera hecho nada. Además el botón «Detectar estructura» se
// quedaba en «Detectando…» deshabilitado mientras esa petición no volviera.
//
// La regla ahora:
//
// - Una config SIN secciones no es «cero secciones»: el backend
//   (`.secciones_from_config` → NULL) agrupa por la estructura del
//   instrumento. Lo detectado al entrar es una VISTA de ese default, no una
//   decisión: se muestra y no se escribe.
// - Se escribe cuando el usuario decide algo sobre una sección (renombrar,
//   ocultar) o pide «Detectar estructura»: ahí el «sin guardar» es suyo.
// - La detección tiene plazo. Si no vuelve, deja de bloquear y lo dice.

import type { SeccionConfig } from "./store";

/** Plazo de la detección de estructura antes de declararla fallida. */
export const PLAZO_DETECCION_MS = 20_000;

export class PlazoVencidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "PlazoVencidoError";
  }
}

/**
 * Espera `promesa` como mucho `ms`. Si vence antes, rechaza con
 * `PlazoVencidoError`; la petición original sigue su curso, pero quien llamó
 * ya no la espera ni bloquea la interfaz por ella.
 */
export function conPlazo<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PlazoVencidoError(mensaje)), ms);
    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Secciones con las que se pinta Datos: las declaradas si las hay; si no, las
 * detectadas del instrumento (vista del default del backend, sin persistir).
 */
export function seccionesVisibles(
  declaradas: readonly SeccionConfig[],
  detectadas: readonly SeccionConfig[] | null,
): SeccionConfig[] {
  if (declaradas.length > 0) return [...declaradas];
  return detectadas ? [...detectadas] : [];
}

/**
 * Secciones que hay que escribir en la config ANTES de aplicar una decisión
 * del usuario sobre una sección. Con secciones declaradas no hace falta
 * nada (`null`); sin ellas, se materializa lo detectado para que la decisión
 * tenga sobre qué aplicarse.
 */
export function seccionesAMaterializar(
  declaradas: readonly SeccionConfig[],
  detectadas: readonly SeccionConfig[] | null,
): SeccionConfig[] | null {
  if (declaradas.length > 0) return null;
  if (!detectadas || detectadas.length === 0) return null;
  return detectadas.map((seccion, index) => ({ ...seccion, orden: index, manual: seccion.manual ?? false }));
}

/**
 * Funde lo detectado con lo declarado: conserva nombre, visibilidad y orden de
 * las secciones editadas a mano y añade al final las manuales que el
 * instrumento ya no trae.
 */
export function fundirSeccionesDetectadas(
  detectadas: readonly Omit<SeccionConfig, "manual">[],
  declaradas: readonly SeccionConfig[],
): SeccionConfig[] {
  const manualesPorId = new Map(
    declaradas.filter((s) => s.manual).map((s) => [s.id, s]),
  );
  const fundidas: SeccionConfig[] = detectadas.map((seccion, index) => {
    const previa = manualesPorId.get(seccion.id);
    if (previa) return { ...previa, variables: seccion.variables, orden: previa.orden ?? index };
    return { ...seccion, orden: index, manual: false };
  });
  const idsDetectados = new Set(detectadas.map((s) => s.id));
  const huerfanas = declaradas.filter((s) => s.manual && !idsDetectados.has(s.id));
  return [...fundidas, ...huerfanas].map((seccion, index) => ({ ...seccion, orden: index }));
}

/**
 * Resumen de secciones que ve Frecuencias. Sin secciones declaradas el motor
 * usa las del instrumento, así que la pestaña no puede decir «0 activas» ni
 * bloquear la generación por eso (era un vacío por desconexión, C5-3).
 */
export type ResumenSecciones =
  | { modo: "declaradas"; activas: number }
  | { modo: "instrumento" };

export function resumenSecciones(declaradas: readonly SeccionConfig[]): ResumenSecciones {
  if (declaradas.length === 0) return { modo: "instrumento" };
  return { modo: "declaradas", activas: declaradas.filter((s) => !s.oculto).length };
}

/**
 * Variables que entrarán a Frecuencias: las categóricas o declaradas
 * numéricas, no excluidas y, si hay secciones declaradas, dentro de una
 * visible. Sin secciones declaradas cuentan todas (default del motor).
 */
export function variablesAnalizables(
  declaradas: readonly SeccionConfig[],
  variables: readonly { name: string; categorica?: boolean }[],
  excluidas: ReadonlySet<string>,
  numericas: readonly string[],
): number {
  const entra = (name: string, categorica: boolean) =>
    !excluidas.has(name) && (categorica || numericas.includes(name));
  if (declaradas.length === 0) {
    return variables.filter((v) => entra(v.name, Boolean(v.categorica))).length;
  }
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  return declaradas
    .filter((s) => !s.oculto)
    .reduce(
      (suma, s) => suma + s.variables.filter((name) => entra(name, Boolean(porNombre.get(name)?.categorica))).length,
      0,
    );
}
