// Qué dice la maqueta de cada ranura: el tipo de gráfico, la pregunta que muestra y, si cruza más de una, las bases
// (actores). La geometría es la de la composición del tipo de lámina, la misma que dibuja el motor.

import type { GraficadorRef, Slide, VarInfo } from "../../../api/client";
import { composicionDe, LAMINA_PULGADAS, numeroDeRanura } from "../iconos/composicion";
import { cleanInferredVariableTitle } from "../slideAutoTitle";
import { SLIDE_GRAF_SLOTS } from "../store";
import { parseVarRef } from "../useVariables";
import { formaTwoBox, leerTwoBox } from "./tarjetaGrafico/twoBox";
import { firmaOpciones, resolverPaleta, type MapaPaletas, type VinculosPaletas } from "../paletasResolver";

type VarLike = VarInfo & { source?: string };

export type RanuraMaqueta = {
  /** Número del gráfico (1-based) o null en una ranura de cifra sin slot. */
  k: number | null;
  slot: string | null;
  /** Caja en fracción de la lámina. */
  rect: { x: number; y: number; w: number; h: number };
  graficador: string | null;
  /** Pregunta (etiqueta) del primer bloque; null si la ranura está vacía. */
  pregunta: string | null;
  /** Cuántas preguntas más muestra el gráfico además de la primera. */
  masPreguntas: number;
  /** Cada pregunta (bloque) del gráfico con su escala y los colores que le tocan. */
  preguntas: PreguntaMaqueta[];
  /** true: todas las preguntas usan la misma escala (y por eso la misma paleta). */
  mismaEscala: boolean;
  /** «categorias»: cada opción con su color (apiladas, tortas); «uno»: barras de un solo color con la mayor resaltada,
   *  salvo que la lista tenga paleta propia (entonces se pinta con ella). */
  pinta: "categorias" | "uno";
  /** Sólo con «uno»: la barra más alta va en otro tono (opción del gráfico `resaltar_mayor`). */
  resaltaMayor: boolean;
  /** Bases (actores) que cruza, sólo cuando son más de una. */
  bases: string[];
  /** Columnas encendidas en el gráfico: Top Two Box y, a su lado, Bottom Two Box. */
  twoBox: { ttb: boolean; btb: boolean };
  /** Los args del gráfico, tal cual (la ficha lee de ahí la lectura y los ajustes). */
  args: Record<string, unknown>;
  /** Bloques del gráfico (multiapiladas «Bloques»); uno solo en los demás. */
  bloques: { titulo: string | null; ttb: boolean }[];
};

type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** Los gráficos que pintan cada categoría con su color (los demás son de un solo color, como el recetario). */
export const GRAFICOS_POR_CATEGORIA: ReadonlySet<string> = new Set(["p_barras_apiladas", "p_barras_multiapiladas", "p_pie", "p_donut", "p_barras_divergentes"]);

/** Colores del recetario: barras de un solo color en azul institucional; con «resaltar la mayor», las demás en gris
 *  azulado; dos opciones (dicotomía) en azul y celeste (`.std_paleta("dicotomica")`). */
export const COLOR_MAYOR = "#081F5C";
export const COLOR_RESTO = "#8A93A8";
export const COLOR_SEGUNDA = "#9DC3E6";

export type OpcionMaqueta = { rotulo: string; color: string | null };
/** `ttb`: la columna Top Two Box de ESA pregunta (en multi-apiladas cada bloque decide la suya). */
export type PreguntaMaqueta = {
  titulo: string; opciones: OpcionMaqueta[]; ttb: boolean;
  /** Los públicos del tema responden en escalas distintas: `opciones` es la mayor (api/R/graficos_escala_union.R). */
  variasEscalas?: boolean;
  /** Bases (actores) de ESTA pregunta, legibles; vacío en un informe de una base. */ bases: string[];
  /** Bloque (0-based) al que pertenece. */ bloque: number;
  /** Cuántas barras dibuja: una por público (temas), una por grupo del cruce o una sola. */ filas: number;
  /** Grupos del cruce, si la pregunta se abre por grupos («Sexo»). */ cruce: string | null;
};
export type ColoresMaqueta = { paletas: MapaPaletas; vinculos?: VinculosPaletas };

/** La escala de una pregunta (las opciones de su lista) con el color que le da la paleta de esa lista, si tiene. */
export function escalaDe(info: VarLike | undefined, colores: ColoresMaqueta | undefined): OpcionMaqueta[] {
  const choices = info?.choices ?? [];
  if (!choices.length) return [];
  const res = colores && info?.list_name ? resolverPaleta({ list_name: info.list_name, choices }, colores.paletas, colores.vinculos) : null;
  const pal = res ? (colores?.paletas[res.clave] as Record<string, unknown> | undefined) : undefined;
  return choices.map((c) => {
    const v = pal?.[c.label];
    return { rotulo: c.label, color: typeof v === "string" && v.trim() ? v.trim() : null };
  });
}

