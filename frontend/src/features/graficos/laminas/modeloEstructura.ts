// Estructura del informe como documento (F6.1; dirección F6 §4.1 «Estructura», principio 6).
//
// El plan es una lista plana de láminas. El analista lo piensa como documento: un bloque de apertura sin número, los
// capítulos que abren los separadores (`p_slide_seccion`), sus subcapítulos (`meta.nivel = "subcapitulo"`) y un cierre.
// Este módulo deriva ese árbol, la numeración (1, 1.1…) y el antetítulo que cada lámina hereda, sin tocar el plan.
// La dirección de una lámina es su id (`foco=<slide.id>[:gK]`), no su posición: ver `../focoLamina.ts`.

import type { Slide, SlideType } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "../store";
import { leerSlideMeta } from "../slideMeta";

export type LaminaEnEstructura = {
  id: string;
  /** Posición 1-based en el plan (la que se ve y se anuncia; el `foco` nombra el id). */
  posicion: number;
  tipo: SlideType;
  /** Título visible: el que escribió el analista o, sin él, el nombre del tipo. */
  titulo: string;
  /** Nombre humano del tipo de lámina. */
  tipoLabel: string;
  /** Cuántas ranuras de gráfico tiene y cuántas están llenas. */
  ranuras: number;
  ranurasLlenas: number;
  /** Antetítulo que hereda del separador vigente (null si no hay o si es el separador). */
  antetituloHeredado: string | null;
};

export type NodoEstructura =
  | { clase: "bloque"; id: string; titulo: string; laminas: LaminaEnEstructura[] }
  | {
      clase: "capitulo";
      id: string;
      numero: string;
      titulo: string;
      /** El separador que abre el capítulo, también editable como lámina. */
      separador: LaminaEnEstructura;
      laminas: LaminaEnEstructura[];
      subcapitulos: SubcapituloEstructura[];
    };

export type SubcapituloEstructura = {
  id: string;
  numero: string;
  titulo: string;
  separador: LaminaEnEstructura;
  laminas: LaminaEnEstructura[];
};

export type EstructuraInforme = {
  nodos: NodoEstructura[];
  /** Todas las láminas en orden del plan. */
  laminas: LaminaEnEstructura[];
};

// Láminas metodológicas del capítulo «Cómo leer este informe» del recetario (Top Two Box p19, redondeo p20–21).
const COMO_LEER: ReadonlySet<SlideType> = new Set<SlideType>(["p_slide_top_two_box", "p_slide_redondeo"]);

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function aLamina(slide: Slide, posicion: number, antetitulo: string | null): LaminaEnEstructura {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const llenas = slots.filter((s) => {
    const v = payload[s];
    return !!v && typeof v === "object" && typeof (v as { graficador?: unknown }).graficador === "string"
      && !!(v as { graficador: string }).graficador;
  }).length;
  const tipoLabel = SLIDE_LABELS[slide.tipo] ?? slide.tipo;
  return {
    id: slide.id,
    posicion,
    tipo: slide.tipo,
    titulo: texto(payload.titulo) || tipoLabel,
    tipoLabel,
    ranuras: slots.length,
    ranurasLlenas: llenas,
    antetituloHeredado: slide.tipo === "p_slide_seccion" ? null : antetitulo,
  };
}

const esSubcapitulo = (slide: Slide) => leerSlideMeta(slide).nivel === "subcapitulo";

type Bloque = Extract<NodoEstructura, { clase: "bloque" }>;
type ClaseBloque = "apertura" | "como-leer" | "cierre";
const TITULO_BLOQUE: Record<ClaseBloque, string> = { apertura: "Apertura", "como-leer": "Cómo leer este informe", cierre: "Cierre" };

/**
 * El árbol del informe a partir de las láminas del plan, en su orden.
 *
 * Invariante: cada nodo es un tramo CONTIGUO del plan y los nodos van en el orden del plan, así que recorrer los nodos
 * (separador, láminas, subcapítulos) da exactamente el orden del plan. Antes los bloques se armaban por tipo —una lámina
 * de apertura detrás de «Cómo leer» volvía a la fila Apertura— y el clasificador pintaba un orden que el plan no tenía
 * (QA de la Vista general, F1). Por eso una lámina se suma al nodo abierto: el capítulo (o subcapítulo) vigente, el
 * bloque «Cómo leer» o el «Cierre», que siguen abiertos hasta el próximo separador. Sólo antes de todo lo demás hay
 * Apertura; una lámina de cierre corta el capítulo vigente.
 */
