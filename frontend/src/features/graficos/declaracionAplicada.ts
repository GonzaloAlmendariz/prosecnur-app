/**
 * ¿El mazo aplicado sigue correspondiendo a la declaración de equivalencias?
 *
 * El ADR 0063 acepta que la propuesta envejezca —tras aplicar el mazo, editar la
 * declaración no lo actualiza— a cambio de que la diferencia sea **visible en
 * vez de sospechada**. La alternativa, regenerar el plan solo, destruiría las
 * ediciones manuales sin dejar rastro.
 *
 * Vive aparte del render porque el estado que importa es una combinación de
 * cosas que no se pueden reproducir a mano en el navegador: un plan aplicado
 * desde una revisión concreta y una declaración que cambió después.
 */

export type EstadoDeclaracionAplicada =
  /** El plan no salió de la declaración: no hay nada que comparar. */
  | "sin-mazo-derivado"
  /** El mazo salió de la declaración y la declaración ya no existe. */
  | "declaracion-retirada"
  | "al-dia"
  | "desfasada"
  /**
   * ADR 0096 decisión 5: el mazo se aplicó con una revisión de otro formato (sin prefijo `r2:`) que la de ahora. No
   * hay con qué comparar: llamarlo desfase sería una alarma falsa en todo proyecto abierto tras actualizar.
   */
  | "revision-anterior";

/** Prefijo de la revisión de la declaración vigente (ADR 0096). */
export const PREFIJO_REVISION_DECLARACION = "r2:";

const formatoRevision = (revision: string) => (revision.startsWith(PREFIJO_REVISION_DECLARACION) ? "r2" : "r1");

export function estadoDeclaracionAplicada({
  revisionAplicada,
  revisionActual,
  declarada,
}: {
  /** Revisión grabada al aplicar el mazo; vacía si el plan no vino de ahí. */
  revisionAplicada: string;
  /** Revisión de la declaración de ahora. */
  revisionActual: string;
  declarada: boolean;
}): EstadoDeclaracionAplicada {
  if (!revisionAplicada) return "sin-mazo-derivado";
  if (!declarada || !revisionActual) return "declaracion-retirada";
  if (formatoRevision(revisionAplicada) !== formatoRevision(revisionActual)) return "revision-anterior";
  return revisionAplicada === revisionActual ? "al-dia" : "desfasada";
}

export function avisoDeclaracionAplicada(estado: EstadoDeclaracionAplicada): string {
  switch (estado) {
    case "desfasada":
      return "Las equivalencias cambiaron después de armar estas diapositivas. "
        + "El plan no se actualiza solo para no perder lo que hayas editado a mano: "
        + "vuelve a proponer el mazo desde Planes → Equivalencias si quieres los cambios.";
    case "declaracion-retirada":
      return "Estas diapositivas salieron de una declaración de equivalencias que ya no existe. "
        + "Siguen funcionando, pero no hay con qué contrastarlas.";
    case "revision-anterior":
      return "Estas diapositivas se armaron con una versión anterior de la app, así que no se pueden contrastar con la "
        + "declaración de equivalencias de ahora. Vuelve a proponer el mazo si quieres que se vigile su desfase.";
    default:
      return "";
  }
}
