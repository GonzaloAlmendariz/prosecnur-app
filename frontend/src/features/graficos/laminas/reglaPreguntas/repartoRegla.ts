// El reparto de las candidatas de la regla de preguntas (ADR 0135 §4) y la selección calculada en el cliente con las
// métricas que el backend ya mandó. Puro: el slider de la cifra mueve el corte y el conteo en vivo sin esperar el
// pedido; cuando el backend responde, manda el backend (ReglaPreguntas.tsx).
//
// La selección replica `.regla_preguntas_evaluar` (graficos_regla_preguntas.R): orden por la métrica (descendente o
// ascendente) con desempate por el orden del instrumento, que es el orden en que llegan las candidatas; y el ajuste a
// mano encima (`agregar` entra al final, `quitar` sale). Una candidata sin métrica no entra por la regla.

import type { CandidataRegla, ReglaPreguntas, TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { CON_N, CON_UMBRAL, N_POR_DEFECTO, UMBRAL_POR_DEFECTO } from "./modeloReglaPreguntas";

/** `umbral`: el eje es la métrica y el corte un valor. `posicion`: el eje es el orden y el corte la posición N. */
export type ModoReparto = "umbral" | "posicion";

export type PuntoReparto = {
  tema: string;
  metrica: number;
  entra: boolean;
  /** Posición en el eje: el valor (modo umbral) o el puesto 1..n en el orden (modo posición). */
  x: number;
};

export type Reparto = {
  modo: ModoReparto;
  puntos: PuntoReparto[];
  /** Candidatas sin métrica: no se dibujan. */
  sinDato: number;
  /** Extremo del eje: el valor máximo (umbral) o la cantidad de puestos (posición). */
  ejeMax: number;
  /** Cortes en unidades del eje. Extremos lleva dos (las altas y las bajas). */
  cortes: number[];
  /** Escala de las mini barras de las filas (0..escala, en unidades de la métrica). */
  escala: number;
  /** Cortes en unidades de la métrica, para la marca de las mini barras. */
  cortesValor: number[];
  /** Temas que entran por la regla y el ajuste a mano. */
  seleccionadas: string[];
};

/** Los tipos que el cliente sabe recalcular: los que tienen cifra. */
export function calculableLocal(tipo: TipoReglaPreguntas): boolean {
  return CON_N.has(tipo) || CON_UMBRAL.has(tipo);
}

const nDe = (r: ReglaPreguntas): number => Math.max(0, Math.floor(r.n ?? N_POR_DEFECTO));
const umbralDe = (r: ReglaPreguntas): number => r.umbral ?? UMBRAL_POR_DEFECTO[r.tipo as "diferencia_minima" | "bajo_umbral"] ?? 0;

type Indexada = { tema: string; metrica: number; i: number };

const conMetrica = (cs: readonly CandidataRegla[]): Indexada[] =>
  cs.flatMap((c, i) => (c.metrica !== null && Number.isFinite(c.metrica) ? [{ tema: c.tema, metrica: c.metrica, i }] : []));

const desc = (xs: Indexada[]): Indexada[] => [...xs].sort((a, b) => b.metrica - a.metrica || a.i - b.i);
const asc = (xs: Indexada[]): Indexada[] => [...xs].sort((a, b) => a.metrica - b.metrica || a.i - b.i);

/** Lo que elige la regla antes del ajuste a mano, en el orden del backend; extremos devuelve también las altas. */
function eleccion(regla: ReglaPreguntas, cs: readonly CandidataRegla[]): { temas: string[]; altas: number; bajas: number } | null {
  const m = conMetrica(cs);
  const temas = (xs: Indexada[]) => xs.map((x) => x.tema);
  switch (regla.tipo) {
    case "mayor_diferencia": return { temas: temas(desc(m).slice(0, nDe(regla))), altas: 0, bajas: 0 };
    case "diferencia_minima": return { temas: temas(desc(m.filter((x) => x.metrica >= umbralDe(regla)))), altas: 0, bajas: 0 };
    case "mayor_sin_info": return { temas: temas(desc(m.filter((x) => x.metrica > 0)).slice(0, nDe(regla))), altas: 0, bajas: 0 };
    case "bajo_umbral": return { temas: temas(asc(m.filter((x) => x.metrica < umbralDe(regla)))), altas: 0, bajas: 0 };
    case "extremos": {
      const a = desc(m).slice(0, nDe(regla));
      const usadas = new Set(a.map((x) => x.tema));
      const b = asc(m.filter((x) => !usadas.has(x.tema))).slice(0, nDe(regla));
      return { temas: [...temas(a), ...temas(desc(b))], altas: a.length, bajas: b.length };
    }
    default: return null;
  }
}

/**
 * Las que entran con esta regla, calculadas con las métricas recibidas; `null` si el tipo no tiene cifra (Todas,
 * Comunes, A mano: el universo depende de datos que el cliente no tiene y no hay corte que mover).
 */
export function seleccionLocal(regla: ReglaPreguntas, candidatas: readonly CandidataRegla[]): string[] | null {
  const e = eleccion(regla, candidatas);
  if (!e) return null;
  const existentes = new Set(candidatas.map((c) => c.tema));
  const quitar = new Set(regla.quitar ?? []);
  const sel = [...e.temas];
  for (const t of regla.agregar ?? []) if (existentes.has(t) && !sel.includes(t)) sel.push(t);
  return sel.filter((t) => !quitar.has(t));
}

/** El techo «redondo» de la escala de las diferencias y de Sin información: múltiplo de 10, entre 10 y 100. */
export function techoRedondo(v: number): number {
  if (!Number.isFinite(v) || v <= 10) return 10;
  return Math.min(100, Math.ceil(v / 10) * 10);
}

/** Las métricas en porcentaje (el mínimo o el promedio del indicador) van sobre 0–100; las diferencias, a su techo. */
function escalaDe(tipo: TipoReglaPreguntas, maximo: number, umbral: number | null): number {
  if (tipo === "bajo_umbral" || tipo === "extremos") return 100;
  return techoRedondo(Math.max(maximo, umbral ?? 0));
}

/** El reparto que se dibuja; `null` si el tipo no tiene cifra. */
export function repartoRegla(regla: ReglaPreguntas, candidatas: readonly CandidataRegla[]): Reparto | null {
  const e = eleccion(regla, candidatas);
  const seleccionadas = seleccionLocal(regla, candidatas);
  if (!e || !seleccionadas) return null;
  const entran = new Set(seleccionadas);
  const m = conMetrica(candidatas);
  const sinDato = candidatas.length - m.length;
  const maximo = m.reduce((acc, x) => Math.max(acc, x.metrica), 0);

  if (CON_UMBRAL.has(regla.tipo)) {
    const u = umbralDe(regla);
    const escala = escalaDe(regla.tipo, maximo, u);
    return {
      modo: "umbral", sinDato, ejeMax: escala, cortes: [u], escala, cortesValor: [u], seleccionadas,
      puntos: asc(m).map((x) => ({ tema: x.tema, metrica: x.metrica, entra: entran.has(x.tema), x: x.metrica })),
    };
  }

  // Por posición: de mayor a menor, como ordena el backend. Sin información con 0 nunca entra y queda al final.
  const orden = desc(m);
  const puestos = orden.length;
  const n = Math.min(nDe(regla), puestos);
  const cortes = regla.tipo === "extremos" ? [e.altas, ...(e.bajas > 0 ? [puestos - e.bajas] : [])] : [regla.tipo === "mayor_sin_info" ? Math.min(n, orden.filter((x) => x.metrica > 0).length) : n];
  const valorEn = (puesto: number): number | null => (puesto >= 1 && puesto <= puestos ? orden[puesto - 1].metrica : null);
  const cortesValor = regla.tipo === "extremos"
    ? [valorEn(e.altas), e.bajas > 0 ? valorEn(puestos - e.bajas + 1) : null]
    : [valorEn(cortes[0])];
  return {
    modo: "posicion", sinDato, ejeMax: puestos, cortes, escala: escalaDe(regla.tipo, maximo, null), seleccionadas,
    cortesValor: cortesValor.filter((v): v is number => v !== null),
    puntos: orden.map((x, k) => ({ tema: x.tema, metrica: x.metrica, entra: entran.has(x.tema), x: k + 1 })),
  };
}

export type Recorrido = {
  /** Lo que recorre la pista del slider: el eje del reparto, para que pulgar y línea del corte coincidan. */
  pista: { min: number; max: number };
  /** Lo que admite la cifra (el pulgar no deja valores fuera de aquí). */
  valores: { min: number; max: number };
};

/**
 * Recorrido del slider. En umbral, el eje del valor. En posición, la pista va de 0 a los puestos (el corte tras el
 * puesto N cae en N / puestos, justo bajo el pulgar en N) y la cifra de 1 a los puestos (extremos: la mitad, de cada
 * lado; el pulgar recorre la mitad izquierda, que es donde cae el corte de las altas).
 */
export function recorridoSlider(r: Reparto, tipo: TipoReglaPreguntas, campo: { min: number; max: number }, valor: number): Recorrido {
  if (r.modo === "umbral") {
    const l = { min: campo.min, max: Math.min(campo.max, Math.max(r.ejeMax, valor)) };
    return { pista: l, valores: l };
  }
  const tope = tipo === "extremos" ? Math.ceil(r.ejeMax / 2) : r.ejeMax;
  return { pista: { min: 0, max: Math.max(1, r.ejeMax) }, valores: { min: 1, max: Math.max(1, Math.min(campo.max, tope)) } };
}

/**
 * Fracción 0..1 del eje para una posición. En umbral, el valor sobre el eje. En posición, el centro de la celda del
 * puesto: el eje se parte en tantas celdas como puestos y el puesto k ocupa la k-ésima.
 */
export function fraccionEje(r: Reparto, x: number): number {
  if (r.modo === "umbral") return r.ejeMax > 0 ? Math.min(1, Math.max(0, x / r.ejeMax)) : 0;
  return r.ejeMax > 0 ? Math.min(1, Math.max(0, (x - 0.5) / r.ejeMax)) : 0;
}

/** La línea del corte en fracción del eje: el valor (umbral) o el borde entre el puesto N y el siguiente (posición). */
export function fraccionCorte(r: Reparto, corte: number): number {
  if (r.modo === "umbral") return fraccionEje(r, corte);
  return r.ejeMax > 0 ? Math.min(1, Math.max(0, corte / r.ejeMax)) : 0;
}

/** Pila de puntos por columna (modo umbral): cada punto lleva su columna y su nivel; `niveles` es la pila más alta. */
export function apilar(puntos: readonly PuntoReparto[], ejeMax: number, columnas: number): { tema: string; columna: number; nivel: number }[] {
  const altura = new Map<number, number>();
  const cols = Math.max(1, Math.floor(columnas));
  return puntos.map((p) => {
    const columna = ejeMax > 0 ? Math.min(cols - 1, Math.max(0, Math.round((p.x / ejeMax) * (cols - 1)))) : 0;
    const nivel = altura.get(columna) ?? 0;
    altura.set(columna, nivel + 1);
    return { tema: p.tema, columna, nivel };
  });
}

/** Paso grande del teclado (Shift + flecha): diez pasos en umbral, cinco puestos en N. */
export function pasoGrande(tipo: TipoReglaPreguntas, paso: number): number {
  if (CON_N.has(tipo)) return 5;
  return paso >= 5 ? paso * 2 : 10;
}

/** El valor que deja una tecla sobre el slider; `null` si la tecla no lo mueve. Shift multiplica el paso. */
export function valorPorTecla(tecla: string, shift: boolean, valor: number, l: { min: number; max: number; paso: number; grande: number }): number | null {
  const d = shift ? l.grande : l.paso;
  const acotar = (v: number) => Math.min(l.max, Math.max(l.min, v));
  if (tecla === "ArrowRight" || tecla === "ArrowUp") return acotar(valor + d);
  if (tecla === "ArrowLeft" || tecla === "ArrowDown") return acotar(valor - d);
  if (tecla === "PageUp") return acotar(valor + l.grande);
  if (tecla === "PageDown") return acotar(valor - l.grande);
  if (tecla === "Home") return l.min;
  if (tecla === "End") return l.max;
  return null;
}

/**
 * El valor de la pista llevado al paso de la cifra. La pista va sin paso nativo (`step="any"`) para que el pulgar se
 * pare en el valor exacto que se escribió (58 con paso 5): con `step` el navegador lo redondeaba y el pulgar quedaba
 * a 6 px de la línea del corte. Arrastrar sí cae en el paso; el teclado conserva los suyos (valorPorTecla).
 */
export function alPaso(v: number, paso: number, l: { min: number; max: number }): number {
  const d = paso > 0 ? Math.round(v / paso) * paso : v;
  // Sin el redondeo a 10 decimales, 0.1 + 0.2 sale 0.30000000000000004 con pasos fraccionarios.
  return Math.min(l.max, Math.max(l.min, Number(d.toFixed(10))));
}

/**
 * El rótulo del corte bajo el eje en las reglas por posición: el valor de la métrica donde cae, con su unidad, para que
 * no se lea como un conteo junto a «Cuántas» («Corte 19» parecía 19 preguntas). Las diferencias van en puntos; el Sin
 * información es un porcentaje; el promedio de Extremos va sin unidad (el indicador puede no ser un porcentaje).
 */
export function textoCorteEje(tipo: TipoReglaPreguntas, cortes: readonly string[]): string {
  if (!cortes.length) return "";
  const unidad = tipo === "mayor_diferencia" || tipo === "diferencia_minima" ? " pts" : tipo === "mayor_sin_info" ? "%" : "";
  const valores = cortes.map((c) => `${c}${unidad}`);
  return `${valores.length > 1 ? "Cortes" : "Corte"} en ${valores.join(" y ")}`;
}

/**
 * Cuánto desplazar la lista para traer a la vista una fila resaltada desde el reparto; `null` si ya se ve entera (la
 * lista no se mueve por una fila visible).
 */
export function desplazamientoParaFila(fila: { arriba: number; alto: number }, vista: { scrollTop: number; alto: number }): number | null {
  const abajo = fila.arriba + fila.alto;
  if (fila.arriba < vista.scrollTop) return fila.arriba;
  if (abajo > vista.scrollTop + vista.alto) return abajo - vista.alto;
  return null;
}

/** ¿La lámina ordena de menor a mayor? Bajo un umbral, la más crítica arriba (graficos_regla_orden_escala.R). */
const ascendente = (tipo: TipoReglaPreguntas) => tipo === "bajo_umbral";

/**
 * Las candidatas en el orden de la lámina: por la métrica de la regla, de mayor a menor (de menor a mayor bajo un
 * umbral), sin dato al final y el orden del instrumento como desempate. «Elegidas a mano» conserva el del instrumento.
 */
export function ordenFilas<T extends Pick<CandidataRegla, "metrica">>(tipo: TipoReglaPreguntas, candidatas: readonly T[]): T[] {
  if (tipo === "a_mano") return [...candidatas];
  const signo = ascendente(tipo) ? 1 : -1;
  return candidatas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const ma = a.c.metrica, mb = b.c.metrica;
      const fa = ma !== null && Number.isFinite(ma), fb = mb !== null && Number.isFinite(mb);
      if (fa !== fb) return fa ? -1 : 1;
      if (fa && fb && ma !== mb) return signo * ((ma as number) - (mb as number));
      return a.i - b.i;
    })
    .map((x) => x.c);
}

