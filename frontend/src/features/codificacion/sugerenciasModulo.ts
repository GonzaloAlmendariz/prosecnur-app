// Módulo sugerido de un comentario abierto (TXT-3, plan-texto-abierto-ccss-2026-10-24). Puro: lo usa
// `RespuestasCodificador` sobre su estado de grupos, que ya se guarda solo (POST /api/codificacion/grupos).
//
// - El endpoint (`/sugerencias-seccion`) PROPONE por persona; aquí se junta por respuesta única, que es lo que la mesa
//   de codificación lista. Quien escribió lo mismo recibe la misma propuesta (es función del texto).
// - Confirmar escribe la respuesta en el grupo del módulo (código por decena, 10, 20…) y un caso por persona en
//   `matrix_cases`: es lo que hace multicode a un texto abierto al adaptar (`.patch_text_matrix_sm_sheet`), el mismo
//   camino que la matriz Excel. Esos casos llevan `origen: "sugerencia"` y la clave de su respuesta, para poder quitarlos
//   sin tocar los importados.
// - Nada se confirma solo: sin acción del analista el estado de grupos no cambia.

import type { CasoMatriz, CodifSugerenciasSeccion, Grupo, PropuestaModulo, RespuestaUnica } from "../../api/codificacion";

/** Espejo de `.normalize_text` (api/R/router_codificacion.R): la clave `texto_normalizado` de una respuesta. */
export function normalizarTextoCodif(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/['`^~"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type CasoSugerido = { idCaso: string; texto: string };
export type EntradaSugerida = {
  /** `texto_normalizado` de la respuesta única. */
  clave: string;
  casos: CasoSugerido[];
  propuestas: PropuestaModulo[];
  /** Tiene contenido pero no comparte vocabulario con ningún módulo. */
  candidatoOtro: boolean;
};
export type ModuloDestino = { codigo: string; etiqueta: string };
/** Lo que una confirmación agregó, para poder deshacerla sin pisar lo que se hizo después. */
export type RegistroConfirmacion = { codigo: string; grupoCreado: string | null; claves: string[]; casos: string[] };

/** Las propuestas por respuesta única. Las no respuestas no tienen entrada. */
export function sugerenciasPorRespuesta(
  sug: CodifSugerenciasSeccion,
  respuestas: readonly RespuestaUnica[],
): Map<string, EntradaSugerida> {
  const porClave = new Set(respuestas.map((r) => r.texto_normalizado));
  const porUuid = new Map<string, string>();
  for (const r of respuestas) for (const u of r.uuids ?? []) porUuid.set(u, r.texto_normalizado);
  const out = new Map<string, EntradaSugerida>();
  for (const fila of sug.respuestas) {
    if (fila.noRespuesta) continue;
    const norm = normalizarTextoCodif(fila.texto);
    const clave = porClave.has(norm) ? norm : porUuid.get(fila.idCaso);
    if (!clave) continue;
    const previa = out.get(clave);
    if (previa) {
      if (!previa.casos.some((c) => c.idCaso === fila.idCaso)) previa.casos.push({ idCaso: fila.idCaso, texto: fila.texto });
      if (!previa.propuestas.length && fila.propuestas.length) {
        previa.propuestas = fila.propuestas;
        previa.candidatoOtro = false;
      }
      continue;
    }
    out.set(clave, {
      clave,
      casos: [{ idCaso: fila.idCaso, texto: fila.texto }],
      propuestas: fila.propuestas,
      candidatoOtro: fila.candidatoOtro && !fila.propuestas.length,
    });
  }
  return out;
}

export function estaConfirmada(grupos: readonly Grupo[], codigo: string, clave: string): boolean {
  return grupos.some((g) => g.codigo === codigo && g.respuestas.includes(clave));
}

/** Las entradas que proponen `codigo` y todavía no están en su grupo. */
export function pendientesDelModulo(mapa: ReadonlyMap<string, EntradaSugerida>, grupos: readonly Grupo[], codigo: string): EntradaSugerida[] {
  return [...mapa.values()].filter((e) => e.propuestas.some((p) => p.codigo === codigo) && !estaConfirmada(grupos, codigo, e.clave));
}

function sinCasosVacios(g: Grupo): Grupo {
  if (g.matrix_cases && g.matrix_cases.length === 0) {
    const { matrix_cases: _vacio, ...resto } = g;
    return resto;
  }
  return g;
}

/** Confirma `modulo` para cada entrada. Devuelve los grupos nuevos y lo que se agregó. */
export function confirmarSugerencias(
  grupos: readonly Grupo[],
  modulo: ModuloDestino,
  entradas: readonly EntradaSugerida[],
): { grupos: Grupo[]; registro: RegistroConfirmacion } {
  const registro: RegistroConfirmacion = { codigo: modulo.codigo, grupoCreado: null, claves: [], casos: [] };
  let lista = [...grupos];
  let idx = lista.findIndex((g) => g.codigo === modulo.codigo);
  if (idx < 0) {
    const id = `mod_${modulo.codigo}`;
    lista = [...lista, { id, codigo: modulo.codigo, etiqueta: modulo.etiqueta, respuestas: [], origen: "nuevo" }];
    idx = lista.length - 1;
    registro.grupoCreado = id;
  }
  const g = lista[idx];
  const respuestas = [...g.respuestas];
  const casos: CasoMatriz[] = [...(g.matrix_cases ?? [])];
  for (const e of entradas) {
    if (!respuestas.includes(e.clave)) { respuestas.push(e.clave); registro.claves.push(e.clave); }
    for (const c of e.casos) {
      if (casos.some((x) => x.id_caso === c.idCaso)) continue;
      casos.push({ id_caso: c.idCaso, respuesta: c.texto, codigo: g.codigo, etiqueta: g.etiqueta, obs: "", origen: "sugerencia", clave: e.clave });
      registro.casos.push(c.idCaso);
    }
  }
  lista[idx] = { ...g, respuestas, matrix_cases: casos };
  return { grupos: lista, registro };
}

/** Quita sólo lo que la confirmación agregó; el grupo que creó se va si queda vacío. */
export function deshacerConfirmacion(grupos: readonly Grupo[], registro: RegistroConfirmacion): Grupo[] {
  const claves = new Set(registro.claves);
  const casos = new Set(registro.casos);
  return grupos.flatMap((g) => {
    if (g.codigo !== registro.codigo) return [g];
    const limpio = sinCasosVacios({
      ...g,
      respuestas: g.respuestas.filter((r) => !claves.has(r)),
      matrix_cases: (g.matrix_cases ?? []).filter((c) => !(c.origen === "sugerencia" && casos.has(c.id_caso))),
    });
    if (g.id === registro.grupoCreado && !limpio.respuestas.length && !(limpio.matrix_cases?.length)) return [];
    return [limpio];
  });
}

/** Saca una respuesta confirmada del grupo de `codigo`, con los casos que su confirmación escribió. */
export function quitarSugerencia(grupos: readonly Grupo[], codigo: string, clave: string): Grupo[] {
  return grupos.map((g) => g.codigo !== codigo ? g : sinCasosVacios({
    ...g,
    respuestas: g.respuestas.filter((r) => r !== clave),
    matrix_cases: (g.matrix_cases ?? []).filter((c) => !(c.origen === "sugerencia" && c.clave === clave)),
  }));
}

/**
 * Antes de guardar: si el analista sacó a mano una respuesta de un grupo, los casos que su confirmación escribió dejan de
 * valer (si no, `/adaptar` la seguiría codificando por caso). Los casos importados de la matriz no se tocan. Sin nada que
 * podar devuelve el mismo arreglo.
 */
export function podarCasosSugeridos(grupos: Grupo[]): Grupo[] {
  let cambio = false;
  const out = grupos.map((g) => {
    if (!g.matrix_cases?.length) return g;
    const quedan = g.matrix_cases.filter((c) => c.origen !== "sugerencia" || (c.clave !== undefined && g.respuestas.includes(c.clave)));
    if (quedan.length === g.matrix_cases.length) return g;
    cambio = true;
    return sinCasosVacios({ ...g, matrix_cases: quedan });
  });
  return cambio ? out : grupos;
}

export type RotuloModulo = { letra: string; nombre: string; corto: string; grupo: string };

/**
 * «MÓDULO B. EXPERIENCIA UNIVERSITARIA» → letra «B», nombre «Experiencia universitaria». `corto` va en los chips y
 * `grupo` es la etiqueta del grupo que crea la confirmación. Una etiqueta toda en mayúsculas pasa a frase.
 */
export function rotuloModulo(etiqueta: string): RotuloModulo {
  const limpio = etiqueta.trim();
  const m = /^(?:m[oó]dulo|secci[oó]n|bloque|parte)\s+([a-z0-9]{1,2})\s*[.:\-–—]\s*(.+)$/i.exec(limpio);
  const crudo = m ? m[2].trim() : limpio;
  const nombre = crudo === crudo.toLocaleUpperCase("es") ? crudo.charAt(0) + crudo.slice(1).toLocaleLowerCase("es") : crudo;
  const letra = m ? m[1].toLocaleUpperCase("es") : "";
  return { letra, nombre, corto: letra ? `${letra} · ${nombre}` : nombre, grupo: letra ? `${letra}. ${nombre}` : nombre };
}

// TXT-17: rótulo corto de un subtema (módulo partido, TXT-11), cuya etiqueta es el enunciado entero de su batería. Regla
// simple, en este orden: (1) «Tema: subtema» se queda con lo de después de los dos puntos; (2) sólo la primera oración,
// sin signos de pregunta ni «…»; (3) si hay «sobre», «acerca de», «respecto a» o «siguiente(s)», lo que sigue al último,
// salvo que quede una sola palabra (entonces lo de antes); (4) sin la apertura de la pregunta («Con qué frecuencia
// utilizas», «Cómo te definirías», «Qué tan de acuerdo estás con»); (5) «X que <verbo> la Y» pasa a «X de la Y»;
// (6) hasta cuatro palabras, sin palabras vacías al final ni artículos al inicio (si queda más de una).

const VACIAS_BORDE = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "y", "o", "en", "con", "para",
  "por", "a", "al", "entre", "que", "sobre", "tu", "tus", "su", "sus", "mi", "mis", "como"]);
