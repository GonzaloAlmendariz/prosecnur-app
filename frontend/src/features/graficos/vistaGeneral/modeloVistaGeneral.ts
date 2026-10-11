// Vista general de Procesamiento › Gráficos (F6.3; dirección F6 §4.2): el informe como clasificador por capítulos.
// Pura: a partir del plan y de la estructura que ya deriva `construirEstructura` (no se repite la regla de capítulos),
// arma una fila por bloque o capítulo con sus láminas como tarjetas, cuenta la cobertura y calcula el orden nuevo del
// plan al reordenar, duplicar o eliminar. El componente sólo aplica el resultado al store en UN paso deshacible.
//
// La dirección de una tarjeta es el id de su lámina (`foco=<slide.id>`), no su posición: tras reordenar, `l-07` es otra
// lámina y el id sigue siendo la misma. La resolución (id, `id:gK` o el heredado `l-NN`) es la de `../focoLamina.ts`, la
// misma que usa Láminas.

import type { Slide } from "../../../api/graficos";
import { graficosDeLamina } from "../laminas/selectores/cambioTipoLamina";
import {
  type EstructuraInforme,
  type LaminaEnEstructura,
  type NodoEstructura,
} from "../laminas/modeloEstructura";

export type RolTarjeta = "separador" | "subcapitulo" | "lamina";

export type TarjetaVistaGeneral = {
  lamina: LaminaEnEstructura;
  rol: RolTarjeta;
  /** Número del capítulo o subcapítulo que abre (sólo separadores). */
  numero: string | null;
  /** Tipo de cada gráfico configurado, en el orden de sus ranuras. */
  graficos: string[];
};

export type ConteoFila = {
  laminas: number;
  /** Láminas con al menos un gráfico configurado. */
  conGrafico: number;
  /** Láminas con ranuras de gráfico sin llenar. */
  incompletas: number;
};

export type FilaVistaGeneral = {
  id: string;
  clase: NodoEstructura["clase"];
  numero: string | null;
  titulo: string;
  /** Rótulo para menús y anuncios: «2. Satisfacción» o «Apertura». */
  rotulo: string;
  tarjetas: TarjetaVistaGeneral[];
  conteo: ConteoFila;
  /** Ids del plan que forman la fila: mover el capítulo es mover este conjunto. */
  ids: string[];
};

export type CoberturaInforme = ConteoFila & { capitulos: number };

function tarjeta(l: LaminaEnEstructura, rol: RolTarjeta, numero: string | null, porId: ReadonlyMap<string, Slide>): TarjetaVistaGeneral {
  const slide = porId.get(l.id);
  return { lamina: l, rol, numero, graficos: slide ? graficosDeLamina(slide).map((g) => g.grafico.graficador) : [] };
}

export function contarTarjetas(tarjetas: readonly TarjetaVistaGeneral[]): ConteoFila {
  let conGrafico = 0;
  let incompletas = 0;
  for (const { lamina } of tarjetas) {
    if (lamina.ranurasLlenas > 0) conGrafico += 1;
    if (lamina.ranuras > 0 && lamina.ranurasLlenas < lamina.ranuras) incompletas += 1;
  }
  return { laminas: tarjetas.length, conGrafico, incompletas };
}

/** Una fila por nodo de la estructura, en su orden; las tarjetas de un capítulo siguen el orden del plan. */
export function construirFilas(estructura: EstructuraInforme, slides: readonly Slide[]): FilaVistaGeneral[] {
  const porId = new Map(slides.map((s) => [s.id, s]));
  return estructura.nodos.map((nodo): FilaVistaGeneral => {
    const tarjetas = nodo.clase === "bloque"
      ? nodo.laminas.map((l) => tarjeta(l, "lamina", null, porId))
      : [
          tarjeta(nodo.separador, "separador", nodo.numero, porId),
          ...nodo.laminas.map((l) => tarjeta(l, "lamina", null, porId)),
          ...nodo.subcapitulos.flatMap((s) => [
            tarjeta(s.separador, "subcapitulo", s.numero, porId),
            ...s.laminas.map((l) => tarjeta(l, "lamina", null, porId)),
          ]),
        ];
    const numero = nodo.clase === "capitulo" ? nodo.numero : null;
    return {
      id: nodo.id,
      clase: nodo.clase,
      numero,
      titulo: nodo.titulo,
      rotulo: numero ? `${numero}. ${nodo.titulo}` : nodo.titulo,
      tarjetas,
      conteo: contarTarjetas(tarjetas),
      ids: tarjetas.map((t) => t.lamina.id),
    };
  });
}

