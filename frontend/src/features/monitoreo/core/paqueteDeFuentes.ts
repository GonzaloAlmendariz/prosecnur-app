// Cuántas piezas exige el paquete de fuentes de un modo.
//
// El modo telefónico exige tres —universo, barrido y encuesta— y ese tres
// estaba escrito a mano en nueve sitios entre los dos perfiles: la franja de
// estado, los botones de sincronización, el corte, el chrome y el vacío. Cada
// superficie derivaba su propio «N/3» y ninguna sabía de las otras.
//
// Mientras el número no cambia, nueve copias iguales no hacen daño visible; el
// día que cambie —una pieza más, o un modo que no exija el barrido— divergen de
// una en una y cada pantalla afirma una cardinalidad distinta bajo la misma
// etiqueta. Es el patrón que ya nos costó un corte: dos superficies leyendo
// distinto el mismo estado.
//
// Aquí la cardinalidad se CUENTA, no se escribe: es la longitud de la lista de
// piezas. Añadir una pieza al contrato es añadirla a esta lista, y las nueve
// superficies se enteran a la vez.

/**
 * Las piezas del paquete telefónico, en el orden del guion de conexión.
 *
 * Mismas claves que los slots del contrato de fuentes
 * (`buildAcreditacionPhoneSourceContract`), que es de donde sale su
 * significado. La lista no se importa de ahí porque ese modelo vive dentro de
 * un perfil y esto lo consumen los dos; el test del perfil telefónico comprueba
 * que no se hayan separado.
 */
export const PIEZAS_DEL_PAQUETE_TELEFONICO = ["universo", "barrido", "plataforma"] as const;

/**
 * Las fuentes que el paquete pide para estar completo.
 *
 * En telefónico, las piezas del contrato. En los demás modos no hay
 * cardinalidad declarada: el paquete es lo que el estudio haya conectado, así
 * que el total es el número de fuentes declaradas.
 */
export function piezasRequeridas(esTelefonico: boolean, fuentesDeclaradas: number): number {
  return esTelefonico ? PIEZAS_DEL_PAQUETE_TELEFONICO.length : fuentesDeclaradas;
}
