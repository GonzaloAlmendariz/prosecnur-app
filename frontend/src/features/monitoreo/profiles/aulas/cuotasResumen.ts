import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Las tres lecturas de la cuota: general, por facultad y por sexo.
 *
 * El tablero traía las **celdas** —doce filas de facultad × sexo— y el KPI decía
 * «2/12». Ninguna de las dos contesta la pregunta del operativo, que es **cuánta
 * gente falta**: doce celdas pueden estar a una respuesta o a doscientas y el
 * contador se ve igual.
 *
 * Las tres salen del mismo dato (`quotas_sex_faculty`), así que se agregan una
 * sola vez y cada vista elige el corte que necesita.
 */

export type CorteDeCuota = {
  /** Cómo se lee: «Derecho», «F», o «Total» para el general. */
  etiqueta: string;
  /** Personas que el plan pide. */
  meta: number;
  /** Personas ya recogidas. */
  logrado: number;
  /** Personas que faltan; nunca negativo. */
  faltan: number;
  /** Cumplimiento en puntos porcentuales; puede pasar de 100. */
  avance: number;
  /** Celdas del corte y cuántas alcanzaron su meta. */
  celdas: number;
  celdasCumplidas: number;
  /** El mismo corte partido por la otra dimensión; vacío si no se pidió. */
  desglose?: CorteDeCuota[];
};

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function corte(etiqueta: string, filas: ReadonlyArray<MonitoreoRow>): CorteDeCuota {
  let meta = 0;
  let logrado = 0;
  let celdasCumplidas = 0;
  for (const fila of filas) {
    const objetivo = numero(fila.target);
    const observado = numero(fila.observed);
    meta += objetivo;
    logrado += observado;
    if (objetivo > 0 && observado >= objetivo) celdasCumplidas += 1;
  }
  return {
    etiqueta,
    meta,
    logrado,
    // Lo que falta se cuenta CELDA A CELDA, no sobre los totales: pasarse en una
    // facultad no cubre lo que falta en otra, y restar totales lo escondería.
    faltan: filas.reduce((suma, fila) => suma + Math.max(0, numero(fila.target) - numero(fila.observed)), 0),
    avance: meta > 0 ? Math.round((100 * logrado) / meta * 10) / 10 : 0,
    celdas: filas.length,
    celdasCumplidas,
  };
}

function agrupar(
  filas: ReadonlyArray<MonitoreoRow>,
  clave: (fila: MonitoreoRow) => string,
  /**
   * La otra dimensión de la celda. Con ella cada grupo trae su desglose: la
   * facultad dice cuánto le falta **de cada sexo**, que es la pregunta que ni la
   * lista por facultad ni la lista por sexo contestan —son dos marginales, y
   * saber que faltan 167 en Gestión y 584 mujeres en todo el estudio no dice
   * cuántas de esas 167 son mujeres—.
   */
  subclave?: (fila: MonitoreoRow) => string,
  // El tipo se anota porque `agrupar` se llama a sí misma para el desglose y sin
  // anotación TypeScript no puede inferirla.
): CorteDeCuota[] {
  const grupos = new Map<string, MonitoreoRow[]>();
  for (const fila of filas) {
    const k = clave(fila);
    if (!k) continue;
    const actual = grupos.get(k);
    if (actual) actual.push(fila);
    else grupos.set(k, [fila]);
  }
  return [...grupos.entries()]
    .map(([etiqueta, propias]) => ({
      ...corte(etiqueta, propias),
      // El desglose sale de las MISMAS celdas que el grupo, así que sus partes
      // suman el grupo por construcción.
      desglose: subclave ? agrupar(propias, subclave) : [],
    }))
    // Primero lo que más falta: es el orden con el que se decide dónde insistir.
    .sort((a, b) => b.faltan - a.faltan || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/**
 * Agrega las celdas de cuota en los tres cortes que pide el operativo.
 *
 * Las celdas **sin meta** no entran en ninguno: su cumplimiento no está definido
 * y arrastrarlas al total inflaría el denominador con algo que nadie pidió.
 */
export function cuotasResumen(filas: ReadonlyArray<MonitoreoRow>) {
  const conMeta = filas.filter((fila) => numero(fila.target) > 0);
  return {
    general: corte("Total", conMeta),
    porFacultad: agrupar(conMeta, (fila) => texto(fila.faculty), (fila) => texto(fila.sex)),
    porSexo: agrupar(conMeta, (fila) => texto(fila.sex), (fila) => texto(fila.faculty)),
    sinMeta: filas.length - conMeta.length,
  };
}