/** Las columnas Two Box encendidas en el gráfico. Sin categorías elegidas el motor la omite, pero la tarjeta ya lo avisa:
 *  la maqueta la muestra en cuanto se enciende, para que el cambio se vea. */
export function twoBoxDeGrafico(graficador: string | null, args: Record<string, unknown>, presets: Presets): { ttb: boolean; btb: boolean; etiquetas?: string[] } {
  if (!graficador) return { ttb: false, btb: false };
  if (formaTwoBox(graficador, args) === "por_bloque") {
    const bloques = Array.isArray(args.bloques) ? args.bloques : [];
    const ttb = bloques.some((b) => !!b && typeof b === "object" && (b as Record<string, unknown>).top2box === true);
    return { ttb, btb: false };
  }
  const e = leerTwoBox(graficador, args, presets);
  if (!e) return { ttb: false, btb: false };
  return { ttb: e.top.activa, btb: e.top.activa && e.bottom.activa, etiquetas: e.top.etiquetas };
}

const normalizarRotulo = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

/**
 * ¿El Top Two Box sale en ESTA pregunta? Con categorías declaradas que no existen en su escala (las de acuerdo del
 * informe sobre una pregunta de género) el motor lo omite sin avisar (`.box_decidir`), así que la maqueta tampoco lo
 * promete (lámina 1 de Arte). Sin categorías declaradas se muestra: la tarjeta avisa que faltan.
 */
export function twoBoxEnPregunta(activa: boolean, etiquetas: readonly string[] | undefined, opciones: readonly { rotulo: string }[]): boolean {
  if (!activa) return false;
  if (!opciones.length) return true;
  // Sin categorías declaradas el motor lo omite en una lista sin orden (`sin_orden`) y avisa en una escala: la maqueta lo
  // muestra sólo donde el aviso de la tarjeta tiene sentido.
  if (!etiquetas?.length) return tienePistasDeOrden(opciones.map((o) => o.rotulo));
  const escala = new Set(opciones.map((o) => normalizarRotulo(o.rotulo)));
  return etiquetas.some((e) => escala.has(normalizarRotulo(e)));
}

const RESIDUALES_ORDEN = /no sabe|no responde|no aplica|sin inf|prefiero no|ns\/nr|otro/i;
/**
 * ¿Las respuestas tienen un orden propio? Port de `.goc_pistas_orden` (api/R/graficos_orden_categorias.R): cifras,
 * grados académicos, ordinales o palabras de gradación. Las residuales no cuentan.
 */
export function tienePistasDeOrden(rotulos: readonly string[]): boolean {
  const t = rotulos.filter((e) => e && e.trim() && !RESIDUALES_ORDEN.test(e)).map((e) => e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (t.length < 2) return false;
  if (t.filter((e) => /[0-9]/.test(e)).length / t.length >= 0.5) return true;
  const cuenta = (re: RegExp) => t.filter((e) => re.test(e)).length;
  if (cuenta(/\b(bachiller|licenciad|magister|maestri|maestr|doctor|doctorado|posgrado|primaria|secundaria|tecnic|superior|inicial)/) >= 2) return true;
  if (cuenta(/\b(primer|segund|tercer|cuart|quint|sext|septim|setim|octav|noven|decim)/) >= 2) return true;
  return cuenta(/\b(nada|poco|algo|mucho|muy|totalmente|siempre|nunca|a veces|rara vez|bajo|medio|alto|acuerdo|desacuerdo|satisfech|insatisfech|malo|bueno|regular|excelente|pesimo|nivel|menos de|mas de|a mas)\b/) >= 2;
}

function refsDe(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) return v.flatMap(refsDe);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap(refsDe);
  return [];
}

/** «estudiantes» → «Estudiantes»; «personal_admin» → «Personal admin». */
export function nombreBase(source: string): string {
  const t = source.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toLocaleUpperCase("es") + t.slice(1) : source;
}

type Grupo = { titulo: string | null; refs: string[]; ttb?: boolean; bloque: number; cruce: string | null };

/** Todas las preguntas (`var` o `base$var`) que dibuja un gráfico, en el orden en que salen. */
export function preguntasDelGrafico(args: Record<string, unknown>): string[] {
  return gruposDe(args).flatMap((g) => g.refs);
}

/** Las preguntas de un gráfico: por bloque (multilista) y por tema (`vars` como objeto, con su `titulos_grupo`); una
 *  lista plana es una pregunta por variable. Las variables equivalentes entre bases de un mismo tema son UNA pregunta. */
