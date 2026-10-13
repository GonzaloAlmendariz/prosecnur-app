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
export type PreguntaMaqueta = { titulo: string; opciones: OpcionMaqueta[]; ttb: boolean; /** Bases (actores) de ESTA pregunta, legibles; vacío en un informe de una base. */ bases: string[] };
export type ColoresMaqueta = { paletas: MapaPaletas; vinculos?: VinculosPaletas };

/** La escala de una pregunta (las opciones de su lista) con el color que le da la paleta de esa lista, si tiene. */
function escalaDe(info: VarLike | undefined, colores: ColoresMaqueta | undefined): OpcionMaqueta[] {
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
export function twoBoxDeGrafico(graficador: string | null, args: Record<string, unknown>, presets: Presets): { ttb: boolean; btb: boolean } {
  if (!graficador) return { ttb: false, btb: false };
  if (formaTwoBox(graficador, args) === "por_bloque") {
    const bloques = Array.isArray(args.bloques) ? args.bloques : [];
    const ttb = bloques.some((b) => !!b && typeof b === "object" && (b as Record<string, unknown>).top2box === true);
    return { ttb, btb: false };
  }
  const e = leerTwoBox(graficador, args, presets);
  if (!e) return { ttb: false, btb: false };
  return { ttb: e.top.activa, btb: e.top.activa && e.bottom.activa };
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

type Grupo = { titulo: string | null; refs: string[]; ttb?: boolean };

/** Todas las preguntas (`var` o `base$var`) que dibuja un gráfico, en el orden en que salen. */
export function preguntasDelGrafico(args: Record<string, unknown>): string[] {
  return gruposDe(args).flatMap((g) => g.refs);
}

/** Las preguntas de un gráfico: por bloque (multilista) y por tema (`vars` como objeto, con su `titulos_grupo`); una
 *  lista plana es una pregunta por variable. Las variables equivalentes entre bases de un mismo tema son UNA pregunta. */
function gruposDe(args: Record<string, unknown>): Grupo[] {
  if (Array.isArray(args.bloques)) {
    return args.bloques.flatMap((b) => {
      if (!b || typeof b !== "object") return [];
      const ttb = (b as Record<string, unknown>).top2box === true;
      return gruposDe(b as Record<string, unknown>).map((g) => ({ ...g, ttb }));
    });
  }
  const titulos = (args.titulos_grupo && typeof args.titulos_grupo === "object" ? args.titulos_grupo : {}) as Record<string, unknown>;
  if (args.vars && typeof args.vars === "object" && !Array.isArray(args.vars)) {
    return Object.entries(args.vars as Record<string, unknown>).map(([k, v]) => ({
      titulo: typeof titulos[k] === "string" && (titulos[k] as string).trim() ? (titulos[k] as string).trim() : null,
      refs: refsDe(v),
    }));
  }
  const refs = ["var", "vars", "variable", "variables"].flatMap((k) => refsDe(args[k]));
  const porNombre = new Map<string, string[]>();
  for (const r of refs) {
    const n = parseVarRef(r).name;
    porNombre.set(n, [...(porNombre.get(n) ?? []), r]);
  }
  return [...porNombre.values()].map((rs) => ({ titulo: null, refs: rs }));
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
        return { titulo, opciones: escalaDe(iv, colores), ttb: g.ttb ?? twoBox.ttb, bases: bases.length > 1 ? basesQ.map(nombreBase) : [] };
      });
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
  const partes = [...porPublico].map(([fuente, n]) => (fuente ? `${n} ${fuente.replace(/[_-]+/g, " ")}` : `${n} respuestas`));
  if (!partes.length) return null;
  return formato.includes("%s") ? formato.replace("%s", enumerar(partes)) : `Base: ${enumerar(partes)}`;
}
