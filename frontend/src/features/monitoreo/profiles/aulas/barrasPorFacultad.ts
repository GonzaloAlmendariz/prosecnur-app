import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * View-model de «Hombres y mujeres por facultad» — dictado de Gonzalo,
 * 2026-09-08 («Correcciones Parte 1», punto 5).
 *
 * Textual: «Deberían ser dos filas bien alineadas mostrando hombres y mujeres,
 * y una barra rectangular más ancha en ambas filas con una barra apilada que
 * muestra con el mismo largo donde se puede ver el porcentaje de avance, con
 * verde para el porcentaje avanzado y gris suave para lo que queda, con los
 * bordes definidos y elegante.»
 *
 * Dos decisiones que el dictado fija y conviene no volver a discutir:
 *
 *   · **Todos los carriles miden lo mismo.** Cada barra va de 0 a 100 % de SU
 *     propia meta, así que lo que se compara de un vistazo es el porcentaje de
 *     avance, no cuántas personas pide cada facultad. La magnitud la enseña la
 *     pirámide, en su propia sección: son dos preguntas distintas y por eso son
 *     dos gráficos. Antes se mezclaban y, en palabras suyas, «no se distingue
 *     bien».
 *   · **Verde y gris, no color por sexo.** El sexo lo dice el rótulo del
 *     carril; el color codifica avance contra pendiente. Pintar el carril del
 *     color del sexo gastaba el canal cromático en algo que ya está escrito.
 *
 * Nada aquí proyecta ni predice: «lo nada que tenga que ver con predicción
 * porque eso le pertenece a otra pestaña». Sólo hay dos estados, lo conseguido
 * y lo que falta, y cuando se pasa de la meta el que falta se vuelve el que
 * sobra.
 */

/** Un carril: un sexo de una facultad contra SU propia meta. */
export type CarrilDeSexo = {
  /** «Mujeres» / «Hombres», ya en el idioma de la pantalla. */
  sexo: string;
  /** Clave cruda (`F` / `M`), para el `data-sexo` y las pruebas. */
  clave: string;
  meta: number;
  logrado: number;
  /** Lo que falta para la meta; 0 cuando ya se llegó. */
  falta: number;
  /** Lo que se pasó de la meta; 0 cuando aún no se llega. */
  sobra: number;
  /** 0..1, topado en 1 para el ancho pintado. `null` sin meta contra la que medir. */
  avance: number | null;
  /** El ancho pintado en tanto por ciento, ya topado. */
  anchoPct: number;
};

export type FilaDeFacultad = {
  facultad: string;
  metaTotal: number;
  logradoTotal: number;
  carriles: CarrilDeSexo[];
  /**
   * El chip aparece SÓLO cuando algo cambia (Gonzalo: «chips sólo cuando algo
   * cambia»): meta cumplida, o a menos del 10 % de cumplirla. En el resto de
   * los casos un chip por fila es ruido que se repite quince veces.
   */
  chip: "cumplida" | "cerca" | null;
};

const ETIQUETA_DE_SEXO: Record<string, string> = { F: "Mujeres", M: "Hombres" };
/**
 * **Hombres arriba, mujeres debajo**, en todas las facultades y sin excepción.
 *
 * Lo fija el dictado del 2026-09-08, que es consistente en las cinco tablas y
 * en las barras: «mostrando hombre y mujeres», «Total · Hombres · Mujeres»,
 * «Efectivas hombres · Efectivas mujeres». El checklist anterior había dejado
 * mujeres→hombres cuando el dictado de las quince columnas alternaba y no había
 * con qué decidir; ahora sí lo hay.
 */
const ORDEN_DE_SEXO = ["M", "F"];

function num(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function claveDeSexo(valor: unknown): string {
  const bruto = String(valor ?? "").trim().toUpperCase();
  if (!bruto) return "";
  if (bruto.startsWith("F") || bruto === "MUJER" || bruto === "MUJERES") return "F";
  if (bruto.startsWith("M") && bruto !== "MUJER" && bruto !== "MUJERES") return "M";
  return bruto;
}

/**
 * Agrupa las celdas de cuota por facultad y devuelve una fila por facultad con
 * un carril por sexo.
 *
 * @param filas `quotas_sex_faculty` del tablero: `faculty`, `sex`, `target`,
 *   `observed`, `missing`. `missing` NO se usa para derivar lo logrado: se
 *   recalcula desde meta y logrado para que la barra y su cifra no puedan
 *   discrepar si el motor cambia de criterio.
 */
export function barrasPorFacultad(filas: MonitoreoRow[] | undefined): FilaDeFacultad[] {
  const porFacultad = new Map<string, Map<string, CarrilDeSexo>>();
  for (const fila of filas ?? []) {
    const facultad = String((fila as Record<string, unknown>).faculty ?? "").trim();
    if (!facultad) continue;
    const clave = claveDeSexo((fila as Record<string, unknown>).sex);
    if (!clave) continue;
    const meta = num((fila as Record<string, unknown>).target);
    const logrado = num((fila as Record<string, unknown>).observed);
    const carriles = porFacultad.get(facultad) ?? new Map<string, CarrilDeSexo>();
    // Una facultad puede traer varias filas del mismo sexo si el motor la parte
    // por otra dimensión: se acumulan en vez de quedarse con la última.
    const previo = carriles.get(clave);
    const metaAcc = meta + (previo?.meta ?? 0);
    const logradoAcc = logrado + (previo?.logrado ?? 0);
    const avance = metaAcc > 0 ? logradoAcc / metaAcc : null;
    carriles.set(clave, {
      sexo: ETIQUETA_DE_SEXO[clave] ?? clave,
      clave,
      meta: metaAcc,
      logrado: logradoAcc,
      falta: Math.max(0, metaAcc - logradoAcc),
      sobra: Math.max(0, logradoAcc - metaAcc),
      avance,
      anchoPct: avance === null ? 0 : Math.min(1, Math.max(0, avance)) * 100,
    });
    porFacultad.set(facultad, carriles);
  }

  const salida: FilaDeFacultad[] = [];
  for (const [facultad, carriles] of porFacultad) {
    const ordenados = ORDEN_DE_SEXO
      .map((clave) => carriles.get(clave))
      .filter((c): c is CarrilDeSexo => Boolean(c))
      .concat(
        [...carriles.entries()]
          .filter(([clave]) => !ORDEN_DE_SEXO.includes(clave))
          .map(([, carril]) => carril),
      );
    const metaTotal = ordenados.reduce((acc, c) => acc + c.meta, 0);
    const logradoTotal = ordenados.reduce((acc, c) => acc + c.logrado, 0);
    // El chip mira las CELDAS, no el total: una facultad con las mujeres
    // cubiertas y los hombres a medias no está cumplida, y el agregado lo
    // escondería (ADR 0079, la cuota no se compensa entre celdas).
    const todasCumplidas = ordenados.length > 0 && ordenados.every((c) => c.falta === 0);
    const faltaPoco = !todasCumplidas
      && metaTotal > 0
      && ordenados.reduce((acc, c) => acc + c.falta, 0) / metaTotal <= 0.1;
    salida.push({
      facultad,
      metaTotal,
      logradoTotal,
      carriles: ordenados,
      chip: todasCumplidas ? "cumplida" : faltaPoco ? "cerca" : null,
    });
  }
  // De la que más pide a la que menos: es el orden con el que se sale a campo y
  // el mismo de la tabla del libro.
  return salida.sort((a, b) => b.metaTotal - a.metaTotal || a.facultad.localeCompare(b.facultad));
}
