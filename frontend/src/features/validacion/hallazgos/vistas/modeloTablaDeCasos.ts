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
// - qué se dice una sola vez (ítem 37, Gonzalo 2026-11-12: la columna "Leído"
//   repetía en cada fila el mismo motivo en cuatro líneas): `compactarTabla`.
import type { EnunciadoEsperado } from "../../../../api/validacionAuditoria";
import type { ColumnaDeCaso, FilaDeCaso } from "../modeloHallazgos";
import { CLAVE_RESPONDIDAS_DE_SECCION, lecturaDeSeccion, rotuloDeRespondidas } from "../seccionDelSalto";

/** Hasta cuántas preguntas van como columnas; con más, van en una fila dentro del caso. */
export const MAXIMO_DE_PREGUNTAS_EN_COLUMNAS = 4;

/** La columna de lo leído en una regla de fechas (`modeloHallazgos.tablaDeCasos`). */
export const CLAVE_LECTURA_DE_FECHAS = "fechas:lectura";
/** La columna de lo medido en una batería (`modeloHallazgos.tablaDeCasos`). */
export const CLAVE_PATRON_DE_BATERIA = "bateria:patron";
/** La columna de por qué no pasa una respuesta en una regla de formato (`modeloHallazgos.tablaDeCasos`). */
export const CLAVE_MOTIVO_DE_FORMATO = "formato:motivo";
/** La columna de contexto que nombra el caso cuando el estudio la declaró. */
export const CLAVE_NUMERO_DE_ENCUESTA = "ctx:numero_encuesta";

const ANCHO_MARCA = 44;
const ANCHO_MINIMO_CASO = 80;

/** Ancho mínimo (px) y peso del sobrante de una columna, según su papel. */
function pistaDe(c: ColumnaDeCaso): { minimo: number; peso: number } {
  if (c.tipo === "contexto") {
    if (c.clave === "ctx:recopilador") return { minimo: 96, peso: 1 };
    if (c.clave === "ctx:fecha_respuesta") return { minimo: 88, peso: 0.8 };
    // N.º de encuesta y digitador: un código corto.
    return { minimo: 64, peso: 0.6 };
  }
  if (c.tipo === "falla") {
    // "01/11/2026 01.11.2026": lo leído y el original en una línea; angosta, el original baja.
    if (c.clave === CLAVE_LECTURA_DE_FECHAS) return { minimo: 136, peso: 1.3 };
    // La respuesta repetida de una batería o la respuesta con su largo en una de formato.
    if (c.clave === CLAVE_PATRON_DE_BATERIA || c.clave.startsWith("formato:")) return { minimo: 152, peso: 1.4 };
    if (c.clave === CLAVE_RESPONDIDAS_DE_SECCION) return { minimo: 112, peso: 1 };
    return esFrase(c) ? { minimo: 128, peso: 1.2 } : { minimo: 96, peso: 0.9 };
  }
  return { minimo: 88, peso: 1 };
}

/** La columna que falla se lee desde el inicio (texto); una cifra va alineada a la derecha. */
export function esFrase(c: ColumnaDeCaso): boolean {
  return c.tipo === "falla" && !c.numerica;
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
    `minmax(${ANCHO_MINIMO_CASO}px, 0.5fr)`,
    ...pistas.map((p) => `minmax(${p.minimo}px, ${p.peso}fr)`),
  ].join(" ");
  const suma = ANCHO_MARCA + ANCHO_MINIMO_CASO + pistas.reduce((s, p) => s + p.minimo, 0);
  const huecos = columnas.length + 1;
  const anchoMinimo = `calc(${suma}px + ${huecos} * var(--pulso-space-3) + 2 * var(--pulso-space-5))`;
  return { columnas, enFila, plantilla, anchoMinimo };
}

// ---------------------------------------------------------------------------
// Lo común sube al encabezado; la fila lleva lo que cambia
// ---------------------------------------------------------------------------

