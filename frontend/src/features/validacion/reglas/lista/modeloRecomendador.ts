/**
 * Cómo se presentan las sugeridas de la base y las sugerencias del detector
 * (ítem 40), sin pintar.
 *
 * El motor manda cada propuesta como prosa: el nombre de la pregunta va con su
 * enunciado completo, entre comillas y con el código entre paréntesis, en el título y otra vez en el
 * porqué, y los ejemplos van entre comillas dentro de la frase. Aquí la frase
 * se parte en piezas: la referencia a la pregunta queda como su código (el
 * enunciado se muestra una sola vez, en la ficha de la pregunta), y los valores
 * entre comillas pasan a ser fichas.
 *
 * La etiqueta de cada pregunta sale de lo que ya llega al front: el rótulo que
 * manda el detector (`variables[].rotulo`, del formulario) o, si falta, la del
 * inventario de la base (`label` del XLSForm o la etiqueta de la columna en un
 * SPSS). Una columna fuera del formulario y sin etiqueta queda con su nombre.
 */
import type { TipoDePregunta } from "../../../../components/procesamiento/FichaPregunta";
import type { PreguntaDeSugerencia, SugerenciaParaRevisar } from "../../../../api/validacionDetector";
import type { ExploradorVariablesList, ReglaSemilla } from "../../types";
import { tipoDeFicha } from "../campos/tipoDeFicha";

export type PreguntaDelRecomendador = {
  codigo: string;
  /** El enunciado de la pregunta; `null` si ni el formulario ni la base lo traen. */
  etiqueta: string | null;
  tipo: TipoDePregunta;
};

export type PiezaDeFrase =
  | { tipo: "texto"; texto: string }
  | { tipo: "codigo"; texto: string }
  | { tipo: "valores"; valores: string[] };

export type IndiceDePreguntas = ReadonlyMap<string, { etiqueta: string | null; tipo: TipoDePregunta }>;

/** Etiqueta y tipo de cada columna del inventario; una etiqueta igual al nombre no cuenta. */
export function indiceDePreguntas(inventario: ExploradorVariablesList | null | undefined): IndiceDePreguntas {
  const indice = new Map<string, { etiqueta: string | null; tipo: TipoDePregunta }>();
  for (const seccion of inventario?.secciones ?? []) {
    for (const v of seccion.variables ?? []) {
      const etiqueta = (v.label ?? "").trim();
      indice.set(v.name, { etiqueta: etiqueta && etiqueta !== v.name ? etiqueta : null, tipo: tipoDeFicha(v.tipo) });
    }
  }
  return indice;
}

function pregunta(codigo: string, indice: IndiceDePreguntas, rotulo?: string | null): PreguntaDelRecomendador {
  const delIndice = indice.get(codigo);
  const etiqueta = (rotulo ?? "").trim() || delIndice?.etiqueta || null;
  return { codigo, etiqueta: etiqueta && etiqueta !== codigo ? etiqueta : null, tipo: delIndice?.tipo ?? "texto" };
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Comillas de la casa: las angulares pasan a rectas y la raya a coma. */
function deLaCasa(texto: string): string {
  return texto.replace(/[\u00ab\u00bb\u201c\u201d]/g, '"').replace(/\s*[\u2013\u2014]\s*/g, ", ");
}

const SEPARADOR_DE_VALORES = /^(,\s*|\s+[oy]\s+|,\s+[oy]\s+)$/;

/** Junta valores seguidos ("A", "B" o "C") en una sola pieza y les quita los paréntesis que los envolvían. */
function agrupar(piezas: PiezaDeFrase[]): PiezaDeFrase[] {
  const out: PiezaDeFrase[] = [];
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i];
    const previa = out[out.length - 1];
    const anterior = out[out.length - 2];
    if (
      p.tipo === "valores" &&
      previa?.tipo === "texto" &&
      SEPARADOR_DE_VALORES.test(previa.texto) &&
      anterior?.tipo === "valores"
    ) {
      out.pop();
      anterior.valores.push(...p.valores);
      continue;
    }
    out.push(p.tipo === "valores" ? { tipo: "valores", valores: [...p.valores] } : { ...p });
  }
  // "(…)" alrededor de un grupo de fichas sobra: las fichas ya lo separan.
  for (let i = 1; i < out.length - 1; i++) {
    const antes = out[i - 1];
    const despues = out[i + 1];
    if (out[i].tipo === "valores" && antes.tipo === "texto" && despues.tipo === "texto" &&
        antes.texto.endsWith("(") && despues.texto.startsWith(")")) {
      antes.texto = antes.texto.slice(0, -1).trimEnd() + " ";
      despues.texto = despues.texto.slice(1);
    }
  }
  return out.filter((p) => p.tipo !== "texto" || p.texto.length > 0);
}

