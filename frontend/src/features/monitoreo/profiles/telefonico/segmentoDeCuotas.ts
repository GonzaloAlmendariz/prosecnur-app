/**
 * Cómo se llama el segmento por el que este estudio reparte sus cuotas.
 *
 * La vista lo llamaba «Sede», escrito a mano: el título («Cuotas Kobo por
 * sede»), el KPI de la cabecera, el recuento («2 sedes») y el rótulo de cada
 * tarjeta. En PDM MedVida 2026 el segmento es `Actor` —Homologación de Títulos
 * y Vinculación Laboral, que no son sedes de nada— y la pantalla llamaba sede a
 * un actor en cinco sitios distintos.
 *
 * El nombre lo declara el estudio en `control_vars` y viaja en cada fila del
 * bloque de cuotas, en la columna `Variable`. De ahí sale, y no de una
 * constante: el siguiente estudio reparte por distrito, por facultad o por
 * carrera, y ninguno de esos es una sede tampoco.
 */

import { rotuloDeVariable } from "./modelo/variablesDeCuota";
import { formatoConteo } from "../../../../lib/formatoNumero";

/**
 * Cómo se muestra el segmento. `nombreDelSegmento` devuelve la clave tal como
 * viaja en los bloques (`dim_actor`), que se usa para emparejar filas; en
 * pantalla va humanizada («Actor»): RMS ficticio mostraba `dim_actor` en la
 * barra, los títulos, las tablas y los filtros.
 */
export function rotuloDelSegmento(nombre: string) {
  const limpio = String(nombre ?? "").trim();
  return limpio ? rotuloDeVariable(limpio) : "";
}

/** La variable de cuota que el corte declara, tal como viaja en los bloques. */
export function nombreDelSegmento(
  variablesDeLasFilas: ReadonlyArray<string>,
  porDefecto = "Cuota",
): string {
  // La más frecuente y no la primera: un corte puede traer una fila suelta de
  // otra variable —una meta global, un residuo— y esa no es el segmento.
  const cuenta = new Map<string, number>();
  for (const bruto of variablesDeLasFilas) {
    const limpio = String(bruto ?? "").trim();
    if (!limpio) continue;
    cuenta.set(limpio, (cuenta.get(limpio) ?? 0) + 1);
  }
  if (!cuenta.size) return porDefecto;

  let ganadora = porDefecto;
  let mejor = 0;
  for (const [nombre, veces] of cuenta) {
    // Ante empate gana la primera vista, que es el orden en que el motor las
    // emite: el de `control_vars`, o sea el que declaró el usuario.
    if (veces > mejor) {
      mejor = veces;
      ganadora = nombre;
    }
  }
  return ganadora;
}

/** Los nombres que, si el estudio los declara, son el eje de sus cuotas. */
const VARIABLES_DE_EJE = ["sede", "distrito", "grupo", "segmento", "actor"];

function claveDeVariable(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * LA variable de cuota del corte, una sola para toda la pantalla: Avance ›
 * Cuotas pinta sus tarjetas con ella, Ritmo dibuja su serie y la barra la
 * nombra. Antes Cuotas elegía la primera con meta (con prioridad a sede,
 * distrito, grupo, segmento o actor) y Ritmo la más frecuente de todas: con
 * metas por sexo y un listado por sede, Cuotas mostraba sexo y Ritmo sede, dos
 * cortes de la misma cuota en la misma pantalla.
 *
 * Regla: entre las variables con alguna meta (todas, si ninguna la tiene), la
 * de nombre de eje si la hay; si no, la más frecuente; ante empate, la primera
 * en el orden del motor, que es el de `control_vars`.
 */
export function variableDeCuotas(
  filas: ReadonlyArray<{ variable: unknown; meta?: unknown }>,
  porDefecto = "Cuota",
): string {
  const conMeta = filas.filter((fila) => {
    const meta = Number(fila.meta);
    return fila.meta != null && fila.meta !== "" && Number.isFinite(meta) && meta > 0;
  });
  const candidatas = (conMeta.length ? conMeta : filas).map((fila) => String(fila.variable ?? "").trim()).filter(Boolean);
  const deEje = candidatas.find((variable) => VARIABLES_DE_EJE.includes(claveDeVariable(variable)));
  return deEje ?? nombreDelSegmento(candidatas, porDefecto);
}

/**
 * Las variables con alguna meta, en el orden del motor, con cuántas metas trae cada una. Avance › Cuotas
 * muestra una; las demás se avisan (R5 de la ronda de cuotas): sus metas no se suman a las de la variable a
 * la vista porque las dos reparten la misma población.
 */
export function variablesConMeta(
  filas: ReadonlyArray<{ variable: unknown; meta?: unknown }>,
): Array<{ variable: string; metas: number }> {
  const cuenta = new Map<string, number>();
  for (const fila of filas) {
    const meta = Number(fila.meta);
    if (fila.meta == null || fila.meta === "" || !Number.isFinite(meta) || meta <= 0) continue;
    const variable = String(fila.variable ?? "").trim();
    if (variable) cuenta.set(variable, (cuenta.get(variable) ?? 0) + 1);
  }
  return [...cuenta].map(([variable, metas]) => ({ variable, metas }));
}

/**
 * El plural del segmento, para los recuentos («2 actores», «2 sedes»).
 *
 * Reglas del español suficientes para nombres de variable, que son sustantivos
 * comunes en singular: vocal → `+s`, `z` → `ces`, consonante → `+es`. No
 * pretende cubrir el idioma entero; cubre lo que puede aparecer aquí, y
 * cualquier caso raro se lee mal pero no engaña sobre el dato.
 */
export function pluralDelSegmento(nombre: string): string {
  const limpio = String(nombre ?? "").trim();
  if (!limpio) return "";
  if (/s$/i.test(limpio)) return limpio;

  const ultima = limpio.slice(-1);
  if (/[aeiouáéíóú]/i.test(ultima)) return `${limpio}s`;
  if (/z/i.test(ultima)) return `${limpio.slice(0, -1)}ces`;
  return `${limpio}es`;
}

/** «2 actores», «1 sede». */
export function contarSegmentos(cantidad: number, nombre: string): string {
  const etiqueta = cantidad === 1 ? nombre : pluralDelSegmento(nombre);
  return `${formatoConteo(cantidad)} ${etiqueta.toLocaleLowerCase("es")}`;
}
