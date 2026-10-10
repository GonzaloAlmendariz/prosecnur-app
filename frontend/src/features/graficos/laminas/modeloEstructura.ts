// Estructura del informe como documento (F6.1; dirección F6 §4.1 «Estructura», principio 6).
//
// El plan es una lista plana de láminas. El analista lo piensa como documento: un bloque de apertura sin número, los
// capítulos que abren los separadores (`p_slide_seccion`), sus subcapítulos (`meta.nivel = "subcapitulo"`) y un cierre.
// Este módulo deriva ese árbol, la numeración (1, 1.1…) y el antetítulo que cada lámina hereda, sin tocar el plan.
// La dirección de una lámina es su posición: `foco=l-07` es la séptima lámina del plan; `foco=l-07:g2`, su segunda ranura.

import type { Slide, SlideType } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "../store";
import { leerSlideMeta } from "../slideMeta";

export type LaminaEnEstructura = {
  id: string;
  /** Posición 1-based en el plan; es la que nombra `foco=l-NN`. */
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

const COMO_LEER: ReadonlySet<SlideType> = new Set<SlideType>(["p_slide_top_two_box"]);

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

/** El árbol del informe a partir de las láminas del plan, en su orden. */
export function construirEstructura(slides: readonly Slide[]): EstructuraInforme {
  const nodos: NodoEstructura[] = [];
  const laminas: LaminaEnEstructura[] = [];
  let apertura: Extract<NodoEstructura, { clase: "bloque" }> | null = null;
  let comoLeer: Extract<NodoEstructura, { clase: "bloque" }> | null = null;
  let cierre: Extract<NodoEstructura, { clase: "bloque" }> | null = null;
  let capitulo: Extract<NodoEstructura, { clase: "capitulo" }> | null = null;
  let sub: SubcapituloEstructura | null = null;
  let nCap = 0;
  let antetitulo: string | null = null;

  slides.forEach((slide, i) => {
    const posicion = i + 1;
    if (slide.tipo === "p_slide_seccion") {
      const t = texto((slide.payload as Record<string, unknown>)?.titulo);
      if (t) antetitulo = t;
      const lam = aLamina(slide, posicion, antetitulo);
      laminas.push(lam);
      if (esSubcapitulo(slide) && capitulo) {
        sub = {
          id: `sub-${slide.id}`,
          numero: `${capitulo.numero}.${capitulo.subcapitulos.length + 1}`,
          titulo: lam.titulo,
          separador: lam,
          laminas: [],
        };
        capitulo.subcapitulos.push(sub);
        return;
      }
      nCap += 1;
      sub = null;
      capitulo = { clase: "capitulo", id: `cap-${slide.id}`, numero: String(nCap), titulo: lam.titulo, separador: lam, laminas: [], subcapitulos: [] };
      nodos.push(capitulo);
      return;
    }

    const lam = aLamina(slide, posicion, antetitulo);
    laminas.push(lam);
    if (slide.tipo === "p_slide_cierre") {
      if (!cierre) { cierre = { clase: "bloque", id: "bloque-cierre", titulo: "Cierre", laminas: [] }; nodos.push(cierre); }
      cierre.laminas.push(lam);
      return;
    }
    if (!capitulo) {
      if (COMO_LEER.has(slide.tipo)) {
        if (!comoLeer) { comoLeer = { clase: "bloque", id: "bloque-como-leer", titulo: "Cómo leer este informe", laminas: [] }; nodos.push(comoLeer); }
        comoLeer.laminas.push(lam);
      } else {
        if (!apertura) { apertura = { clase: "bloque", id: "bloque-apertura", titulo: "Apertura", laminas: [] }; nodos.splice(0, 0, apertura); }
        apertura.laminas.push(lam);
      }
      return;
    }
    if (sub) sub.laminas.push(lam);
    else capitulo.laminas.push(lam);
  });

  return { nodos, laminas };
}

/** Cuántas láminas cuelgan de un nodo, contando el separador del capítulo y de sus subcapítulos. */
export function contarLaminas(nodo: NodoEstructura): number {
  if (nodo.clase === "bloque") return nodo.laminas.length;
  return 1 + nodo.laminas.length + nodo.subcapitulos.reduce((n, s) => n + 1 + s.laminas.length, 0);
}

// ---------------------------------------------------------------------------
// `foco`: la lámina y, opcionalmente, su ranura
// ---------------------------------------------------------------------------

export type FocoLamina = { posicion: number; ranura: number | null };

/** `l-07` → lámina 7; `l-07:g2` → lámina 7, ranura 2. Cualquier otra cosa → null. */
export function parsearFocoLamina(foco: string | null | undefined): FocoLamina | null {
  const m = /^l-(\d{1,4})(?::g(\d{1,2}))?$/.exec((foco ?? "").trim());
  if (!m) return null;
  const posicion = Number(m[1]);
  if (!Number.isInteger(posicion) || posicion < 1) return null;
  const ranura = m[2] ? Number(m[2]) : null;
  return { posicion, ranura: ranura && ranura >= 1 ? ranura : null };
}

export function focoDeLamina(posicion: number, ranura?: number | null): string {
  const base = `l-${String(posicion).padStart(2, "0")}`;
  return ranura ? `${base}:g${ranura}` : base;
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
