// La lista "Preguntas" de Frecuencias y Cruces: las preguntas del archivo
// agrupadas por su sección, tal como las devuelve la vista previa del motor, y
// cuál se ve en la tabla del centro.
//
// La lista no inventa nada: las secciones y el orden son los de la hoja que
// devolvió el servicio. Cuando la hoja viene recortada (el servicio devuelve
// las primeras por tandas), las preguntas que faltan salen del catálogo de
// variables del formulario, sin sección, porque el servicio todavía no dijo en
// cuál van: se agrupan aparte y su tabla se pide al elegirlas.

/** Una pregunta de la lista: su nombre en la base, el código que se lee y su pregunta. */
export type PreguntaDeLaLista = {
  /** La variable que se pide y se escribe en `foco`. */
  variable: string;
  /** El código que se lee junto a la pregunta: el de la pregunta, no el de su recodificación. */
  codigo: string;
  etiqueta: string;
};

export type GrupoDePreguntas = {
  clave: string;
  /** El nombre de la sección; vacío si la hoja no la nombra. */
  nombre: string;
  preguntas: PreguntaDeLaLista[];
};

/** El grupo de las preguntas del catálogo cuya tabla el servicio todavía no devolvió. */
export const GRUPO_DEL_FORMULARIO = "Más preguntas del formulario";

type TablaDeLaHoja = { variable: string; etiqueta: string; seccion: { nombre: string } };
type VariableDelCatalogo = { name: string; label?: string | null };

/**
 * Las preguntas de la hoja agrupadas por sección, en el orden en que llegan:
 * un grupo nuevo empieza cuando cambia el nombre. Una pregunta que sale en dos
 * secciones se lista una vez, en la primera. Con la hoja recortada, las del
 * catálogo que la hoja no trae van al final, en su propio grupo.
 */
export function gruposDePreguntas<T extends TablaDeLaHoja>(
  tablas: readonly T[],
  codigoDe: (tabla: T) => string,
  catalogo: readonly VariableDelCatalogo[] = [],
  recortada = false,
): GrupoDePreguntas[] {
  const grupos: GrupoDePreguntas[] = [];
  const vistas = new Set<string>();
  for (const tabla of tablas) {
    const codigo = codigoDe(tabla);
    if (vistas.has(tabla.variable)) continue;
    vistas.add(tabla.variable);
    vistas.add(codigo);
    const pregunta = { variable: tabla.variable, codigo, etiqueta: tabla.etiqueta || codigo };
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nombre === tabla.seccion.nombre) {
      ultimo.preguntas.push(pregunta);
      continue;
    }
    grupos.push({ clave: `${grupos.length}/${tabla.seccion.nombre}`, nombre: tabla.seccion.nombre, preguntas: [pregunta] });
  }
  if (recortada) {
    const resto = catalogo
      .filter((v) => !vistas.has(v.name))
      .map((v) => ({ variable: v.name, codigo: v.name, etiqueta: v.label?.trim() || v.name }));
    if (resto.length > 0) grupos.push({ clave: `${grupos.length}/catalogo`, nombre: GRUPO_DEL_FORMULARIO, preguntas: resto });
  }
  return grupos;
}

/** Sin tildes ni mayúsculas, para buscar "edad" en "¿Cuál es su EDAD?". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").trim();
}

/** Los grupos con las preguntas cuya pregunta o código contienen lo buscado; los grupos vacíos se van. */
export function filtrarPreguntas(grupos: readonly GrupoDePreguntas[], consulta: string): GrupoDePreguntas[] {
  const q = normalizar(consulta);
  if (!q) return [...grupos];
  return grupos
    .map((g) => ({ ...g, preguntas: g.preguntas.filter((p) => normalizar(p.etiqueta).includes(q) || normalizar(p.codigo).includes(q) || normalizar(p.variable).includes(q)) }))
    .filter((g) => g.preguntas.length > 0);
}

/** El tope del ancho de la columna de códigos, en caracteres; uno más largo parte línea. */
export const CODIGO_MAS_ANCHO = 14;

/** El ancho de la columna de códigos: el del código más largo de la lista, con tope. */
export function anchoDeCodigos(grupos: readonly GrupoDePreguntas[]): string {
  const largo = Math.max(3, ...grupos.flatMap((g) => g.preguntas.filter((p) => p.codigo !== p.etiqueta).map((p) => p.codigo.length)));
  return `${Math.min(CODIGO_MAS_ANCHO, largo)}ch`;
}

/** Algún código pasa de este largo: en la columna angosta, el código va sobre la pregunta. */
export const CODIGO_LARGO = 8;

export function hayCodigosLargos(grupos: readonly GrupoDePreguntas[]): boolean {
  return grupos.some((g) => g.preguntas.some((p) => p.codigo !== p.etiqueta && p.codigo.length > CODIGO_LARGO));
}

/** Cuántas preguntas tiene la lista. */
export function contarPreguntas(grupos: readonly GrupoDePreguntas[]): number {
  return grupos.reduce((suma, g) => suma + g.preguntas.length, 0);
}

/** La pregunta corresponde a la elegida, por su nombre o por el código de la pregunta que recodifica. */
export function esLaElegida(pregunta: PreguntaDeLaLista, elegida: string | null): boolean {
  return elegida !== null && (pregunta.variable === elegida || pregunta.codigo === elegida);
}

/**
 * La pregunta que se ve: la de la dirección (`foco`) o, sin ella, la primera
 * de la hoja. La de la dirección vale aunque la hoja no la traiga: se pide aparte.
 */
export function preguntaQueSeVe(foco: string | null, grupos: readonly GrupoDePreguntas[]): string | null {
  if (foco) return foco;
  return grupos[0]?.preguntas[0]?.variable ?? null;
}
