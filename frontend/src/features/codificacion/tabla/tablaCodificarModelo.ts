// Modelo de la vista de tabla de Codificar (etapa P3b del rediseño de Procesamiento).
//
// Puro, sin React: qué filas se pintan y en qué orden, qué códigos ofrece la lista según lo que se
// escribe, a qué fila se salta después de asignar y qué hace cada tecla. Lo que una asignación le
// hace a los grupos vive en `asignacionCodigos.ts`, que comparten las dos vistas.

import type { Grupo, MarcaPrevia, RespuestaUnica } from "../../../api/codificacion";
import { grupoAccentColor } from "../codificacionGrupoColor";
import { displayCodificacionValueLabel, displayRespuestaLabel } from "../codificacionLabels";
import { avisoMarcaPrevia, type AvisoMarcaPrevia } from "../marcasPrevias";

export type OrdenTabla = "frecuencia" | "alfabetico";

/** Un código del libro, tal como lo pinta y lo busca la tabla. */
export type CodigoTabla = {
  /** Id del grupo. */
  id: string;
  /** El código tal como se guarda: es lo que se escribe para elegirlo por número. */
  codigo: string;
  /** El número que se pinta en la ficha; ausente cuando el código no es un identificador corto. */
  numero?: string;
  nombre: string;
  /** "9. Trabajo": para el `title` y el nombre accesible. */
  rotulo: string;
  /** Color estable del grupo, el mismo de las tarjetas. */
  acento: string;
  /** Casos que llevan este código: la suma de las veces de sus respuestas, como en la tarjeta del grupo. */
  casos: number;
};

/** Una fila de la tabla: un texto distinto con sus veces y sus códigos. */
export type FilaTabla = {
  /** `texto_normalizado` de la respuesta. */
  clave: string;
  texto: string;
  /** Código de la categoría cuando la respuesta es una opción del formulario. */
  codigoDeRespuesta?: string;
  titulo: string;
  veces: number;
  variantes: number;
  codigos: CodigoTabla[];
  /** Va en el tramo final de las no respuestas ("No", ".", "Ninguno"). */
  noResponde: boolean;
  yaMarcadas?: readonly MarcaPrevia[];
  /** Con "Agrupar parecidas": los textos casi iguales que la fila junta (`agruparParecidas`). */
  miembros?: readonly MiembroDeFila[];
};

/** Un texto que una fila junta por parecido: se lista debajo y recibe los mismos códigos. */
export type MiembroDeFila = { clave: string; texto: string; titulo: string; veces: number };

export type TramosDeRespuestas = {
  conContenido: readonly RespuestaUnica[];
  noRespuestas: readonly RespuestaUnica[];
};

/** Lo que se pinta dentro de la tabla, en orden: filas y, antes de las no respuestas, su separador. */
export type ElementoTabla =
  | { tipo: "fila"; fila: FilaTabla; posicion: number }
  | { tipo: "tramo"; n: number };

/** Una opción de la lista que se abre bajo la celda. */
export type OpcionLista =
  | { tipo: "codigo"; codigo: CodigoTabla; aviso: AvisoMarcaPrevia | null }
  | { tipo: "crear"; nombre: string };