/**
 * Parte una frase del motor en texto, códigos de pregunta y fichas de valores.
 * `etiquetas` recoge el enunciado que venía entre comillas junto al código,
 * para mostrarlo en la ficha de la pregunta aunque el inventario no lo tenga.
 */
export function piezasDeFrase(
  texto: string,
  codigos: readonly string[],
  indice: IndiceDePreguntas = new Map(),
  etiquetas: Map<string, string> = new Map(),
): PiezaDeFrase[] {
  const limpio = deLaCasa(texto);
  const vars = [...new Set(codigos.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!limpio) return [];
  const V = vars.length ? vars.map(escapar).join("|") : "(?!)";
  const conocidas = vars.map((v) => indice.get(v)?.etiqueta).filter((e): e is string => !!e);
  const L = conocidas.length ? conocidas.sort((a, b) => b.length - a.length).map(escapar).join("|") : "(?!)";
  // 1-2: "Enunciado" (código); 3: Enunciado (código); 4: "valor"; 5: código suelto.
  const re = new RegExp(
    `"([^"]*)" \\((${V})\\)|(?:${L}) \\((${V})\\)|"([^"]*)"|(?<![\\p{L}\\p{N}_])(${V})(?![\\p{L}\\p{N}_])`,
    "gu",
  );
  const piezas: PiezaDeFrase[] = [];
  let desde = 0;
  for (const m of limpio.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > desde) piezas.push({ tipo: "texto", texto: limpio.slice(desde, i) });
    if (m[2]) {
      if (m[1] && !etiquetas.has(m[2])) etiquetas.set(m[2], m[1]);
      piezas.push({ tipo: "codigo", texto: m[2] });
    } else if (m[3]) {
      piezas.push({ tipo: "codigo", texto: m[3] });
    } else if (m[4] !== undefined) {
      piezas.push({ tipo: "valores", valores: [m[4]] });
    } else if (m[5]) {
      piezas.push({ tipo: "codigo", texto: m[5] });
    }
    desde = i + m[0].length;
  }
  if (desde < limpio.length) piezas.push({ tipo: "texto", texto: limpio.slice(desde) });
  return agrupar(piezas);
}

export type SugeridaPresentada = {
  titulo: PiezaDeFrase[];
  /** La pregunta que mira, con su enunciado una sola vez; `null` si no hay enunciado. */
  pregunta: PreguntaDelRecomendador | null;
  porque: PiezaDeFrase[];
  casosHoy: number | null;
};

/** "Fuera de la lista de opciones: p6" con la ficha de p6 debajo: el código del final sobra. */
function sinCodigoAlFinal(titulo: PiezaDeFrase[], codigo: string): PiezaDeFrase[] {
  const ultima = titulo[titulo.length - 1];
  const previa = titulo[titulo.length - 2];
  if (ultima?.tipo !== "codigo" || ultima.texto !== codigo || previa?.tipo !== "texto" || !/:\s*$/.test(previa.texto)) return titulo;
  return [...titulo.slice(0, -2), { tipo: "texto", texto: previa.texto.replace(/:\s*$/, "") }];
}

function codigoDeSemilla(s: ReglaSemilla): string | null {
  const meta = s.semilla as Record<string, unknown>;
  const candidatos = [s.variables?.[0], meta.variable, meta.columna];
  const v = candidatos.find((c): c is string => typeof c === "string" && c.length > 0);
  return v ?? null;
}

