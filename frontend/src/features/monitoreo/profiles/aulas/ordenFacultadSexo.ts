/**
 * El orden canónico de cualquier lista facultad × sexo del perfil.
 *
 * Gonzalo, fijando la unidad de lectura: «la vista prioritaria es siempre por
 * facultad y en facultad hombre y mujeres, el cruce de ambos no va separado, o
 * sea no puedo tener hombre de una facultad y mujeres de otra; debe estar
 * ordenado por facultad y en cada facultad por sexo».
 *
 * Ordenar por la magnitud de la celda —que es lo que hacían la tabla de cuotas y
 * el panel de proyección— parte las facultades: en el estudio de 193 aulas,
 * `GESTIÓN Y ALTA DIRECCIÓN · F` salía primera y su `· M` en la cuarta fila,
 * mientras `PSICOLOGÍA · F` y `PSICOLOGÍA · M` quedaban a doce filas de
 * distancia. Con las celdas sueltas compitiendo entre sí, nadie puede leer cómo
 * va UNA facultad, que es la pregunta que la pantalla existe para contestar.
 *
 * **La urgencia no se pierde: cambia de sujeto.** Ya no compiten celdas, compiten
 * facultades — manda la que más pide en total —, y dentro de cada una los dos
 * sexos van siempre juntos y en el mismo orden.
 */

/**
 * El orden de los sexos dentro de una facultad, FIJO en toda la lista.
 *
 * No se ordena por la cifra: si en Derecho fuera Mujeres-Hombres y en Ciencias
 * Hombres-Mujeres, la segunda fila de cada bloque dejaría de significar lo mismo
 * y la lista no se podría leer en vertical. `F` antes que `M` es el orden con el
 * que la base sirve la variable.
 */
export const ORDEN_SEXO: Record<string, number> = { F: 0, M: 1, Mujeres: 0, Hombres: 1 };

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type FilaFacultadSexo = { faculty?: unknown; sex?: unknown };

/**
 * Ordena por facultad y, dentro de cada una, por sexo.
 *
 * @param filas las celdas tal como las publica el motor.
 * @param peso qué hace que una facultad vaya antes que otra; se SUMA sobre sus
 *   celdas y se ordena de mayor a menor. Sin `peso`, las facultades van
 *   alfabéticas — que es lo correcto cuando la lista no tiene urgencia que
 *   ordenar, y evita que el orden dependa de un campo elegido al azar.
 * @returns una copia ordenada; nunca muta la entrada.
 */
export function ordenarPorFacultadYSexo<T extends FilaFacultadSexo>(
  filas: ReadonlyArray<T>,
  peso?: (fila: T) => number,
): T[] {
  const acumulado = new Map<string, number>();
  if (peso) {
    for (const f of filas) {
      const clave = texto(f.faculty);
      acumulado.set(clave, (acumulado.get(clave) ?? 0) + numero(peso(f)));
    }
  }
  return [...filas].sort((a, b) => {
    const fa = texto(a.faculty);
    const fb = texto(b.faculty);
    if (fa !== fb) {
      if (peso) {
        const pa = acumulado.get(fa) ?? 0;
        const pb = acumulado.get(fb) ?? 0;
        if (pa !== pb) return pb - pa;
      }
      return fa.localeCompare(fb, "es");
    }
    const sa = texto(a.sex);
    const sb = texto(b.sex);
    const oa = ORDEN_SEXO[sa] ?? 9;
    const ob = ORDEN_SEXO[sb] ?? 9;
    if (oa !== ob) return oa - ob;
    return sa.localeCompare(sb, "es");
  });
}
