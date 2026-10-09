import type { TotalDeAvanceCuota } from "./avanceCuota";
import { fmt } from "./kpisDeAulas";

/**
 * **Dónde fueron a parar las respuestas que llegaron y no cuentan para ninguna
 * meta**, y el invariante del bloque cuando no cuadra.
 *
 * Nace de un fallo mudo medido el 2026-09-17: el motor publica cuatro bolsas
 * —`fuera_universo`, `huerfanas`, `sin_eje`, `duplicadas`— y el invariante que
 * las suma, y **ninguna pantalla las pintaba**. Las notas vivían en
 * `AulasAvanceCuota`, que quedó desconectada el 2026-09-09 con autorización de
 * Gonzalo: su panel decía tres veces cifras que ya estaban en la banda de KPIs
 * y en la cinta. Pero de todo lo que aquel panel decía, **esto es lo único que
 * no dice nadie más**, así que baja aquí en vez de resucitarse entero.
 *
 * Por qué junto a la cinta y no en la banda de KPIs. La cinta publica
 * «Muestra 400 · Efectivas 58» y esas 58 son las que caen en una celda; con 64
 * respuestas en la base, quien compare las dos pantallas ve una resta sin
 * explicación. Las seis que faltan son éstas, y su sitio es debajo del número
 * que las echa de menos.
 *
 * Dos tonos opuestos a propósito:
 *
 * - **Las bolsas se dicen siempre que existan.** Son respuestas reales que no
 *   entran en la meta; callarlas hace que esta cifra y la de Procesamiento
 *   parezcan contradecirse. Con el eje en facultad —HSVG— `sin_eje` y
 *   `duplicadas` valen 0 y la frase se acorta sola; con las cuatro en 0 el
 *   componente no se monta, porque «0 sin nivel» es ruido.
 * - **El invariante se dice sólo cuando NO cierra.** Un «las partes suman»
 *   permanente es ruido; un bloque cuyas partes no suman su total no se puede
 *   leer, y ninguna otra pantalla lo va a decir. Va con `role="status"` porque
 *   es lo único de aquí que pide una acción.
 */
export function AulasBolsasDelAvance({ total }: { total: TotalDeAvanceCuota }) {
  // C3: el vacío de esta pieza es no existir. No es una tabla ni un panel —no
  // pone marco propio—, así que un «sin bolsas» ocuparía alto para no decir
  // nada, y el marco que hay que conservar es el del panel que la contiene.
  if (total.fueraDeCelda <= 0 && !total.descuadre) return null;
  return (
    <p className="aulas-cuota-lectura">
      {total.fueraDeCelda > 0 ? (
        <>
          <strong>{fmt(total.fueraDeCelda)}</strong>{" "}
          {total.fueraDeCelda === 1 ? "respuesta más llegó" : "respuestas más llegaron"} y no{" "}
          {total.fueraDeCelda === 1 ? "entra" : "entran"} en ninguna meta:{" "}
          {total.notas.join(" · ")}
        </>
      ) : null}
      {total.descuadre ? (
        <strong className="aulas-cuota-descuadre" role="status">
          {total.fueraDeCelda > 0 ? " · " : null}
          {total.descuadre}
        </strong>
      ) : null}
    </p>
  );
}