const ARTICULOS_INICIO = new Set(["la", "las", "el", "los", "un", "una", "unos", "unas", "tu", "tus", "su", "sus", "mi", "mis"]);
const PIVOTE = /\b(?:sobre|acerca de|respecto a|con respecto a|siguientes?)\s+/gi;
const APERTURA = /^(?:con qu[eé] frecuencia|en qu[eé] medida|qu[eé] tan de acuerdo|qu[eé] tan|c[oó]mo|cu[aá]ntos?|cu[aá]ntas?|cu[aá]les|cu[aá]l|por qu[eé]|qu[eé]|d[oó]nde)\s+(?:(?:te|se|le|les|me|nos)\s+)?\S+\s*(?:(?:con|en|a|de)\s+)?/i;

const palabras = (s: string) => s.split(/\s+/).filter(Boolean);
const enFrase = (s: string) => (s && s === s.toLocaleUpperCase("es") ? s.charAt(0) + s.slice(1).toLocaleLowerCase("es") : s);

function recortarBordes(ws: string[], quitarArticulo: boolean): string[] {
  const out = [...ws];
  while (out.length && VACIAS_BORDE.has(out[out.length - 1].toLocaleLowerCase("es"))) out.pop();
  if (quitarArticulo && out.length > 2 && ARTICULOS_INICIO.has(out[0].toLocaleLowerCase("es"))) out.shift();
  return out;
}

