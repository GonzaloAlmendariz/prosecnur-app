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
  | "desfasada";

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
  return revisionAplicada === revisionActual ? "al-dia" : "desfasada";
}

export function avisoDeclaracionAplicada(estado: EstadoDeclaracionAplicada): string {
  switch (estado) {
    case "desfasada":
      return "Las equivalencias cambiaron después de armar estas láminas. "
        + "El plan no se actualiza solo para no perder lo que hayas editado a mano: "
        + "vuelve a proponer el mazo desde Planes → Equivalencias si quieres los cambios.";
    case "declaracion-retirada":
      return "Estas láminas salieron de una declaración de equivalencias que ya no existe. "
        + "Siguen funcionando, pero no hay con qué contrastarlas.";
    default:
      return "";
  }
}