export type MarcasCorte = {
  /** Temas que abren un tramo distinto del anterior (la línea del corte va encima de su fila). */
  trasCorte: Set<string>;
  /** La línea va tras la última fila (entran todas las que tienen dato y no hay filas sin dato después). */
  alFinal: boolean;
  /** Temas empatados en el corte: misma métrica a los dos lados de la línea. */
  empates: Set<string>;
};

/**
 * El corte de la regla sobre las filas ya ordenadas (antes del ajuste a mano); vacío si el tipo no tiene cifra. Con
 * ninguna que entre, la línea va arriba; con todas, tras la última con dato: el corte siempre se ve (C3).
 */
export function marcasDeCorte(regla: ReglaPreguntas, ordenadas: readonly CandidataRegla[]): MarcasCorte {
  const out: MarcasCorte = { trasCorte: new Set(), alFinal: false, empates: new Set() };
  const e = eleccion(regla, ordenadas);
  if (!e || ordenadas.length === 0) return out;
  const porRegla = new Set(e.temas);
  const valoresEmpate = new Set<number>();
  for (let i = 1; i < ordenadas.length; i += 1) {
    const a = ordenadas[i - 1], b = ordenadas[i];
    // Las sin dato van al final y nunca entran por la regla: antes de ellas no hay corte que marcar.
    if (b.metrica === null || porRegla.has(a.tema) === porRegla.has(b.tema)) continue;
    out.trasCorte.add(b.tema);
    if (a.metrica !== null && a.metrica === b.metrica) valoresEmpate.add(a.metrica);
  }
  if (out.trasCorte.size === 0) {
    if (porRegla.size === 0) out.trasCorte.add(ordenadas[0].tema);
    else {
      const sinDato = ordenadas.find((c) => c.metrica === null);
      if (sinDato) out.trasCorte.add(sinDato.tema);
      else out.alFinal = true;
    }
  }
  for (const c of ordenadas) if (c.metrica !== null && valoresEmpate.has(c.metrica)) out.empates.add(c.tema);
  return out;
}