function cortoDeUno(enunciado: string): string {
  let t = enunciado.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const dos = /^[^¿?:]{2,60}:\s*(.+)$/.exec(t);
  if (dos) t = dos[1];
  t = t.replace(/^[¿¡\s]+/, "");
  const fin = /[?.!]/.exec(t);
  if (fin) t = t.slice(0, fin.index);
  t = t.replace(/[…]+|\.{3}/g, " ").trim();
  let base = t;
  const pivotes = [...t.matchAll(PIVOTE)];
  if (pivotes.length) {
    const ult = pivotes[pivotes.length - 1];
    const tras = t.slice((ult.index ?? 0) + ult[0].length);
    if (recortarBordes(palabras(tras), true).length >= 2 || recortarBordes(palabras(tras), false).length >= 2) base = tras;
    else base = recortarBordes(palabras(t.slice(0, ult.index ?? 0)), false).join(" ");
  }
  if (APERTURA.test(base)) base = base.replace(APERTURA, "");
  let ws = recortarBordes(palabras(base), true);
  const rel = /^(\S+) que \S+ (la|las|los|el) (\S+)$/i.exec(ws.join(" "));
  if (rel) ws = palabras(`${rel[1]} ${rel[2].toLowerCase() === "el" ? "del" : `de ${rel[2]}`} ${rel[3]}`);
  ws = recortarBordes(ws.slice(0, 4), false);
  const out = enFrase(ws.join(" "));
  return out.charAt(0).toLocaleUpperCase("es") + out.slice(1);
}

/** Rótulo corto (de 2 a 4 palabras) de un subtema a partir del enunciado de su batería. «a / b» acorta cada parte. */
export function rotuloCortoSubtema(enunciado: string): string {
  return enunciado.split(" / ").map(cortoDeUno).filter(Boolean).join(" / ");
}

export type RotuloPropuesta = RotuloModulo & { completo: string };

/** «Experiencia laboral» dentro de «Experiencia universitaria» es «Laboral»: lo que repite al módulo no distingue. */
function sinPalabrasDelPadre(corto: string, nombrePadre: string): string {
  const delPadre = new Set(palabras(nombrePadre).map((w) => normalizarTextoCodif(w)));
  const ws = palabras(corto);
  let i = 0;
  while (i < ws.length - 1 && delPadre.has(normalizarTextoCodif(ws[i]))) i++;
  const out = ws.slice(i).join(" ");
  return out ? out.charAt(0).toLocaleUpperCase("es") + out.slice(1) : "";
}

/** El rótulo de un módulo o, si trae `padreEtiqueta`, el de un subtema con la letra de su módulo. */
export function rotuloDePropuesta(p: { etiqueta: string; padreEtiqueta?: string }): RotuloPropuesta {
  if (!p.padreEtiqueta) return { ...rotuloModulo(p.etiqueta), completo: p.etiqueta };
  const padre = rotuloModulo(p.padreEtiqueta);
  const nombre = sinPalabrasDelPadre(rotuloCortoSubtema(p.etiqueta), padre.nombre) || padre.nombre;
  const corto = padre.letra ? `${padre.letra} · ${nombre}` : nombre;
  // TXT-21: el grupo que crea «Confirmar» se llama como lo muestra la banda; es la etiqueta que después ven los gráficos.
  return {
    letra: padre.letra,
    nombre,
    corto,
    grupo: corto,
    completo: p.etiqueta,
  };
}