/** El cruce que abre las preguntas por grupos (`modo` cruce, o var_cruce con lista): la variable de `cruces`. */
function cruceDe(args: Record<string, unknown>): string | null {
  const c = typeof args.cruces === "string" ? args.cruces.trim() : Array.isArray(args.cruces) && typeof args.cruces[0] === "string" ? String(args.cruces[0]).trim() : "";
  if (!c) return null;
  const nombrados = !!args.vars && typeof args.vars === "object" && !Array.isArray(args.vars);
  return args.modo === "cruce" || (args.modo === "var_cruce" && !nombrados) ? c : null;
}

function gruposDe(args: Record<string, unknown>, bloque = 0): Grupo[] {
  if (Array.isArray(args.bloques)) {
    return args.bloques.flatMap((b, i) => {
      if (!b || typeof b !== "object") return [];
      const ttb = (b as Record<string, unknown>).top2box === true;
      return gruposDe(b as Record<string, unknown>, i).map((g) => ({ ...g, ttb }));
    });
  }
  const cruce = cruceDe(args);
  const titulos = (args.titulos_grupo && typeof args.titulos_grupo === "object" ? args.titulos_grupo : {}) as Record<string, unknown>;
  if (args.vars && typeof args.vars === "object" && !Array.isArray(args.vars)) {
    return Object.entries(args.vars as Record<string, unknown>).map(([k, v]) => ({
      titulo: typeof titulos[k] === "string" && (titulos[k] as string).trim() ? (titulos[k] as string).trim() : null,
      refs: refsDe(v), bloque, cruce,
    }));
  }
  const refs = ["var", "vars", "variable", "variables"].flatMap((k) => refsDe(args[k]));
  const porNombre = new Map<string, string[]>();
  for (const r of refs) {
    const n = parseVarRef(r).name;
    porNombre.set(n, [...(porNombre.get(n) ?? []), r]);
  }
  return [...porNombre.values()].map((rs) => ({ titulo: null, refs: rs, bloque, cruce }));
}

export function ranurasDeMaqueta(slide: Pick<Slide, "tipo" | "payload">, variables: readonly VarLike[], presets: Presets = {}, colores?: ColoresMaqueta): RanuraMaqueta[] {
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const comp = composicionDe(slide.tipo, slots);
  if (comp.fuente === "estructura") return [];
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  return comp.ranuras
    .filter((r) => r.tipo !== "texto")
    .map((r) => {
      const ref = r.slot ? (payload[r.slot] as GraficadorRef | undefined) : undefined;
      const args = (ref && typeof ref === "object" ? ref.args : null) ?? {};
      const grupos = gruposDe(args as Record<string, unknown>).filter((g) => g.refs.length > 0 || g.titulo);
      const refs = grupos.flatMap((g) => g.refs);
      const bases = [...new Set(refs.map((x) => parseVarRef(x).source).filter((s): s is string => !!s))];
      const primera = refs[0] ? parseVarRef(refs[0]) : null;
      const info = primera
        ? variables.find((v) => v.name === primera.name && (!primera.source || !v.source || v.source === primera.source))
        : undefined;
      const pregunta = grupos[0]?.titulo ?? (primera ? cleanInferredVariableTitle(info?.label) ?? primera.name : null);
      const buscar = (ref: string) => {
        const pr = parseVarRef(ref);
        return variables.find((v) => v.name === pr.name && (!pr.source || !v.source || v.source === pr.source));
      };
      const twoBox = twoBoxDeGrafico(ref?.graficador ?? null, args as Record<string, unknown>, presets);
      const preguntas: PreguntaMaqueta[] = grupos.map((g) => {
        const iv = g.refs[0] ? buscar(g.refs[0]) : undefined;
        const titulo = g.titulo ?? cleanInferredVariableTitle(iv?.label) ?? (g.refs[0] ? parseVarRef(g.refs[0]).name : "");
        const basesQ = [...new Set(g.refs.map((x) => parseVarRef(x).source).filter((x): x is string => !!x))];
        const cruceInfo = g.cruce ? buscar(g.cruce) : undefined;
        const filas = g.cruce ? Math.max(1, cruceInfo?.choices?.length ?? 2) : Math.max(1, g.refs.length);
        // Cada público con su escala: la leyenda es la de la escala mayor del tema, como la dibuja el motor.
        const escalasTema = g.refs.map((x) => escalaDe(buscar(x), colores)).filter((e) => e.length);
        const opciones = escalasTema.reduce((m, e) => (e.length > m.length ? e : m), escalaDe(iv, colores));
        const variasEscalas = new Set(escalasTema.map((e) => firmaOpciones(e.map((o) => o.rotulo)))).size > 1;
        return {
          titulo, opciones, variasEscalas, ttb: g.ttb ?? twoBoxEnPregunta(twoBox.ttb, twoBox.etiquetas, opciones), bases: bases.length > 1 ? basesQ.map(nombreBase) : [],
          bloque: g.bloque, filas, cruce: g.cruce ? cleanInferredVariableTitle(cruceInfo?.label) ?? parseVarRef(g.cruce).name : null,
        };
      });
      const bloquesArgs = Array.isArray((args as Record<string, unknown>).bloques) ? ((args as Record<string, unknown>).bloques as unknown[]) : null;
      const bloques = bloquesArgs
        ? bloquesArgs.map((b) => {
          const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
          return { titulo: typeof o.titulo === "string" && o.titulo.trim() ? o.titulo.trim() : null, ttb: o.top2box === true };
        })
        : [{ titulo: null, ttb: twoBox.ttb }];
      const firmas = new Set(preguntas.map((q) => firmaOpciones(q.opciones.map((o) => o.rotulo))).filter(Boolean));
      return {
        k: numeroDeRanura(slots, r.slot),
        slot: r.slot,
        rect: { x: r.x / LAMINA_PULGADAS.w, y: r.y / LAMINA_PULGADAS.h, w: r.w / LAMINA_PULGADAS.w, h: r.h / LAMINA_PULGADAS.h },
        graficador: ref?.graficador ?? null,
        pregunta,
        masPreguntas: Math.max(0, grupos.length - 1),
        preguntas,
        mismaEscala: firmas.size <= 1,
        pinta: GRAFICOS_POR_CATEGORIA.has(ref?.graficador ?? "") || preguntas.some((q) => q.opciones.some((o) => o.color)) ? "categorias" : "uno",
        resaltaMayor: ((args as Record<string, unknown>).overrides as Record<string, unknown> | undefined)?.resaltar_mayor === true
          || (args as Record<string, unknown>).resaltar_mayor === true,
        bases: bases.length > 1 ? bases.map(nombreBase) : [],
        twoBox,
        args: args as Record<string, unknown>,
        bloques,
      };
    });
}