export function coberturaInforme(filas: readonly FilaVistaGeneral[]): CoberturaInforme {
  const todas = filas.flatMap((f) => f.tarjetas);
  return { ...contarTarjetas(todas), capitulos: filas.filter((f) => f.clase === "capitulo").length };
}

// ---------------------------------------------------------------------------
// Reordenar
// ---------------------------------------------------------------------------

/**
 * Lleva las láminas de `mover` (en el orden en que estaban) a la ranura `antesDe` del orden ORIGINAL (0…n: 0 es antes
 * de la primera, n después de la última). Las que no se mueven conservan su orden. Sirve igual para una lámina, una
 * selección dispersa o un capítulo entero.
 */
export function moverIds(ids: readonly string[], mover: ReadonlySet<string>, antesDe: number): string[] {
  const destino = Math.max(0, Math.min(ids.length, Math.floor(antesDe)));
  const movidas = ids.filter((id) => mover.has(id));
  if (!movidas.length) return [...ids];
  const quedan = ids.filter((id) => !mover.has(id));
  const corte = ids.slice(0, destino).filter((id) => !mover.has(id)).length;
  return [...quedan.slice(0, corte), ...movidas, ...quedan.slice(corte)];
}

/**
 * Alt+↑ / Alt+↓: cada lámina seleccionada salta a su vecina no seleccionada en esa dirección; las que ya tocan el borde
 * se quedan y las demás se juntan con ellas (el comportamiento de una lista de PowerPoint).
 */
