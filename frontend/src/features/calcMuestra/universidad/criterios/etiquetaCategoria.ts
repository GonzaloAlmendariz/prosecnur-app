/**
 * S7/T1 · Una categoría es una sola cosa.
 *
 * La fuente institucional concatena varios valores en una sola etiqueta:
 * `TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)` son tres tipos de sesión e
 * `INGRESO(EV.TAL,1OP,CEPR,ITS,PAEE,BACH,EX.ING)` son siete condiciones de
 * matrícula. La UI las mostraba crudas, como si fueran una categoría, y quien
 * decide no podía saber que al marcar una estaba marcando siete.
 *
 * Este helper **no cambia el dato**: la clave, el conteo y el valor siguen
 * siendo los del motor. Solo lee la etiqueta y declara lo que ya dice, para que
 * la pantalla pueda rotular la agrupación en vez de esconderla.
 */
export type EtiquetaCategoria = {
  /** Lo que se muestra como nombre de la categoría. */
  base: string;
  /** Valores que la etiqueta agrupa. Vacío cuando la categoría es una sola. */
  agrupadas: string[];
};

const SEPARADOR = /\s*,\s*/;

function limpiar(valor: string): string {
  return valor.trim();
}

export function analizarEtiquetaCategoria(label: string): EtiquetaCategoria {
  const texto = limpiar(label ?? "");
  if (!texto) return { base: texto, agrupadas: [] };

  // Forma `BASE(a,b,c)`: la base nombra el grupo y el paréntesis lo enumera.
  // El paréntesis tiene que cerrar al final y contener al menos una coma; si no,
  // es parte del nombre (`POR INCORPORACION (ESC.GRADUADOS Y DIPLOMAS)`).
  const conParentesis = /^(.*?)\s*\(([^()]*)\)$/.exec(texto);
  if (conParentesis) {
    const base = limpiar(conParentesis[1]);
    const dentro = conParentesis[2];
    if (base && dentro.includes(",")) {
      const partes = dentro.split(SEPARADOR).map(limpiar).filter(Boolean);
      if (partes.length > 1) {
        // La base suele repetirse dentro del paréntesis; se conserva una vez.
        const agrupadas = [base, ...partes].filter(
          (valor, indice, todos) => todos.indexOf(valor) === indice,
        );
        return { base, agrupadas };
      }
    }
    return { base: texto, agrupadas: [] };
  }

  // Forma `a,b,c` sin base: la etiqueta es la lista.
  if (texto.includes(",")) {
    const partes = texto.split(SEPARADOR).map(limpiar).filter(Boolean);
    if (partes.length > 1) return { base: partes[0], agrupadas: partes };
  }

  return { base: texto, agrupadas: [] };
}
