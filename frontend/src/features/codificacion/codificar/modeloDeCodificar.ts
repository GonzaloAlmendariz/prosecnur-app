// Lo que pinta la vista de tarjetas de Codificar (etapa P3c). Puro, sin React: las filas de la lista, las
// tarjetas de los códigos con sus respuestas, las cifras de la cabecera y el aviso de "ya marcada" para
// un lote de respuestas.

import type { Grupo, MarcaPrevia, RespuestaUnica } from "../../../api/codificacion";
import { formatoConteo } from "../../../lib/formatoNumero";
import { displayRespuestaLabel } from "../codificacionLabels";
import { avisoMarcaPrevia, type AvisoMarcaPrevia } from "../marcasPrevias";
import { codigosDeTabla, type CodigoTabla, type TramosDeRespuestas } from "../tabla/tablaCodificarModelo";

export type FiltroDeRespuestas = "todas" | "sin-codigo";

/** Deja solo las respuestas sin código cuando el filtro lo pide. */
export function filtrarPorCodigo<T extends { texto_normalizado: string }>(
  respuestas: readonly T[],
  grupos: readonly Grupo[],
  filtro: FiltroDeRespuestas,
): T[] {
  if (filtro === "todas") return [...respuestas];
  const asignadas = new Set(grupos.flatMap((g) => g.respuestas));
  return respuestas.filter((r) => !asignadas.has(r.texto_normalizado));
}

/** Las respuestas que casan con lo buscado, por su texto o por su clave. */
export function buscarRespuestas<T extends { texto: string; texto_normalizado: string }>(respuestas: readonly T[], consulta: string): T[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [...respuestas];
  return respuestas.filter((r) => r.texto.toLowerCase().includes(q) || r.texto_normalizado.includes(q));
}

/** Una respuesta de la lista: su texto entero, sus veces y los códigos que lleva. */
export type FilaDeRespuesta = {
  /** `texto_normalizado`. */
  clave: string;
  texto: string;
  /** Código de la categoría cuando la respuesta es una opción del formulario. */
  codigoDeRespuesta?: string;
  titulo: string;
  veces: number;
  variantes: number;
  codigos: CodigoTabla[];
  noResponde: boolean;
};

/** Las filas en el orden en que llegan, con las no respuestas al final. */
export function filasDeRespuestas(tramos: TramosDeRespuestas, grupos: readonly Grupo[], codigos: readonly CodigoTabla[]): FilaDeRespuesta[] {
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
  const fila = (r: RespuestaUnica, noResponde: boolean): FilaDeRespuesta => {
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
    };
  };
  return [...tramos.conContenido.map((r) => fila(r, false)), ...tramos.noRespuestas.map((r) => fila(r, true))];
}

/** Una respuesta dentro de la tarjeta de su código. */
export type RespuestaDeTarjeta = {
  clave: string;
  texto: string;
  titulo: string;
  veces: number;
  /** `false` para un texto guardado en el código que la base actual ya no trae: no suma respuestas ni casos. */
  enBase: boolean;
};

/** La tarjeta de un código: el código, cuántas respuestas y casos lleva y cuáles son. */
export type TarjetaDeCodigo = {
  grupo: Grupo;
  codigo: CodigoTabla;
  /** En el orden en que se asignaron. Una clave que la base ya no trae se muestra tal cual, sin veces. */
  respuestas: RespuestaDeTarjeta[];
};

export function tarjetasDeCodigos(grupos: readonly Grupo[], respuestas: readonly RespuestaUnica[]): TarjetaDeCodigo[] {
  const porClave = new Map(respuestas.map((r) => [r.texto_normalizado, r]));
  const codigos = codigosDeTabla(grupos, respuestas);
  return grupos.map((grupo, i) => ({
    grupo,
    codigo: codigos[i],
    respuestas: grupo.respuestas.map((clave) => {
      const r = porClave.get(clave);
      const d = displayRespuestaLabel(r?.texto ?? clave, r?.label);
      return { clave, texto: d.label, titulo: d.title, veces: r?.frecuencia ?? 0, enBase: r !== undefined };
    }),
  }));
}

/**
 * Lo que cuenta la tarjeta de un código, con la misma regla del contador de la pregunta (`avanceRespuestas`):
 * respuestas y casos salen solo de los textos que la base trae hoy. Los textos guardados que la base ya
 * no trae (se cambió o se limpió la fuente) se cuentan aparte, para que se vean y se puedan quitar.
 */