/** Lo que va en una celda de la tabla de casos. */
export type CeldaDeCaso = {
  /** El valor, en el formato del oficio: "01/11/2026", "80105", "De acuerdo (3)". */
  valor: string;
  /** El texto tal como se registró, cuando difiere de lo leído (en gris, en la misma línea). */
  original: string | null;
  /** Lo que cambia por fila además del valor ("5 dígitos", "después del cierre"). */
  nota: string | null;
  /** El enunciado entero del motor, para el título. */
  titulo: string | null;
  /** El valor no está entre las opciones de su pregunta: va con su marca, no crudo (ítem 41). */
  fueraDeLista?: boolean;
};

/** Una columna de la tabla con lo que es igual en todas sus filas. */
export type ColumnaDeTabla = ColumnaDeCaso & {
  /** El motivo común de la columna, una sola vez: "Cierre del operativo: 31/10/2026". */
  detalle: string | null;
};

/** Una columna con el mismo valor en todos los casos: se dice una vez, sobre la tabla. */
export type ValorComun = { clave: string; rotulo: string; celda: CeldaDeCaso; falla: boolean };

export type TablaCompacta = {
  /** La columna que abre el caso: el N.º de encuesta si el estudio lo declaró; `null` es la columna "Caso". */
  columnaDelCaso: ColumnaDeCaso | null;
  /** Las demás columnas, en su orden. */
  columnas: ColumnaDeTabla[];
  /** Lo que es igual en todos los casos (con dos casos o más). */
  comunes: ValorComun[];
  /** Las celdas de cada fila, por `FilaDeCaso.clave` y clave de columna. */
  celdas: Map<string, Record<string, CeldaDeCaso>>;
};

const celdaSimple = (valor: string | undefined): CeldaDeCaso => ({ valor: valor ?? "Sin dato", original: null, nota: null, titulo: null });
const sinComillas = (texto: string) => texto.replace(/^"([^"]*)"/, "$1");
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const mismaCelda = (a: CeldaDeCaso, b: CeldaDeCaso) =>
  a.valor === b.valor && a.original === b.original && a.nota === b.nota && !!a.fueraDeLista === !!b.fueraDeLista;

/** El motivo de un caso de fechas: lo que va en el encabezado si es común y lo que va en la fila si no. */
export type MotivoDeFecha = { encabezado: string; corto: string };

/**
 * El motivo (`choque`) de una regla de fechas. "posterior al cierre del
 * operativo (31/10/2026)" es igual en todos los casos de un mismo lado: sube
 * al encabezado como "Cierre del operativo: 31/10/2026".
 */
export function motivoDeFecha(choque: string | null | undefined): MotivoDeFecha | null {
  const c = choque?.trim();
  if (!c) return null;
  let m = /^posterior al cierre del operativo \(([^)]+)\)$/.exec(c);
  if (m) return { encabezado: `Cierre del operativo: ${m[1]}`, corto: "después del cierre" };
  m = /^anterior al inicio del operativo \(([^)]+)\)$/.exec(c);
  if (m) return { encabezado: `Inicio del operativo: ${m[1]}`, corto: "antes del inicio" };
  m = /^que no se puede leer como (.+)$/.exec(c);
  if (m) return { encabezado: `Formato esperado: ${m[1]}`, corto: "no se pudo leer" };
  m = /^anterior a (?:"[^"]*" \([^)]*\)|"[^"]*"|\S+) en (.+)$/.exec(c);
  if (m) return { encabezado: `Anterior a ${m[1]}`, corto: `antes de ${m[1]}` };
  m = /^más que el máximo de (.+)$/.exec(c);
  if (m) return { encabezado: `Máximo: ${m[1]}`, corto: "sobre el máximo" };
  m = /^menos que el mínimo de (.+)$/.exec(c);
  if (m) return { encabezado: `Mínimo: ${m[1]}`, corto: "bajo el mínimo" };
  return { encabezado: mayuscula(c), corto: c };
}

/** Lo leído de un caso de fechas: el valor, el texto original si difiere y la pregunta (`rotulo`) si el motor la nombra. */
export type LecturaDeFecha = { valor: string; original: string | null; rotulo: string | null; diferencia: boolean };

/**
 * El `hecho` del motor en una regla de fechas (`validacion_regla_fechas.R`):
 * `registró "08.11.2026" (08/11/2026) en Fecha`, `registró "abc" en Fecha`,
 * `registró 10:15 en Hora`, `dejó incompleta Fecha` o `pasaron 3 horas entre
 * Inicio (10:00) y Fin (13:00)`. La pregunta (" en Fecha") puede faltar.
 * Otro enunciado: `null`.
 */