/** Una sugerida de la base: título y porqué con la pregunta por su código; el enunciado va en su ficha. */
export function presentarSugerida(s: ReglaSemilla, indice: IndiceDePreguntas = new Map()): SugeridaPresentada {
  const codigo = codigoDeSemilla(s);
  const codigos = codigo ? [codigo] : [];
  const etiquetas = new Map<string, string>();
  const titulo = piezasDeFrase(s.nombre, codigos, indice, etiquetas);
  const porque = piezasDeFrase(String(s.semilla?.porque ?? ""), codigos, indice, etiquetas);
  const nombrada = codigo ? [...titulo, ...porque].some((p) => p.tipo === "codigo" && p.texto === codigo) : false;
  const ficha = codigo && nombrada ? pregunta(codigo, indice, etiquetas.get(codigo)) : null;
  return {
    titulo: ficha?.etiqueta ? sinCodigoAlFinal(titulo, ficha.codigo) : titulo,
    // Sin enunciado, la ficha repetiría el código que ya está en la frase.
    pregunta: ficha?.etiqueta ? ficha : null,
    porque,
    casosHoy: typeof s.semilla?.n_casos_hoy === "number" ? s.semilla.n_casos_hoy : null,
  };
}

export type SugerenciaPresentada = {
  titulo: PiezaDeFrase[];
  preguntas: PreguntaDelRecomendador[];
  frase: PiezaDeFrase[];
};

/** Una sugerencia del detector: título y frase con códigos y fichas; sus preguntas con su enunciado. */
export function presentarSugerencia(s: SugerenciaParaRevisar, indice: IndiceDePreguntas = new Map()): SugerenciaPresentada {
  const codigos = s.variables.map((v) => v.variable);
  return {
    titulo: piezasDeFrase(s.titulo, codigos, indice),
    // Solo las que traen enunciado: sin él, la ficha repetiría el código del título.
    preguntas: s.variables.map((v) => pregunta(v.variable, indice, v.rotulo)).filter((p) => p.etiqueta),
    frase: piezasDeFrase(s.texto, codigos, indice),
  };
}

/** El rótulo de la sugerencia de datos personales, el mismo con una o varias columnas. */
export const ROTULO_DATO_PERSONAL = "Dato potencialmente personal identificado";

export type ColumnaPersonal = {
  pregunta: PreguntaDelRecomendador;
  /** "Parece teléfono"; `null` si la frase del motor no se pudo partir. */
  causa: string | null;
  /** "9 dígitos en el 97 % de los casos con dato". */
  detalle: string | null;
};

export type DatosPersonales = { columnas: ColumnaPersonal[]; nota: string | null };

export function esDatoPersonal(s: SugerenciaParaRevisar): boolean {
  return s.tipo === "dato_personal";
}

/**
 * Las columnas de la sugerencia de datos personales, una por fila. El motor las
 * manda en una sola frase ("telefono: Parece teléfono: 9 dígitos en el 97 % de
 * los casos con dato. hora_fin_h: …. Si identifica a una persona, …"); se parte
 * por el nombre de cada columna, en el orden de `variables`, y la última
 * oración queda como nota.
 */
export function datosPersonales(s: SugerenciaParaRevisar, indice: IndiceDePreguntas = new Map()): DatosPersonales {
  const texto = deLaCasa(s.texto).trim();
  const vars: PreguntaDeSugerencia[] = s.variables;
  const inicios = vars.map(() => -1);
  let cursor = 0;
  vars.forEach((v, i) => {
    const at = texto.indexOf(`${v.variable}: `, cursor);
    if (at >= 0) {
      inicios[i] = at;
      cursor = at + v.variable.length + 2;
    }
  });
  // La nota es la última oración, después de la última causa.
  const ultimoInicio = Math.max(-1, ...inicios);
  const finDeCausas = ultimoInicio >= 0 ? texto.indexOf(". ", ultimoInicio) : -1;
  const nota = finDeCausas >= 0 ? texto.slice(finDeCausas + 2).trim() || null : null;
  const columnas = vars.map((v, i): ColumnaPersonal => {
    const p = pregunta(v.variable, indice, v.rotulo);
    if (inicios[i] < 0) return { pregunta: p, causa: null, detalle: null };
    const desde = inicios[i] + v.variable.length + 2;
    const siguiente = inicios.slice(i + 1).find((x) => x >= 0);
    let hasta = siguiente !== undefined ? siguiente : finDeCausas >= 0 ? finDeCausas + 1 : texto.length;
    let causa = texto.slice(desde, hasta).trim().replace(/\.$/, "");
    hasta = causa.indexOf(": ");
    if (hasta < 0) return { pregunta: p, causa: causa || null, detalle: null };
    const detalle = causa.slice(hasta + 2).trim();
    causa = causa.slice(0, hasta).trim();
    return { pregunta: p, causa, detalle: detalle || null };
  });
  return { columnas, nota };
}
