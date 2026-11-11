// Cómo se leen las tablas que devuelve la vista previa de Frecuencias
// (`POST /api/analitica/frecuencias/preview`).
//
// Aquí no se decide nada sobre las tablas: qué entra, en qué orden, qué filas
// lleva cada una, sus porcentajes, sus totales y sus notas vienen del servicio,
// que usa las mismas funciones que escriben el archivo. Este módulo solo los
// convierte en texto: formato de cifras, rótulos de lo que el servicio entrega
// como valor interno y la línea de base de cada tabla.

import type {
  FrecuenciasPreview,
  FrecuenciasPreviewSinTabla,
  FrecuenciasPreviewTabla,
} from "../../../api/analitica";
import { formatoConteo, formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";

/** Cuántas tablas se piden de entrada y cuántas más cada vez. */
export const TABLAS_POR_PEDIDO = 50;
/** El tope del servicio. */
export const LIMITE_DEL_SERVICIO = 500;

/** Fija los decimales de una cifra ya formateada: "18" con 1 → "18.0"; "17.3" con 2 → "17.30". */
function conDecimales(texto: string, digitos: number): string {
  if (texto === "") return texto;
  const [entero, fraccion = ""] = texto.split(".");
  return `${entero}.${fraccion.padEnd(digitos, "0")}`;
}

/**
 * Porcentaje de una fila o del total, como lo escribe el archivo: la
 * proporción del servicio con dos decimales fijos (0.17303 → "17.30",
 * 1 → "100.00").
 */
export function textoPorcentaje(proporcion: number | null): string {
  if (proporcion === null) return "";
  return conDecimales(formatoDecimal(proporcion * 100, 2, ""), 2);
}

/**
 * Porcentaje de la línea de base, con un decimal fijo: "97.4". Si respondieron
 * algunos pero no todos, no redondea a "0.0" ni a "100.0": queda entre 0.1 y
 * 99.9 (1,999 de 2,001 es "99.9", no "100.0").
 */
export function porcentajeDeBase(proporcion: number): string {
  const pct = proporcion * 100;
  const parcial = proporcion > 0 && proporcion < 1;
  const acotado = parcial ? Math.min(99.9, Math.max(0.1, pct)) : pct;
  return conDecimales(formatoDecimal(acotado, 1, ""), 1);
}

/**
 * Casos de una fila o del total, siempre enteros como en el archivo (`#,##0`).
 * Con pesos es una suma de pesos que puede traer decimales: 1.75 → "2".
 */
export function textoCasos(n: number | null): string {
  return n === null ? "" : formatoConteo(n);
}

/**
 * Un estadístico de la numérica, como en el archivo: un decimal fijo ("18.0");
 * el conteo de "Casos válidos", entero.
 */
export function textoEstadistico(valor: number | null, entero = false): string {
  if (valor === null) return "Sin dato";
  return entero ? formatoConteo(valor) : conDecimales(formatoDecimal(valor, 1, ""), 1);
}

/**
 * El estadístico que es un conteo de casos y no una medida: "Casos válidos",
 * tal como lo nombra el motor. Se reconoce por su nombre, no por su posición.
 */
export function esConteoDeCasos(estadistico: string): boolean {
  return estadistico === "Casos válidos";
}

/** "1 caso", "1,283 casos". */
function casos(n: number): string {
  return formatoConteoDe(n, "caso");
}

/**
 * La base de una tabla en partes. La base son casos SIN PONDERAR (contrato v2,
 * regla I1); lo ponderado son los porcentajes. `quien` y `cuantos` forman el
 * comienzo de la línea; `de` es "de 1,283 casos (97.4 %)". El porcentaje es
 * el cociente de las dos cifras del servicio, el único que se calcula aquí.
 */
export function partesDeBase(base: FrecuenciasPreviewTabla["base"]): { n: number; de: string } | undefined {
  if (!base.denominador || base.n === null) return undefined;
  const de = base.de === null || base.de <= 0
    ? ""
    : `de ${casos(base.de)} (${porcentajeDeBase(base.n / base.de)} %)`;
  return { n: base.n, de };
}

/**
 * La línea de base de una tabla de opción única o múltiple, con la regla de la
 * casa para una cifra en el texto: conteo y porcentaje juntos, el porcentaje
 * con un decimal. "Respondieron 1,250 de 1,283 casos (97.4 %)". Es la misma
 * frase que Cruces (`textoDeBaseDeCruce`), con o sin pesos: la base es siempre
 * un conteo sin ponderar. La numérica dice su base en "Casos válidos".
 */
export function textoDeBase(base: FrecuenciasPreviewTabla["base"]): string | undefined {
  if (!base.denominador || base.denominador === "casos_validos" || base.n === null) return undefined;
  const quienes = base.denominador === "marcaron_alguna_opcion" ? "Marcaron alguna opción" : "Respondieron";
  if (base.de === null || base.de <= 0) return `${quienes} ${casos(base.n)}`;
  return `${quienes} ${formatoConteo(base.n)} ${partesDeBase(base)?.de ?? ""}`;
}

/**
 * Lo que dice el porcentaje de la tabla, bajo su título: sobre quiénes se
 * calcula (el denominador del servicio) y si va ponderado. La numérica dice
 * que es un resumen y qué va ponderado.
 */
export function textoDelPorcentaje(tabla: FrecuenciasPreviewTabla, ponderado: boolean): string {
  if (tabla.tipo === "numerica") return ponderado ? "Resumen numérico; los estadísticos van ponderados." : "Resumen numérico.";
  const sobre = tabla.base.denominador === "marcaron_alguna_opcion"
    ? "sobre quienes marcaron alguna opción; las opciones suman más de 100"
    : "sobre quienes respondieron";
  return `Porcentaje${ponderado ? " ponderado" : ""} ${sobre}.`;
}

/** El rótulo de la fila de total: en la múltiple dice quiénes forman el 100 %. */
export function rotuloDelTotal(tabla: FrecuenciasPreviewTabla): string {
  return tabla.tipo === "multiple" ? "Total (marcaron alguna opción)" : "Total";
}

/** La cabecera de la columna de cifras: con pesos son sumas de pesos. */
export function cabeceraDeCasos(ponderado: boolean): string {
  return ponderado ? "N ponderado" : "Casos";
}

/** El código que se lee junto a la tabla: el de la pregunta, no el de su recodificación. */
export function codigoDeLaTabla(tabla: FrecuenciasPreviewTabla): string {
  return tabla.variable_origen ?? tabla.variable;
}

/** La tabla corresponde a la variable pedida, por su nombre o por el de la pregunta que recodifica. */
export function esLaVariable(tabla: FrecuenciasPreviewTabla, variable: string): boolean {
  return tabla.variable === variable || tabla.variable_origen === variable;
}

/** La fuente rotulada. Un valor que no se conoce no se muestra. */
export function rotuloDeFuente(fuente: string | null): string | null {
  if (fuente === "adaptados") return "Base codificada";
  if (fuente === "originales") return "Base cargada";
  return null;
}

/** Por qué una variable pedida no tiene tabla en el archivo. */
export function causaSinTabla(motivo: FrecuenciasPreviewSinTabla["motivo"]): string {
  if (motivo === "excluida") return "está excluida del análisis.";
  if (motivo === "fuera_del_archivo") return "está en la base y no entra al archivo: su sección está oculta o su tipo no lleva tabla.";
  return "no está en la base ni en el formulario.";
}

/**
 * Los avisos que se muestran tal cual. Los de variables sin tabla y el de un
 * archivo sin tablas ya se dicen en su lugar (la lista de sin tabla y el vacío
 * de la hoja): no se repiten.
 */
export function avisosDelMotor(preview: FrecuenciasPreview): string[] {
  return preview.avisos
    .filter((a) => a.codigo !== "variables_sin_tabla" && a.codigo !== "sin_tablas")
    .map((a) => a.mensaje);
}

/** El aviso del servicio cuando el archivo no tendría tablas; `null` si no lo da. */
export function causaDelArchivoVacio(preview: FrecuenciasPreview): string | null {
  return preview.avisos.find((a) => a.codigo === "sin_tablas")?.mensaje ?? null;
}

/** La ponderación está activada y las tablas salen sin pesos. */
export function ponderacionSinAplicar(preview: FrecuenciasPreview): boolean {
  return preview.ponderacion.configurada && !preview.ponderado;
}

/**
 * La vista previa tiene algo que decir bajo la tabla: preguntas sin tabla,
 * avisos o varias bases. Que la hoja venga recortada ya no se dice: la tabla
 * es de una pregunta y la lista ofrece las demás.
 */
export function tienePie(preview: FrecuenciasPreview, sinTabla: readonly FrecuenciasPreviewSinTabla[], releyendo = false): boolean {
  return sinTabla.length > 0 || ponderacionSinAplicar(preview)
    || avisosDelMotor(preview).length > 0 || dicePorBase(preview, releyendo);
}

/**
 * Con varias bases, el pie dice de cuál es la vista previa. No mientras lo que
 * se ve es de una lectura anterior: al entrar a Analítica la primera respuesta
 * puede ser de antes de hidratar la config y contar otras bases.
 */
export function dicePorBase(preview: FrecuenciasPreview, releyendo: boolean): boolean {
  return !releyendo && preview.base.n_bases > 1;
}

/**
 * Cuántas tablas pedir al pulsar "mostrar más"; `null` si ya no se puede pedir
 * más. Por defecto, los tramos y el tope de Frecuencias; Cruces pasa los suyos.
 */
export function siguienteLimite(
  limite: number,
  total: number,
  porPedido = TABLAS_POR_PEDIDO,
  tope = LIMITE_DEL_SERVICIO,
): number | null {
  if (limite >= total || limite >= tope) return null;
  return Math.min(limite + porPedido, total, tope);
}

/** "Se ven 50 de 120 tablas." */
export function textoDelRecorte(devueltas: number, total: number): string {
  return `Se ven ${formatoConteo(devueltas)} de ${formatoConteoDe(total, "tabla")}.`;
}

/** El rótulo del botón que pide más tablas. */
export function rotuloMostrarMas(limite: number, siguiente: number, total: number): string {
  const mas = siguiente - limite;
  return siguiente >= total ? `Mostrar ${mas === 1 ? "la que falta" : `las ${formatoConteo(mas)} que faltan`}` : `Mostrar ${formatoConteo(mas)} más`;
}

/** Lo que una tabla de la hoja dice de su sección (Frecuencias y Cruces). */
type ConSeccion = { seccion: { nombre: string; rotulo: string | null } };

export type SeccionDeLaHoja<T extends ConSeccion = FrecuenciasPreviewTabla> = {
  clave: string;
  nombre: string;
  /** El archivo escribe la fila de sección. */
  enElArchivo: boolean;
  tablas: T[];
};

/**
 * Las tablas agrupadas por sección en el orden en que llegan: una sección
 * nueva empieza cuando cambia el nombre. No reordena ni filtra.
 */
export function seccionesDeLaHoja<T extends ConSeccion = FrecuenciasPreviewTabla>(tablas: readonly T[]): SeccionDeLaHoja<T>[] {
  const secciones: SeccionDeLaHoja<T>[] = [];
  for (const tabla of tablas) {
    const ultima = secciones[secciones.length - 1];
    if (ultima && ultima.nombre === tabla.seccion.nombre) {
      ultima.tablas.push(tabla);
      continue;
    }
    secciones.push({
      clave: `${secciones.length}/${tabla.seccion.nombre}`,
      nombre: tabla.seccion.nombre,
      enElArchivo: tabla.seccion.rotulo !== null,
      tablas: [tabla],
    });
  }
  return secciones;
}