export function cifrasDeTarjeta(tarjeta: TarjetaDeCodigo): { respuestas: number; casos: number; fueraDeLaBase: number } {
  const enBase = tarjeta.respuestas.filter((r) => r.enBase);
  return {
    respuestas: enBase.length,
    casos: enBase.reduce((suma, r) => suma + r.veces, 0),
    fueraDeLaBase: tarjeta.respuestas.length - enBase.length,
  };
}

/** Respuestas de una tarjeta que se ven sin pedir más. */
export const RESPUESTAS_A_LA_VISTA = 3;

// ---------- Cifras de la cabecera ----------

export type CifraDeCasos = {
  id: string;
  valor: number;
  /** La base de la cifra cuando se conoce: cuántas personas marcaron "Otros". */
  de?: number;
  singular: string;
  plural: string;
  /** Lo que la cifra no dice a la vista y se lee al pasar sobre ella. */
  detalle?: string;
  aviso?: boolean;
};

/** Los casos que escribieron algo en la pregunta: la suma de las veces de todas sus respuestas. */
export function sumarCasosConTexto(respuestas: readonly RespuestaUnica[]): number {
  return respuestas.reduce((suma, r) => suma + (r.frecuencia ?? 0), 0);
}

/**
 * Las cifras en casos de una pregunta múltiple con "Otros, especifique". Una persona es un caso; una
 * respuesta de la lista junta a todas las que escribieron lo mismo.
 *
 * - con código: suma de las veces de las respuestas de la lista que tienen algún código, sobre las
 *   personas que marcaron "Otros" cuando el motor entrega ese total;
 * - con texto: suma de las veces de todas las respuestas.
 *
 * Los casos sin código son la diferencia entre los dos números de la primera cifra; van en su detalle.
 */
export function cifrasDeCasos(
  respuestas: readonly RespuestaUnica[],
  grupos: readonly Grupo[],
  marcaronOtros: number | null | undefined,
): CifraDeCasos[] {
  const asignadas = new Set(grupos.flatMap((g) => g.respuestas));
  const conTexto = sumarCasosConTexto(respuestas);
  const conCodigo = respuestas.reduce((suma, r) => suma + (asignadas.has(r.texto_normalizado) ? r.frecuencia ?? 0 : 0), 0);
  const otros = typeof marcaronOtros === "number" && Number.isFinite(marcaronOtros) ? marcaronOtros : null;
  const casos = (n: number) => (n === 1 ? "1 caso" : `${formatoConteo(n)} casos`);
  const conCodigoCifra: CifraDeCasos =
    otros === null
      ? { id: "con-codigo", valor: conCodigo, singular: "caso con código", plural: "casos con código" }
      : {
          id: "con-codigo",
          valor: conCodigo,
          de: otros,
          singular: "caso con código",
          plural: "casos con código",
          detalle: `${otros === 1 ? "1 persona marcó" : `${formatoConteo(otros)} personas marcaron`} Otros: ${casos(conCodigo)} con código y ${casos(Math.max(0, otros - conCodigo))} sin código`,
          aviso: otros - conCodigo > 0,
        };
  return [conCodigoCifra, { id: "con-texto", valor: conTexto, singular: "con texto", plural: "con texto" }];
}

// ---------- "Ya marcada" para un lote ----------

/**
 * Las marcas previas de varias respuestas juntas y las veces que suman: lo que necesita `avisoMarcaPrevia`
 * para decir, de un código, cuántas de esas personas ya lo tenían marcado.
 */
export function marcasDelLote(respuestas: readonly RespuestaUnica[], claves: readonly string[]): { marcas: MarcaPrevia[]; veces: number } {
  const elegidas = new Set(claves);
  const porCodigo = new Map<string, number>();
  let veces = 0;
  for (const r of respuestas) {
    if (!elegidas.has(r.texto_normalizado)) continue;
    veces += r.frecuencia ?? 0;
    for (const m of r.ya_marcadas ?? []) {
      const codigo = (m.codigo ?? "").trim();
      const n = Number.isFinite(m.n) ? Math.max(0, Math.trunc(m.n)) : 0;
      if (codigo && n > 0) porCodigo.set(codigo, (porCodigo.get(codigo) ?? 0) + n);
    }
  }
  return { marcas: [...porCodigo].map(([codigo, n]) => ({ codigo, n })), veces };
}