export function desplazarIds(ids: readonly string[], mover: ReadonlySet<string>, dir: -1 | 1): string[] {
  const out = [...ids];
  if (dir === -1) {
    for (let i = 1; i < out.length; i += 1) {
      if (mover.has(out[i]) && !mover.has(out[i - 1])) [out[i - 1], out[i]] = [out[i], out[i - 1]];
    }
  } else {
    for (let i = out.length - 2; i >= 0; i -= 1) {
      if (mover.has(out[i]) && !mover.has(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  }
  return out;
}

export function mismoOrden(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

const indices = (ids: readonly string[], miembros: readonly string[]) => {
  const set = new Set(miembros);
  return ids.flatMap((id, i) => (set.has(id) ? [i] : []));
};

/** La ranura justo después de la última lámina de la fila (soltar al final de un capítulo, «Mover a…»). */
export function ranuraAlFinalDeFila(ids: readonly string[], fila: Pick<FilaVistaGeneral, "ids">): number {
  const pos = indices(ids, fila.ids);
  return pos.length ? Math.max(...pos) + 1 : ids.length;
}

/** La ranura antes o después de una tarjeta (soltar sobre su mitad izquierda o derecha). */
export function ranuraJuntoA(ids: readonly string[], id: string, lado: "antes" | "despues"): number | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  return lado === "antes" ? i : i + 1;
}

/**
 * Ranura para llevar un capítulo antes o después de otro. Sólo los capítulos se mueven entre sí: delante de la Apertura
 * o detrás del Cierre el separador se tragaría esas láminas, así que esos destinos no existen (null).
 */
export function ranuraParaCapitulo(
  ids: readonly string[],
  filas: readonly FilaVistaGeneral[],
  objetivoId: string,
  lado: "antes" | "despues",
): number | null {
  const objetivo = filas.find((f) => f.id === objetivoId);
  if (!objetivo || objetivo.clase !== "capitulo") return null;
  const pos = indices(ids, objetivo.ids);
  if (!pos.length) return null;
  return lado === "antes" ? Math.min(...pos) : Math.max(...pos) + 1;
}

/** Alt+↑/↓ sobre un capítulo: lo cruza con el capítulo vecino. null = no hay capítulo en esa dirección. */
export function desplazarCapitulo(ids: readonly string[], filas: readonly FilaVistaGeneral[], filaId: string, dir: -1 | 1): string[] | null {
  const capitulos = filas.filter((f) => f.clase === "capitulo");
  const i = capitulos.findIndex((f) => f.id === filaId);
  const vecino = i < 0 ? undefined : capitulos[i + dir];
  if (!vecino) return null;
  const ranura = ranuraParaCapitulo(ids, filas, vecino.id, dir === -1 ? "antes" : "despues");
  if (ranura === null) return null;
  const siguiente = moverIds(ids, new Set(capitulos[i].ids), ranura);
  return mismoOrden(ids, siguiente) ? null : siguiente;
}

/** Dónde caería lo que se arrastra: junto a una tarjeta, al final de una fila o junto a un capítulo. */
export type MarcaSoltar =
  | { clase: "tarjeta"; id: string; lado: "antes" | "despues" }
  | { clase: "fin-fila"; filaId: string }
  | { clase: "capitulo"; filaId: string; lado: "antes" | "despues" };

/** Lo que se arrastra: láminas sueltas (una o la selección) o un capítulo entero. */
export type Arrastre = { clase: "laminas"; ids: string[] } | { clase: "capitulo"; filaId: string };

/** Mitad de la caja sobre la que está el puntero: la izquierda (o arriba) suelta antes; la otra, después. */
export function ladoDeSoltar(puntero: number, inicio: number, largo: number): "antes" | "despues" {
  return puntero < inicio + largo / 2 ? "antes" : "despues";
}

/**
 * Arrastrando un capítulo con el puntero en el HUECO entre dos filas (el `gap` del contenedor, donde además se dibuja la
 * línea de «soltar aquí»): ninguna fila recibe el evento y soltar ahí no contaba (QA, ~12 px muertos). Se resuelve contra
 * la fila más cercana: antes de la de abajo si es capítulo, si no después de la de arriba. null si no hay capítulo cerca.
 */
export function marcaCapituloEnHueco(
  filas: readonly { id: string; clase: FilaVistaGeneral["clase"]; top: number; bottom: number }[],
  y: number,
): Extract<MarcaSoltar, { clase: "capitulo" }> | null {
  const abajoIdx = filas.findIndex((f) => f.top >= y);
  const abajo = abajoIdx >= 0 ? filas[abajoIdx] : undefined;
  const arriba = abajoIdx >= 0 ? filas[abajoIdx - 1] : filas[filas.length - 1];
  const dAbajo = abajo ? abajo.top - y : Infinity;
  const dArriba = arriba ? y - arriba.bottom : Infinity;
  const candidatos: Extract<MarcaSoltar, { clase: "capitulo" }>[] = [];
  const pref = dAbajo <= dArriba ? ["abajo", "arriba"] : ["arriba", "abajo"];
  for (const lado of pref) {
    if (lado === "abajo" && abajo?.clase === "capitulo") candidatos.push({ clase: "capitulo", filaId: abajo.id, lado: "antes" });
    if (lado === "arriba" && arriba?.clase === "capitulo") candidatos.push({ clase: "capitulo", filaId: arriba.id, lado: "despues" });
  }
  return candidatos[0] ?? null;
}

/** El orden nuevo del plan al soltar, o null si soltar ahí no cambia nada o no tiene sentido. */
export function ordenTrasSoltar(
  ids: readonly string[],
  filas: readonly FilaVistaGeneral[],
  arrastre: Arrastre,
  marca: MarcaSoltar,
): string[] | null {
  let mover: Set<string>;
  let ranura: number | null;
  if (arrastre.clase === "capitulo") {
    if (marca.clase !== "capitulo" || marca.filaId === arrastre.filaId) return null;
    const fila = filas.find((f) => f.id === arrastre.filaId);
    if (!fila || fila.clase !== "capitulo") return null;
    mover = new Set(fila.ids);
    ranura = ranuraParaCapitulo(ids, filas, marca.filaId, marca.lado);
  } else {
    mover = new Set(arrastre.ids);
    if (marca.clase === "tarjeta") {
      ranura = ranuraJuntoA(ids, marca.id, marca.lado);
    } else {
      const fila = filas.find((f) => f.id === marca.filaId);
      ranura = fila ? ranuraAlFinalDeFila(ids, fila) : null;
    }
  }
  if (ranura === null || !mover.size) return null;
  const siguiente = moverIds(ids, mover, ranura);
  return mismoOrden(ids, siguiente) ? null : siguiente;
}

/** El plan en el orden pedido. Un id que no está se ignora; una lámina que el orden no nombra conserva su lugar al final. */
export function reordenarSlides(slides: readonly Slide[], orden: readonly string[]): Slide[] {
  const porId = new Map(slides.map((s) => [s.id, s]));
  const vistos = new Set<string>();
  const out: Slide[] = [];
  for (const id of orden) {
    const s = porId.get(id);
    if (s && !vistos.has(id)) { out.push(s); vistos.add(id); }
  }
  for (const s of slides) if (!vistos.has(s.id)) out.push(s);
  return out;
}

// ---------------------------------------------------------------------------
// Acciones en bloque
// ---------------------------------------------------------------------------

/**
 * Duplica cada lámina elegida justo después de su original (como `duplicateSlide` del store: id nuevo, payload clonado,
 * sin `origen` porque la copia la hizo una persona). Devuelve el plan y los ids de las copias, que pasan a ser la selección.
 */
export function duplicarSlides(slides: readonly Slide[], elegidas: ReadonlySet<string>, nuevoId: () => string): { slides: Slide[]; copias: string[] } {
  const out: Slide[] = [];
  const copias: string[] = [];
  const usados = new Set(slides.map((s) => s.id));
  for (const s of slides) {
    out.push(s);
    if (!elegidas.has(s.id)) continue;
    let id = nuevoId();
    while (usados.has(id)) id = nuevoId();
    usados.add(id);
    copias.push(id);
    out.push({ id, tipo: s.tipo, payload: JSON.parse(JSON.stringify(s.payload ?? {})) as Slide["payload"] });
  }
  return { slides: out, copias };
}

/** Quita las elegidas y dice qué lámina queda como referencia: la primera que sigue a la primera eliminada, o la anterior. */
export function eliminarSlides(slides: readonly Slide[], elegidas: ReadonlySet<string>): { slides: Slide[]; vecina: string | null } {
  const primera = slides.findIndex((s) => elegidas.has(s.id));
  const quedan = slides.filter((s) => !elegidas.has(s.id));
  if (primera < 0) return { slides: quedan, vecina: null };
  const despues = slides.slice(primera).find((s) => !elegidas.has(s.id));
  const antes = [...slides.slice(0, primera)].reverse().find((s) => !elegidas.has(s.id));
  return { slides: quedan, vecina: (despues ?? antes)?.id ?? null };
}

// ---------------------------------------------------------------------------
// «Mover al capítulo»
// ---------------------------------------------------------------------------

/**
 * Lo que se mueve de verdad: un separador elegido arrastra su capítulo entero (como el asa de la fila) y un separador
 * de subcapítulo, su subcapítulo. Sin esto el separador viajaba solo, quedaba como capítulo vacío tras el destino y sus
 * láminas se fundían con el capítulo anterior (QA de la Vista general, F2).
 */
export function expandirSeleccion(filas: readonly FilaVistaGeneral[], elegidas: readonly string[]): {
  ids: Set<string>;
  /** Filas de capítulo que viajan enteras. */
  capitulos: FilaVistaGeneral[];
  /** Hay separadores (de capítulo o subcapítulo) en lo que se mueve. */
  conSeparadores: boolean;
} {
  const elegidasSet = new Set(elegidas);
  const ids = new Set<string>();
  const capitulos: FilaVistaGeneral[] = [];
  let conSeparadores = false;
  for (const fila of filas) {
    fila.tarjetas.forEach((t, i) => {
      if (!elegidasSet.has(t.lamina.id)) return;
      if (t.rol === "separador") {
        conSeparadores = true;
        if (!capitulos.includes(fila)) capitulos.push(fila);
        fila.ids.forEach((id) => ids.add(id));
        return;
      }
      ids.add(t.lamina.id);
      if (t.rol !== "subcapitulo") return;
      conSeparadores = true;
      for (const sig of fila.tarjetas.slice(i + 1)) {
        if (sig.rol !== "lamina") break;
        ids.add(sig.lamina.id);
      }
    });
  }
  return { ids, capitulos, conSeparadores };
}

/** Destinos de «Mover al capítulo» para la selección: con separadores sólo valen capítulos que no viajan. */
export function destinosParaMover(filas: readonly FilaVistaGeneral[], elegidas: readonly string[]): Set<string> {
  const { capitulos, conSeparadores } = expandirSeleccion(filas, elegidas);
  return new Set(filas.filter((f) => !conSeparadores || (f.clase === "capitulo" && !capitulos.includes(f))).map((f) => f.id));
}

export type ResultadoMoverA =
  | { ok: true; orden: string[]; movidas: string[]; anuncio: string }
  | { ok: false; anuncio: string };

/**
 * «Mover al capítulo»: lleva la selección (expandida, ver `expandirSeleccion`) al final de la fila destino. Con
 * capítulos o subcapítulos en la selección el destino tiene que ser otro capítulo: al final de un bloque el separador se
 * tragaría las láminas que vienen detrás. El anuncio nombra el destino, no lo que se movió.
 */
export function moverAlCapitulo(
  ids: readonly string[],
  filas: readonly FilaVistaGeneral[],
  elegidas: readonly string[],
  destinoId: string,
): ResultadoMoverA {
  const destino = filas.find((f) => f.id === destinoId);
  if (!destino || !elegidas.length) return { ok: false, anuncio: "Elige láminas y un capítulo de destino." };
  const { ids: mover, capitulos, conSeparadores } = expandirSeleccion(filas, elegidas);
  if (conSeparadores && !destinosParaMover(filas, elegidas).has(destino.id)) {
    return {
      ok: false,
      anuncio: capitulos.includes(destino)
        ? `«${destino.titulo}» está entre lo que se mueve: elige otro capítulo.`
        : `Un capítulo sólo se puede mover detrás de otro capítulo, no a «${destino.titulo}».`,
    };
  }
  const orden = moverIds(ids, mover, ranuraAlFinalDeFila(ids, destino));
  if (mismoOrden(ids, orden)) return { ok: false, anuncio: `Las elegidas ya están al final de «${destino.titulo}».` };
  const movidas = ids.filter((id) => mover.has(id));
  const sueltas = movidas.length - capitulos.reduce((n, c) => n + c.ids.length, 0);
  const partes = [
    ...(capitulos.length === 1 ? [`el capítulo «${capitulos[0].titulo}»`] : capitulos.length > 1 ? [`${capitulos.length} capítulos`] : []),
    ...(sueltas > 0 ? [sueltas === 1 ? "1 lámina" : `${sueltas} láminas`] : []),
  ];
  const que = partes.join(" y ");
  const anuncio = capitulos.length
    ? `Movido ${que} detrás de «${destino.titulo}».`
    : `${sueltas === 1 ? "1 lámina movida" : `${sueltas} láminas movidas`} al final de «${destino.titulo}».`;
  return { ok: true, orden, movidas, anuncio: anuncio.charAt(0).toUpperCase() + anuncio.slice(1) };
}

/** En qué fila quedó una lámina (para anunciar adónde fue a parar tras moverla). */
export function filaDeLamina(filas: readonly FilaVistaGeneral[], id: string): FilaVistaGeneral | null {
  return filas.find((f) => f.ids.includes(id)) ?? null;
}