export function lecturaDeFecha(hecho: string | null | undefined): LecturaDeFecha | null {
  const h = hecho?.trim();
  if (!h) return null;
  let m = /^registró "([^"]*)" \(([^)]*)\)(?: en (.+))?$/.exec(h);
  if (m) return { valor: m[2], original: m[1] === m[2] ? null : m[1], rotulo: m[3] ?? null, diferencia: false };
  m = /^registró "([^"]*)"(?: en (.+))?$/.exec(h);
  if (m) return { valor: m[1], original: null, rotulo: m[2] ?? null, diferencia: false };
  m = /^registró (\S+)(?: en (.+))?$/.exec(h);
  if (m) return { valor: m[1], original: null, rotulo: m[2] ?? null, diferencia: false };
  m = /^dejó incompleta (.+)$/.exec(h);
  if (m) return { valor: "Incompleta", original: null, rotulo: m[1], diferencia: false };
  m = /^pasaron (.+?) entre .+$/.exec(h);
  if (m) return { valor: m[1], original: null, rotulo: null, diferencia: true };
  return null;
}

/** Lo que se repite de un caso de batería. */
type LecturaDeBateria = { tipo: "respuesta" | "vacias" | "iguales"; valor: string | null; n: number; k: number };

/**
 * El `hecho` del motor en una batería (`validacion_regla_bateria.R`):
 * `respondió "Mucho" (4) en las 14 preguntas de la batería`, `respondió …
 * en 12 de las 14 …`, `dejó vacías las 14 …`, `dejó vacías 9 de las 14 …` o
 * `tiene 12 de las 14 preguntas de la batería con la misma respuesta`. Con la
 * segunda condición ("y 3 con …") u otro enunciado: `null`.
 */
function lecturaDeBateria(hecho: string | null | undefined): LecturaDeBateria | null {
  const h = hecho?.trim();
  if (!h) return null;
  let m = /^respondió (.+) en las (\d+) preguntas de la batería$/.exec(h);
  if (m && !/ y \d+ con /.test(m[1])) return { tipo: "respuesta", valor: sinComillas(m[1]), n: Number(m[2]), k: Number(m[2]) };
  m = /^respondió (.+) en (\d+) de las (\d+) preguntas de la batería$/.exec(h);
  if (m && !/ y \d+ con /.test(m[1])) return { tipo: "respuesta", valor: m[1].split(" o ").map(sinComillas).join(" o "), n: Number(m[2]), k: Number(m[3]) };
  m = /^dejó vacías las (\d+) preguntas de la batería$/.exec(h);
  if (m) return { tipo: "vacias", valor: null, n: Number(m[1]), k: Number(m[1]) };
  m = /^dejó vacías (\d+) de las (\d+) preguntas de la batería$/.exec(h);
  if (m) return { tipo: "vacias", valor: null, n: Number(m[1]), k: Number(m[2]) };
  m = /^tiene (\d+) de las (\d+) preguntas de la batería con la misma respuesta$/.exec(h);
  if (m) return { tipo: "iguales", valor: null, n: Number(m[1]), k: Number(m[2]) };
  return null;
}

/** El `hecho` de una regla de formato: `respondió "80105" en Ubigeo (5 dígitos)`; el detalle entre paréntesis. */
export function detalleDeFormato(hecho: string | null | undefined): string | null {
  const m = / \((\d+ dígitos?|sin dígitos|con signos que no son dígitos|empieza con [^)]*)\)$/.exec(hecho?.trim() ?? "");
  return m ? m[1] : null;
}

/** El `choque` de una regla de formato: "que no es un número de 6 dígitos" sube como "Formato esperado: un número de 6 dígitos". */
export function formatoEsperado(choque: string | null | undefined): string | null {
  const m = /^que no es (.+)$/.exec(choque?.trim() ?? "");
  return m ? `Formato esperado: ${m[1]}` : null;
}

const enunciadoEntero = (e: EnunciadoEsperado | null) => [e?.hecho, e?.choque].filter(Boolean).join(", ") || null;

