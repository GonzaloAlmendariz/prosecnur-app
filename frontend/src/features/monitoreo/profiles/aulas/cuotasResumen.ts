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

function agrupar(filas: ReadonlyArray<MonitoreoRow>, clave: (fila: MonitoreoRow) => string) {
  const grupos = new Map<string, MonitoreoRow[]>();
  for (const fila of filas) {
    const k = clave(fila);
    if (!k) continue;
    const actual = grupos.get(k);
    if (actual) actual.push(fila);
    else grupos.set(k, [fila]);
  }
  return [...grupos.entries()]
    .map(([etiqueta, propias]) => corte(etiqueta, propias))
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
    porFacultad: agrupar(conMeta, (fila) => texto(fila.faculty)),
    porSexo: agrupar(conMeta, (fila) => texto(fila.sex)),
    sinMeta: filas.length - conMeta.length,
  };
}