/** Minúsculas, sin tildes y con los espacios reducidos: para comparar lo que se escribe. */
export function plegar(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Los grupos como códigos de la tabla, en el orden del libro. */
export function codigosDeTabla(grupos: readonly Grupo[], respuestas: readonly RespuestaUnica[]): CodigoTabla[] {
  const veces = new Map(respuestas.map((r) => [r.texto_normalizado, r.frecuencia ?? 0]));
  return grupos.map((g) => {
    const d = displayCodificacionValueLabel(g.codigo, g.etiqueta);
    const nombre = d.label || g.codigo;
    return {
      id: g.id,
      codigo: g.codigo,
      numero: d.code,
      nombre,
      rotulo: d.code ? `${d.code}. ${nombre}` : nombre,
      acento: grupoAccentColor(g.codigo, g.id),
      casos: g.respuestas.reduce((suma, t) => suma + (veces.get(t) ?? 0), 0),
    };
  });
}

function compararTexto(a: string, b: string): number {
  const pa = plegar(a);
  const pb = plegar(b);
  if (pa !== pb) return pa < pb ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function ordenar(filas: FilaTabla[], orden: OrdenTabla): FilaTabla[] {
  return [...filas].sort((a, b) =>
    orden === "frecuencia" && a.veces !== b.veces ? b.veces - a.veces : compararTexto(a.texto, b.texto),
  );
}

/**
 * Las filas de la tabla: una por texto distinto. Las no respuestas van al final, en su tramo; cada tramo
 * se ordena por separado.
 */
export function filasDeTabla(
  tramos: TramosDeRespuestas,
  grupos: readonly Grupo[],
  codigos: readonly CodigoTabla[],
  orden: OrdenTabla,
): FilaTabla[] {
  const porId = new Map(codigos.map((c) => [c.id, c]));
  const porClave = new Map<string, CodigoTabla[]>();
  for (const g of grupos) {
    const codigo = porId.get(g.id);
    if (!codigo) continue;
    for (const clave of g.respuestas) {
      const lista = porClave.get(clave) ?? [];
      if (!lista.some((c) => c.id === codigo.id)) lista.push(codigo);
      porClave.set(clave, lista);
    }
  }
  const fila = (r: RespuestaUnica, noResponde: boolean): FilaTabla => {
    const d = displayRespuestaLabel(r.texto, r.label);
    return {
      clave: r.texto_normalizado,
      texto: d.label,
      codigoDeRespuesta: d.code,
      titulo: d.title,
      veces: r.frecuencia ?? 0,
      variantes: r.variantes ?? 1,
      codigos: porClave.get(r.texto_normalizado) ?? [],
      noResponde,
      yaMarcadas: r.ya_marcadas,
    };
  };
  return [
    ...ordenar(tramos.conContenido.map((r) => fila(r, false)), orden),
    ...ordenar(tramos.noRespuestas.map((r) => fila(r, true)), orden),
  ];
}

/** Las filas con el separador de las no respuestas intercalado, si las hay. */
export function elementosDeTabla(filas: readonly FilaTabla[]): ElementoTabla[] {
  const elementos: ElementoTabla[] = [];
  const noResponden = filas.filter((f) => f.noResponde).length;
  let separado = false;
  filas.forEach((fila, posicion) => {
    if (fila.noResponde && !separado) {
      elementos.push({ tipo: "tramo", n: noResponden });
      separado = true;
    }
    elementos.push({ tipo: "fila", fila, posicion });
  });
  return elementos;
}

/** Qué tan bien casa un código con lo escrito: menor es mejor; `null` si no casa. */
function puntaje(codigo: CodigoTabla, consulta: string): number | null {
  const numero = plegar(codigo.codigo);
  const nombre = plegar(codigo.nombre);
  if (numero === consulta) return 0;
  if (numero.startsWith(consulta)) return 1;
  if (nombre.startsWith(consulta) || `${numero} ${nombre}`.startsWith(consulta)) return 2;
  if (nombre.split(" ").some((palabra) => palabra.startsWith(consulta))) return 3;
  if (nombre.includes(consulta)) return 4;
  return null;
}

/**
 * Los códigos que casan con lo escrito, por número o por parte del nombre, sin distinguir tildes ni
 * mayúsculas. El número exacto va primero; a igual puntaje se respeta el orden del libro. Sin texto
 * devuelve todos.
 */
export function filtrarCodigos(codigos: readonly CodigoTabla[], consulta: string): CodigoTabla[] {
  // "9. tra" se lee como "9 tra": quien copia el rótulo entero también encuentra el código.
  const q = plegar(consulta).replace(/^(\S+?)\.\s*/, "$1 ").trim();
  if (!q) return [...codigos];
  return codigos
    .map((codigo, i) => ({ codigo, i, p: puntaje(codigo, q) }))
    .filter((x): x is { codigo: CodigoTabla; i: number; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.codigo);
}

/**
 * El nombre del código que se crearía con lo escrito, o `null` cuando no corresponde ofrecerlo: no hay
 * texto, es solo un número (eso busca un código, no lo nombra) o ya existe un código con ese nombre.
 */
export function nombreDeCodigoNuevo(consulta: string, codigos: readonly CodigoTabla[]): string | null {
  const limpio = (consulta ?? "").replace(/\s+/g, " ").trim();
  if (!limpio || !/\p{L}/u.test(limpio)) return null;
  const plegado = plegar(limpio);
  if (codigos.some((c) => plegar(c.nombre) === plegado)) return null;
  return limpio.charAt(0).toLocaleUpperCase("es") + limpio.slice(1);
}

/**
 * Lo que ofrece la lista de una fila: los códigos que casan y que la fila todavía no tiene y, al final,
 * crear uno con lo escrito.
 */
export function opcionesDeLista(codigos: readonly CodigoTabla[], fila: FilaTabla, consulta: string): OpcionLista[] {
  const propios = new Set(fila.codigos.map((c) => c.id));
  const opciones: OpcionLista[] = filtrarCodigos(codigos.filter((c) => !propios.has(c.id)), consulta).map((codigo) => ({
    tipo: "codigo",
    codigo,
    aviso: avisoMarcaPrevia(codigo.codigo, fila.yaMarcadas, fila.veces),
  }));
  const nombre = nombreDeCodigoNuevo(consulta, codigos);
  if (nombre) opciones.push({ tipo: "crear", nombre });
  return opciones;
}

/** La fila de arriba o de abajo; en los extremos se queda donde está. */
export function filaVecina(filas: readonly FilaTabla[], clave: string | null, paso: 1 | -1): string | null {
  if (filas.length === 0) return null;
  const i = filas.findIndex((f) => f.clave === clave);
  if (i < 0) return filas[0].clave;
  return filas[Math.min(filas.length - 1, Math.max(0, i + paso))].clave;
}

/**
 * La siguiente fila sin código después de `clave`: primero hacia abajo y, si abajo no queda ninguna,
 * desde arriba. `null` cuando no hay otra fila sin código. La propia fila no cuenta: al llamarla
 * acaba de recibir su código.
 */
export function filaSiguienteSinCodigo(filas: readonly FilaTabla[], clave: string): string | null {
  const i = filas.findIndex((f) => f.clave === clave);
  const desde = i < 0 ? 0 : i + 1;
  const candidatas = [...filas.slice(desde), ...filas.slice(0, Math.max(0, i))];
  return candidatas.find((f) => f.codigos.length === 0 && f.clave !== clave)?.clave ?? null;
}

/**
 * La fila activa que vale para las filas de hoy: la primera de las candidatas que siga a la vista (la que
 * eligió el analista y, si ya no está, la última que estuvo activa). Sin ninguna, la primera sin código.
 */
export function claveActivaVigente(filas: readonly FilaTabla[], ...candidatas: (string | null)[]): string | null {
  for (const clave of candidatas) {
    if (clave !== null && filas.some((f) => f.clave === clave)) return clave;
  }
  return (filas.find((f) => f.codigos.length === 0) ?? filas[0])?.clave ?? null;
}

// ---- El campo de la fila activa -------------------------------------------------------------------

export type EstadoEditor = {
  /** La fila que el analista eligió; `null` deja que la tabla proponga la primera sin código. */
  activa: string | null;
  texto: string;
  abierta: boolean;
  /** Opción resaltada de la lista. */
  cursor: number;
};

export const EDITOR_INICIAL: EstadoEditor = { activa: null, texto: "", abierta: false, cursor: 0 };

export type AccionEditor =
  /** Pasa a la fila `clave` (o se queda en ella) con el campo vacío y la lista cerrada. */
  | { tipo: "activar"; clave: string }
  | { tipo: "escribir"; clave: string; texto: string }
  | { tipo: "abrir"; clave: string }
  | { tipo: "cerrar" }
  | { tipo: "cursor"; indice: number };

/**
 * El estado del campo. Escribir o abrir la lista fija la fila en la que se hace: así lo escrito nunca
 * pasa a otra fila si la tabla cambia por debajo (una búsqueda, un código asignado desde las tarjetas).
 */
export function reducirEditor(estado: EstadoEditor, accion: AccionEditor): EstadoEditor {
  switch (accion.tipo) {
    case "activar":
      return { activa: accion.clave, texto: "", abierta: false, cursor: 0 };
    case "escribir":
      return { activa: accion.clave, texto: accion.texto, abierta: accion.texto.trim() !== "", cursor: 0 };
    case "abrir":
      return estado.abierta && estado.activa === accion.clave
        ? estado
        : { activa: accion.clave, texto: estado.activa === accion.clave ? estado.texto : "", abierta: true, cursor: 0 };
    case "cerrar":
      return estado.abierta ? { ...estado, abierta: false } : estado;
    case "cursor":
      return estado.cursor === accion.indice ? estado : { ...estado, cursor: accion.indice };
  }
}

/** Lo que el campo de la fila `clave` muestra: lo escrito y la lista solo valen para la fila en que se escribieron. */
export function campoDeLaFila(estado: EstadoEditor, clave: string | null): { texto: string; abierta: boolean } {
  const propia = clave !== null && estado.activa === clave;
  return { texto: propia ? estado.texto : "", abierta: propia && estado.abierta };
}

export type TeclaDelCampo = { key: string; shiftKey: boolean; altKey: boolean; repeat?: boolean };

export type ContextoDeTecla = {
  abierta: boolean;
  /** Opciones que la lista muestra ahora. */
  nOpciones: number;
  texto: string;
  /** La pregunta admite más de un código por respuesta. */
  permiteVarios: boolean;
  /** Códigos que ya tiene la fila activa. */
  nCodigos: number;
};

export type IntencionDeTecla =
  | { tipo: "mover-fila"; paso: 1 | -1 }
  | { tipo: "mover-cursor"; paso: 1 | -1 }
  /** Asigna la opción resaltada; `avanza` salta a la siguiente fila sin código. */
  | { tipo: "asignar"; avanza: boolean }
  | { tipo: "abrir" }
  | { tipo: "cerrar" }
  | { tipo: "limpiar" }
  | { tipo: "quitar-ultimo" };

/**
 * Qué pide una tecla en el campo de la fila activa. `null` deja la tecla al navegador.
 *
 * - Flechas: con la lista abierta recorren sus opciones; cerrada, cambian de fila.
 * - Enter asigna la opción resaltada y baja. Mayús y Enter asigna y se queda en la fila para sumar otro
 *   código, solo cuando la pregunta admite varios: si no, no hace nada.
 * - Escape cierra la lista; con la lista cerrada, borra lo escrito.
 * - Retroceso con el campo vacío quita el último código de la fila (no al mantener la tecla).
 */
export function intencionDeTecla(tecla: TeclaDelCampo, ctx: ContextoDeTecla): IntencionDeTecla | null {
  const listaConOpciones = ctx.abierta && ctx.nOpciones > 0;
  switch (tecla.key) {
    case "ArrowDown":
    case "ArrowUp": {
      const paso = tecla.key === "ArrowDown" ? 1 : -1;
      if (tecla.altKey) return paso === 1 ? (ctx.abierta ? null : { tipo: "abrir" }) : ctx.abierta ? { tipo: "cerrar" } : null;
      return listaConOpciones ? { tipo: "mover-cursor", paso } : { tipo: "mover-fila", paso };
    }
    case "Enter":
      if (listaConOpciones) {
        if (!tecla.shiftKey) return { tipo: "asignar", avanza: true };
        return ctx.permiteVarios ? { tipo: "asignar", avanza: false } : null;
      }
      if (tecla.shiftKey || ctx.abierta) return null;
      return ctx.texto.trim() ? { tipo: "abrir" } : { tipo: "mover-fila", paso: 1 };
    case "Escape":
      if (ctx.abierta) return { tipo: "cerrar" };
      return ctx.texto ? { tipo: "limpiar" } : null;
    case "Backspace":
      return ctx.texto === "" && ctx.nCodigos > 0 && !tecla.repeat ? { tipo: "quitar-ultimo" } : null;
    default:
      return null;
  }
}

// ---------- Dónde va la lista de códigos ----------

export type CajaDelCampo = { left: number; right: number; top: number; bottom: number; width: number };
export type PosicionDeLista = { left: number; width: number; maxHeight: number } & ({ top: number } | { bottom: number });

export const LISTA_ALTO_MAXIMO = 280;
export const LISTA_ANCHO_MINIMO = 320;
const LISTA_MARGEN = 8;
const LISTA_SEPARACION = 4;

/**
 * La lista se pega a su campo: debajo, o encima si abajo no cabe y arriba hay más sitio. Cuando es más
 * ancha que el campo crece hacia la izquierda, porque el borde derecho del campo es el de la columna de
 * la tabla: pasarlo es montarse sobre la columna de grupos.
 */
export function posicionDeLista(campo: CajaDelCampo, ventana: { ancho: number; alto: number }): PosicionDeLista {
  const width = Math.min(Math.max(LISTA_ANCHO_MINIMO, campo.width), ventana.ancho - 2 * LISTA_MARGEN);
  const left = Math.min(Math.max(LISTA_MARGEN, campo.right - width), ventana.ancho - width - LISTA_MARGEN);
  const abajo = ventana.alto - campo.bottom - LISTA_MARGEN;
  const arriba = campo.top - LISTA_MARGEN;
  const haciaArriba = abajo < LISTA_ALTO_MAXIMO && arriba > abajo;
  const maxHeight = Math.max(0, Math.min(LISTA_ALTO_MAXIMO, haciaArriba ? arriba : abajo) - LISTA_SEPARACION);
  return haciaArriba
    ? { left, width, bottom: ventana.alto - campo.top + LISTA_SEPARACION, maxHeight }
    : { left, width, top: campo.bottom + LISTA_SEPARACION, maxHeight };
}