/** «52 docentes, 172 estudiantes y 15 administrativos»: la enumeración que el motor usa en la base. */
function enumerar(partes: string[]): string {
  return partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * La base que el motor escribirá al pie si nadie la cambia: quiénes respondieron la (primera) pregunta del gráfico, por
 * base, con el formato del informe («Base: %s»). `null` si no se puede saber desde aquí (sin conteos o varios gráficos,
 * donde cada uno lleva la suya debajo).
 */
export function baseAutomatica(
  slide: Pick<Slide, "tipo" | "payload">,
  variables: readonly VarLike[],
  formato = "Base: %s",
): string | null {
  const graficos = (SLIDE_GRAF_SLOTS[slide.tipo] ?? []).map((sl) => (slide.payload as Record<string, unknown>)[sl]).filter(Boolean);
  if (graficos.length !== 1) return null;   // con varios gráficos, cada uno lleva su base debajo
  const args = ((graficos[0] as GraficadorRef).args ?? {}) as Record<string, unknown>;
  // Todos los públicos de la lámina, no sólo los de la primera pregunta: con temas de públicos distintos (Arte, lámina 10:
  // docentes y administrativos en el primero, docentes y estudiantes en el resto) el pie decía otra cosa que los chips y
  // que el motor, que escribe la unión. Por público, el mayor n de sus preguntas.
  const refs = gruposDe(args).flatMap((g) => g.refs);
  const porPublico = new Map<string, number>();
  for (const ref of refs) {
    const pr = parseVarRef(ref);
    const v = variables.find((x) => x.name === pr.name && (!pr.source || !x.source || x.source === pr.source));
    const n = (v as { n_non_empty?: number } | undefined)?.n_non_empty;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const clave = pr.source ?? "";
    porPublico.set(clave, Math.max(porPublico.get(clave) ?? 0, n));
  }
  // En el orden de las bases del estudio, como lo escribe el motor (lámina 13 de Arte decía «docentes, estudiantes,
  // administrativos» porque seguía la aparición de las preguntas y el PPT salía «docentes, administrativos y estudiantes»).
  const posicion = (fuente: string) => { const i = variables.findIndex((x) => x.source === fuente); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const partes = [...porPublico].sort(([a], [b]) => posicion(a) - posicion(b))
    .map(([fuente, n]) => (fuente ? `${n} ${fuente.replace(/[_-]+/g, " ")}` : `${n} respuestas`));
  if (!partes.length) return null;
  return formato.includes("%s") ? formato.replace("%s", enumerar(partes)) : `Base: ${enumerar(partes)}`;
}