/** El único valor de una lista si todos son iguales; `null` si difieren o la lista está vacía. */
function unico<T>(valores: readonly T[]): T | null {
  return valores.length > 0 && valores.every((v) => v === valores[0]) ? valores[0] : null;
}

/**
 * La tabla de casos con cada cosa dicha una vez. Lo que es igual en todas las
 * filas no se repite en ellas:
 *
 * - el motivo común de lo que falla va bajo el encabezado de su columna
 *   ("Cierre del operativo: 31/10/2026", "Formato esperado: un número de 6
 *   dígitos", "En las 14 preguntas");
 * - en una regla de fechas, la columna de lo leído toma el lugar de la
 *   pregunta que lee: la celda es la fecha en el formato del oficio y, si se
 *   registró distinto, el original en gris;
 * - en una regla de formato, la respuesta es la columna que falla y su largo
 *   va en gris al lado; el enunciado del motor queda en el título;
 * - una columna con el mismo valor en todos los casos (dos o más) sale de la
 *   tabla y se dice una vez encima;
 * - el N.º de encuesta, si el estudio lo declaró, es la columna que abre el
 *   caso: no va además "Fila n".
 *
 * Un enunciado que no se reconoce va entero, sin perder nada.
 */
export function compactarTabla(columnasDeCaso: readonly ColumnaDeCaso[], filas: readonly FilaDeCaso[]): TablaCompacta {
  const celdas = new Map<string, Record<string, CeldaDeCaso>>();
  for (const f of filas) {
    const fila: Record<string, CeldaDeCaso> = {};
    for (const c of columnasDeCaso) {
      fila[c.clave] = celdaSimple(f.valores[c.clave]);
      if (f.fueraDeLista?.includes(c.clave)) fila[c.clave].fueraDeLista = true;
    }
    celdas.set(f.clave, fila);
  }
  let columnas: ColumnaDeTabla[] = columnasDeCaso.map((c) => ({ ...c, detalle: null }));
  const quitar = (clave: string) => { columnas = columnas.filter((c) => c.clave !== clave); };
  const cambiar = (clave: string, cambio: Partial<ColumnaDeTabla>) => {
    columnas = columnas.map((c) => (c.clave === clave ? { ...c, ...cambio } : c));
  };

  // Fechas: lo leído en el formato del oficio, el original en gris y el motivo común arriba.
  if (columnas.some((c) => c.clave === CLAVE_LECTURA_DE_FECHAS)) {
    const lecturas = filas.map((f) => lecturaDeFecha(f.esperado?.hecho));
    const motivos = filas.map((f) => motivoDeFecha(f.esperado?.choque));
    if (filas.length > 0 && lecturas.every((l) => l !== null)) {
      const comun = unico(motivos.map((m) => m?.encabezado ?? ""));
      filas.forEach((f, i) => {
        const l = lecturas[i] as LecturaDeFecha;
        const fila = celdas.get(f.clave) as Record<string, CeldaDeCaso>;
        fila[CLAVE_LECTURA_DE_FECHAS] = {
          valor: l.valor,
          original: l.original,
          nota: comun === null ? motivos[i]?.corto ?? null : null,
          titulo: enunciadoEntero(f.esperado),
        };
      });
      const preguntas = columnas.filter((c) => c.tipo === "pregunta");
      const rotulo = unico(lecturas.map((l) => l?.rotulo ?? null));
      const leida = rotulo ? preguntas.find((c) => c.rotulo === rotulo || c.clave === rotulo) : preguntas.length === 1 ? preguntas[0] : undefined;
      const diferencia = lecturas.every((l) => l?.diferencia);
      if (leida && !diferencia) quitar(leida.clave);
      cambiar(CLAVE_LECTURA_DE_FECHAS, {
        rotulo: leida && !diferencia ? leida.rotulo : diferencia ? "Diferencia" : "Lectura",
        detalle: comun || null,
      });
    }
  }

  // Formato: la respuesta es lo que falla; su largo en gris y lo esperado arriba.
  const respuestaDeFormato = columnas.find((c) => c.clave.startsWith("formato:") && c.clave !== CLAVE_MOTIVO_DE_FORMATO);
  if (respuestaDeFormato && columnas.some((c) => c.clave === CLAVE_MOTIVO_DE_FORMATO) && filas.length > 0) {
    const esperado = unico(filas.map((f) => formatoEsperado(f.esperado?.choque)));
    if (esperado) {
      for (const f of filas) {
        const fila = celdas.get(f.clave) as Record<string, CeldaDeCaso>;
        fila[respuestaDeFormato.clave] = {
          ...fila[respuestaDeFormato.clave],
          nota: detalleDeFormato(f.esperado?.hecho),
          titulo: enunciadoEntero(f.esperado),
        };
      }
      quitar(CLAVE_MOTIVO_DE_FORMATO);
      cambiar(respuestaDeFormato.clave, { tipo: "falla", detalle: esperado });
    }
  }

  // Batería: la respuesta repetida (o cuántas vacías) y, si son todas, "En las 14 preguntas" arriba.
  if (columnas.some((c) => c.clave === CLAVE_PATRON_DE_BATERIA)) {
    const lecturas = filas.map((f) => lecturaDeBateria(f.esperado?.hecho));
    const tipo = unico(lecturas.map((l) => l?.tipo ?? null));
    if (filas.length > 0 && tipo) {
      const k = unico(lecturas.map((l) => l?.k ?? null));
      const todas = k !== null && lecturas.every((l) => l?.n === k);
      filas.forEach((f, i) => {
        const l = lecturas[i] as LecturaDeBateria;
        const cuenta = `${l.n} de ${l.k}`;
        const fila = celdas.get(f.clave) as Record<string, CeldaDeCaso>;
        fila[CLAVE_PATRON_DE_BATERIA] = {
          valor: l.valor ?? (todas ? "Todas" : cuenta),
          original: null,
          nota: l.valor && !todas ? cuenta : null,
          titulo: enunciadoEntero(f.esperado),
        };
      });
      cambiar(CLAVE_PATRON_DE_BATERIA, {
        rotulo: tipo === "respuesta" ? "Respuesta repetida" : tipo === "vacias" ? "Preguntas vacías" : "Misma respuesta",
        detalle: todas ? `En las ${k} preguntas` : null,
      });
    }
  }

  // Sección: cuántas de sus preguntas respondió y, si es la misma, la sección arriba (ítem 42).
  if (columnas.some((c) => c.clave === CLAVE_RESPONDIDAS_DE_SECCION)) {
    const lecturas = filas.map((f) => lecturaDeSeccion(f.esperado?.hecho));
    if (filas.length > 0 && lecturas.every((l) => l !== null)) {
      filas.forEach((f, i) => {
        const fila = celdas.get(f.clave) as Record<string, CeldaDeCaso>;
        fila[CLAVE_RESPONDIDAS_DE_SECCION] = {
          valor: rotuloDeRespondidas(lecturas[i] as NonNullable<(typeof lecturas)[number]>),
          original: null,
          nota: null,
          titulo: enunciadoEntero(f.esperado),
        };
      });
      const k = unico(lecturas.map((l) => l?.k ?? null));
      const seccion = unico(lecturas.map((l) => l?.seccion ?? null));
      cambiar(CLAVE_RESPONDIDAS_DE_SECCION, {
        detalle: seccion && k !== null ? `De ${k} en "${seccion}"` : null,
      });
    }
  }

  // El N.º de encuesta nombra el caso.
  const columnaDelCaso = columnas.find((c) => c.clave === CLAVE_NUMERO_DE_ENCUESTA) ?? null;
  if (columnaDelCaso) quitar(columnaDelCaso.clave);

  // Lo que es igual en todos los casos se dice una vez, encima de la tabla.
  const comunes: ValorComun[] = [];
  if (filas.length >= 2) {
    for (const c of [...columnas]) {
      const primera = celdas.get(filas[0].clave)?.[c.clave];
      if (!primera) continue;
      if (!filas.every((f) => { const x = celdas.get(f.clave)?.[c.clave]; return x !== undefined && mismaCelda(x, primera); })) continue;
      comunes.push({ clave: c.clave, rotulo: c.rotulo, celda: primera, falla: c.tipo === "falla" });
      quitar(c.clave);
    }
  }
  return { columnaDelCaso, columnas, comunes, celdas };
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