/** El aviso de "ya marcada" de un código para un lote, con la frase que se lee en su tarjeta. */
export type AvisoDelLote = AvisoMarcaPrevia & {
  /** Personas del lote que ya tenían marcada la opción del código. */
  n: number;
  /** Personas del lote (las veces que suman sus respuestas). */
  total: number;
  /** En llano y con su base: "3 de 4 casos ya tenían marcada esta opción". */
  frase: string;
};

/** La frase del aviso: cuántos de los casos del lote ya tenían marcada la opción, sobre cuántos. */
export function fraseDeMarcaPrevia(n: number, total: number): string {
  if (n >= total) return total === 1 ? "El caso ya tenía marcada esta opción" : `Los ${formatoConteo(total)} casos ya tenían marcada esta opción`;
  return `${formatoConteo(n)} de ${formatoConteo(total)} casos ya tenían marcada esta opción`;
}

/**
 * El aviso de "ya marcada" de cada código para ese lote; solo los códigos que lo tienen. Mide personas: de
 * las que escribieron las respuestas del lote, cuántas ya habían marcado esa opción en la pregunta. Para
 * ellas, asignarles el código no suma una mención.
 */
export function avisosDelLote(
  codigos: readonly CodigoTabla[],
  respuestas: readonly RespuestaUnica[],
  claves: readonly string[],
): Map<string, AvisoDelLote> {
  const avisos = new Map<string, AvisoDelLote>();
  if (claves.length === 0) return avisos;
  const { marcas, veces } = marcasDelLote(respuestas, claves);
  if (marcas.length === 0) return avisos;
  for (const c of codigos) {
    const aviso = avisoMarcaPrevia(c.codigo, marcas, veces);
    if (!aviso) continue;
    const n = marcas.find((m) => m.codigo === c.codigo.trim())?.n ?? 0;
    const total = Math.max(n, veces);
    avisos.set(c.id, { ...aviso, n, total, frase: fraseDeMarcaPrevia(n, total) });
  }
  return avisos;
}

// ---------- Respuestas parecidas a las de un código ----------

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  let actual = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    actual[0] = i;
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [previa, actual] = [actual, previa];
  }
  return previa[b.length];
}

/** Parecido de 0 a 1 entre dos textos, sobre el más largo. */
export function parecido(a: string, b: string): number {
  const largo = Math.max(a.length, b.length);
  return largo === 0 ? 1 : 1 - distancia(a, b) / largo;
}

export type RespuestaParecida = { clave: string; texto: string; titulo: string; veces: number; parecido: number };

const PARECIDO_MINIMO = 0.35;
const PARECIDAS_A_MOSTRAR = 6;

/**
 * Las respuestas que más se parecen a las que ya lleva el código y que todavía se le pueden asignar:
 * las que no tiene y, si la pregunta admite un solo código por respuesta, las que no tienen ninguno.
 */
export function respuestasParecidas(
  grupo: Grupo,
  grupos: readonly Grupo[],
  respuestas: readonly RespuestaUnica[],
  permiteVarios: boolean,
): RespuestaParecida[] {
  if (grupo.respuestas.length === 0) return [];
  const propias = new Set(grupo.respuestas);
  const conCodigo = permiteVarios ? new Set<string>() : new Set(grupos.flatMap((g) => g.respuestas));
  const candidatas: RespuestaParecida[] = [];
  for (const r of respuestas) {
    if (propias.has(r.texto_normalizado) || conCodigo.has(r.texto_normalizado)) continue;
    let mayor = 0;
    for (const semilla of grupo.respuestas) {
      mayor = Math.max(mayor, parecido(r.texto_normalizado, semilla));
      if (mayor >= 0.99) break;
    }
    if (mayor < PARECIDO_MINIMO) continue;
    const d = displayRespuestaLabel(r.texto, r.label);
    candidatas.push({ clave: r.texto_normalizado, texto: d.label, titulo: d.title, veces: r.frecuencia ?? 0, parecido: mayor });
  }
  return candidatas.sort((a, b) => b.parecido - a.parecido).slice(0, PARECIDAS_A_MOSTRAR);
}