/**
 * ¿Es el aviso del backend que repite el límite? (graficos_escala_tope.R). Sólo para no decirlo dos veces: el límite
 * se lee de `tope_filas`, no de este texto.
 */
export function repiteElTope(aviso: string): boolean {
  return /la lámina nativa admite \d+/.test(aviso);
}

/**
 * El límite de filas de la lámina nativa (`tope_filas` del conteo, 20 en la escala del resumen): siempre que existe se
 * muestra; `excedido` con la selección que se ve (optimista: la local mientras se arrastra).
 */
export function estadoTope(tope: number | null | undefined, seleccionadas: number): { tope: number; excedido: boolean } | null {
  if (typeof tope !== "number" || !Number.isFinite(tope) || tope < 1) return null;
  return { tope, excedido: seleccionadas > tope };
}

/**
 * Dónde cae el tope en el eje del reparto: la posición de la que hace `tope` en el orden de la lámina (en umbral, su
 * valor; en posición, su puesto). `null` si entran menos.
 */
export function posicionTope(r: Reparto, tipo: TipoReglaPreguntas, tope: number): number | null {
  if (!Number.isFinite(tope) || tope < 1) return null;
  const entran = r.puntos.filter((p) => p.entra);
  if (r.modo === "posicion") return entran.length > tope ? tope : null;
  const orden = ascendente(tipo) ? entran : [...entran].reverse();
  return orden.length > tope ? orden[tope - 1].x : null;
}