export function construirEstructura(slides: readonly Slide[]): EstructuraInforme {
  const nodos: NodoEstructura[] = [];
  const laminas: LaminaEnEstructura[] = [];
  let bloque: { clase: ClaseBloque; nodo: Bloque } | null = null;
  let capitulo: Extract<NodoEstructura, { clase: "capitulo" }> | null = null;
  let sub: SubcapituloEstructura | null = null;
  let nCap = 0;
  const vecesBloque: Record<ClaseBloque, number> = { apertura: 0, "como-leer": 0, cierre: 0 };
  let antetitulo: string | null = null;

  const abrirBloque = (clase: ClaseBloque): Bloque => {
    vecesBloque[clase] += 1;
    const n = vecesBloque[clase];
    const nodo: Bloque = { clase: "bloque", id: n === 1 ? `bloque-${clase}` : `bloque-${clase}-${n}`, titulo: TITULO_BLOQUE[clase], laminas: [] };
    nodos.push(nodo);
    bloque = { clase, nodo };
    capitulo = null;
    sub = null;
    return nodo;
  };
  const enBloque = (clase: ClaseBloque): Bloque => (bloque && bloque.clase === clase ? bloque.nodo : abrirBloque(clase));

  slides.forEach((slide, i) => {
    const posicion = i + 1;
    if (slide.tipo === "p_slide_seccion") {
      const t = texto((slide.payload as Record<string, unknown>)?.titulo);
      if (t) antetitulo = t;
      const lam = aLamina(slide, posicion, antetitulo);
      laminas.push(lam);
      if (esSubcapitulo(slide) && capitulo) {
        const cap: Extract<NodoEstructura, { clase: "capitulo" }> = capitulo;
        sub = {
          id: `sub-${slide.id}`,
          numero: `${cap.numero}.${cap.subcapitulos.length + 1}`,
          titulo: lam.titulo,
          separador: lam,
          laminas: [],
        };
        cap.subcapitulos.push(sub);
        return;
      }
      nCap += 1;
      sub = null;
      bloque = null;
      capitulo = { clase: "capitulo", id: `cap-${slide.id}`, numero: String(nCap), titulo: lam.titulo, separador: lam, laminas: [], subcapitulos: [] };
      nodos.push(capitulo);
      return;
    }

    const lam = aLamina(slide, posicion, antetitulo);
    laminas.push(lam);
    if (slide.tipo === "p_slide_cierre") {
      enBloque("cierre").laminas.push(lam);
      return;
    }
    const cap = capitulo as Extract<NodoEstructura, { clase: "capitulo" }> | null;
    if (cap) {
      const s = sub as SubcapituloEstructura | null;
      if (s) s.laminas.push(lam);
      else cap.laminas.push(lam);
      return;
    }
    const abierto = bloque as { clase: ClaseBloque; nodo: Bloque } | null;
    if (abierto && abierto.clase !== "apertura") { abierto.nodo.laminas.push(lam); return; }
    enBloque(COMO_LEER.has(slide.tipo) ? "como-leer" : "apertura").laminas.push(lam);
  });

  return { nodos, laminas };
}

/** Cuántas láminas cuelgan de un nodo, contando el separador del capítulo y de sus subcapítulos. */
export function contarLaminas(nodo: NodoEstructura): number {
  if (nodo.clase === "bloque") return nodo.laminas.length;
  return 1 + nodo.laminas.length + nodo.subcapitulos.reduce((n, s) => n + 1 + s.laminas.length, 0);
}

/** Filtra la estructura por texto (título o tipo); un capítulo queda si él o alguna de sus láminas coincide. */
export function filtrarEstructura(estructura: EstructuraInforme, consulta: string): NodoEstructura[] {
  const q = normalizar(consulta);
  if (!q) return estructura.nodos;
  const coincide = (l: LaminaEnEstructura) => normalizar(`${l.titulo} ${l.tipoLabel}`).includes(q);
  const salida: NodoEstructura[] = [];
  for (const nodo of estructura.nodos) {
    if (nodo.clase === "bloque") {
      const laminas = nodo.laminas.filter(coincide);
      if (laminas.length) salida.push({ ...nodo, laminas });
      continue;
    }
    const capCoincide = coincide(nodo.separador);
    const laminas = capCoincide ? nodo.laminas : nodo.laminas.filter(coincide);
    const subcapitulos = nodo.subcapitulos
      .map((s) => (capCoincide || coincide(s.separador) ? s : { ...s, laminas: s.laminas.filter(coincide) }))
      .filter((s) => capCoincide || coincide(s.separador) || s.laminas.length > 0);
    if (capCoincide || laminas.length || subcapitulos.length) salida.push({ ...nodo, laminas, subcapitulos });
  }
  return salida;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
