// Disposición de la tabla de casos de Hallazgos (ítem 33 del checklist de
// Validación, QA2 2026-11-12). La tabla repartía el ancho por la cantidad de
// columnas: una batería de 14 preguntas dejaba columnas de 47 px (13 px a
// 1024) y filas de hasta 316 px. Aquí se decide, sin React:
//
// - el ancho mínimo legible de cada columna según su papel; si la suma no cabe,
//   la tabla se desplaza en horizontal con la marca y el caso fijos (C4);
// - en una batería, o con más de `MAXIMO_DE_PREGUNTAS_EN_COLUMNAS` preguntas,
//   las preguntas van como una fila de respuestas dentro del caso, cada una en
//   código corto con su etiqueta en el título;
// - la lectura de una regla de fechas en una línea ("08.11.2026 → 08/11/2026")
//   con el motivo debajo.
import type { EnunciadoEsperado } from "../../../../api/validacionAuditoria";
import type { ColumnaDeCaso } from "../modeloHallazgos";

/** Hasta cuántas preguntas van como columnas; con más, van en una fila dentro del caso. */
export const MAXIMO_DE_PREGUNTAS_EN_COLUMNAS = 4;

/** La columna de lo leído en una regla de fechas (`modeloHallazgos.tablaDeCasos`). */
export const CLAVE_LECTURA_DE_FECHAS = "fechas:lectura";
/** La columna de lo medido en una batería (`modeloHallazgos.tablaDeCasos`). */
export const CLAVE_PATRON_DE_BATERIA = "bateria:patron";

const ANCHO_MARCA = 44;
const ANCHO_MINIMO_CASO = 72;

/** Ancho mínimo (px) y peso del sobrante de una columna, según su papel. */
function pistaDe(c: ColumnaDeCaso): { minimo: number; peso: number } {
  if (c.tipo === "contexto") {
    if (c.clave === "ctx:recopilador") return { minimo: 96, peso: 1 };
    if (c.clave === "ctx:fecha_respuesta") return { minimo: 88, peso: 0.8 };
    // N.º de encuesta y digitador: un código corto.
    return { minimo: 64, peso: 0.6 };
  }
  if (c.tipo === "falla") {
    // "08.11.2026 → 08/11/2026" en una línea.
    if (c.clave === CLAVE_LECTURA_DE_FECHAS) return { minimo: 192, peso: 1.4 };
    // Lo medido en una batería o un motivo es una frase; un valor que falla, una cifra.
    return esFrase(c) ? { minimo: 168, peso: 1.6 } : { minimo: 96, peso: 0.9 };
  }
  return { minimo: 88, peso: 1 };
}

/** La columna que falla dice una frase del motor (no un valor de la base). */
export function esFrase(c: ColumnaDeCaso): boolean {
  return c.tipo === "falla" && c.clave.includes(":");
}

export type DisposicionDeTabla = {
  /** Las columnas que van como columna, en su orden. */
  columnas: ColumnaDeCaso[];
  /** Las preguntas que van como fila de respuestas dentro de cada caso (vacío si caben como columnas). */
  enFila: ColumnaDeCaso[];
  /** `grid-template-columns` de cada fila: marca, caso y las columnas. */
  plantilla: string;
  /** Ancho mínimo de la fila: si el contenedor es más angosto, la tabla se desplaza en horizontal. */
  anchoMinimo: string;
};

export function disposicionDeTabla(todas: readonly ColumnaDeCaso[]): DisposicionDeTabla {
  const preguntas = todas.filter((c) => c.tipo === "pregunta");
  // Una batería va siempre en fila, con las preguntas que el motor publique.
  const esBateria = todas.some((c) => c.clave === CLAVE_PATRON_DE_BATERIA);
  const enFila = preguntas.length > MAXIMO_DE_PREGUNTAS_EN_COLUMNAS || (esBateria && preguntas.length > 0) ? preguntas : [];
  const columnas = enFila.length ? todas.filter((c) => c.tipo !== "pregunta") : [...todas];
  const pistas = columnas.map(pistaDe);
  const plantilla = [
    `${ANCHO_MARCA}px`,
    `minmax(${ANCHO_MINIMO_CASO}px, 0.7fr)`,
    ...pistas.map((p) => `minmax(${p.minimo}px, ${p.peso}fr)`),
  ].join(" ");
  const suma = ANCHO_MARCA + ANCHO_MINIMO_CASO + pistas.reduce((s, p) => s + p.minimo, 0);
  const huecos = columnas.length + 1;
  const anchoMinimo = `calc(${suma}px + ${huecos} * var(--pulso-space-3) + 2 * var(--pulso-space-5))`;
  return { columnas, enFila, plantilla, anchoMinimo };
}

/** El rótulo de la fila de respuestas: "Respuestas de p29_1 a p29_14". */
export function rotuloDeRespuestas(enFila: readonly ColumnaDeCaso[]): string {
  if (enFila.length === 0) return "Respuestas";
  if (enFila.length === 1) return `Respuesta en ${enFila[0].clave}`;
  return `Respuestas de ${enFila[0].clave} a ${enFila[enFila.length - 1].clave}`;
}

/**
 * El código de una respuesta escrita como "Etiqueta (código)" (así la escribe
 * `valorEscrito`); un valor sin etiqueta queda igual. `completo` va al título.
 */
export function valorCorto(valor: string | undefined): { corto: string; completo: string } {
  const completo = valor ?? "Sin dato";
  const m = /^(.+) \(([^()]+)\)$/.exec(completo);
  return { corto: m ? m[2] : completo, completo };
}

/** El título de una respuesta de la fila: pregunta, etiqueta y valor completo. */
export function tituloDeRespuesta(c: ColumnaDeCaso, valor: string | undefined): string {
  const pregunta = c.rotulo && c.rotulo !== c.clave ? `${c.clave} ${c.rotulo}` : c.clave;
  return `${pregunta}: ${valorCorto(valor).completo}`;
}

/**
 * Lo leído de una regla de fechas en una línea. El motor escribe
 * `registró "08.11.2026" (08/11/2026) en Fecha` cuando lo registrado y lo leído
 * difieren, `registró "abc" en Fecha` cuando no se pudo leer y `registró 10:15
 * en Hora` cuando coinciden; el motivo va aparte
 * (`choque`). Otro enunciado (una duración, una fecha incompleta) se muestra
 * entero: `null`.
 */
export function lecturaEnUnaLinea(esperado: EnunciadoEsperado | null): { lectura: string; motivo: string | null } | null {
  const hecho = esperado?.hecho?.trim();
  if (!hecho) return null;
  const motivo = esperado?.choque?.trim() || null;
  const conOriginal = /^registró "([^"]+)" \(([^)]+)\) en /.exec(hecho);
  if (conOriginal) return { lectura: `${conOriginal[1]} → ${conOriginal[2]}`, motivo };
  const sinLeer = /^registró "([^"]+)" en /.exec(hecho);
  if (sinLeer) return { lectura: sinLeer[1], motivo };
  const igual = /^registró ([^\s"]+) en /.exec(hecho);
  if (igual) return { lectura: igual[1], motivo };
  return null;
}

export type Desborde = "ninguno" | "derecha" | "izquierda" | "ambos";

/** Hacia dónde queda contenido fuera de la vista de una tabla que se desplaza en horizontal. */
export function ladoDelDesborde(desplazado: number, visible: number, total: number): Desborde {
  const izquierda = desplazado > 1;
  const derecha = desplazado + visible < total - 1;
  if (izquierda && derecha) return "ambos";
  if (derecha) return "derecha";
  if (izquierda) return "izquierda";
  return "ninguno";
}
