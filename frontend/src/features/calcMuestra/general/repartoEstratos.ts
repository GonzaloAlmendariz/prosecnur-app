/**
 * El reparto de la muestra entre estratos (o entre actores), listo para
 * dibujarse: de dónde sale cada fila, a qué escala se pinta, qué dice el
 * tooltip y qué resumen oye un lector de pantalla.
 *
 * Dos escalas, dos preguntas:
 * - «tamano»: todas las barras contra el estrato más grande. Responde cuánto
 *   pesa cada estrato en el marco y cuánto se le lleva.
 * - «fraccion»: cada barra es su propio N (100 %). Responde si la π es pareja
 *   entre estratos —una proporcional da barras iguales; Neyman, no—.
 */
import type { CalcMuestraComponente, CalcMuestraDistribucionEstrato } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida } from "../../../api/calcMuestraGeneral";
import { fmtDec, fmtInt, fmtPct, safeNumber } from "../sharedCore";
import type { TooltipDatos } from "../universidad/shared/graficos/TooltipGrafico";
import { tecnicaCalculadaLabel } from "./catalogos";
import { formatearPi } from "./modelo";
import { hayResultado } from "./secciones";
import { CLAVE_SIN_ESTRATO } from "./tituloCorrida";

export type EscalaReparto = "tamano" | "fraccion";

/** Qué se reparte: estratos de un cálculo, estratos de una corrida o actores. */
export type OrigenReparto = "resultado" | "corrida" | "actores";

export type FilaReparto = {
  clave: string;
  etiqueta: string;
  N: number;
  /** Encuestas completas del estrato; `null` si el origen no las trae. */
  n: number | null;
  /** n a campo (lo que se sortea); `null` si el origen no lo trae. */
  nCampo: number | null;
  /** π del estrato; `null` si no se conoce (PPS: es de cada unidad). */
  pi: number | null;
  /** Rótulo auxiliar (técnica del actor). */
  nota?: string;
};

export function etiquetaEstrato(clave: string): string {
  return clave === CLAVE_SIN_ESTRATO ? "Marco completo" : clave;
}

function fraccion(n: number | null, N: number): number | null {
  if (n == null || !(N > 0)) return null;
  return Math.min(1, Math.max(0, n / N));
}

/** Estratos del resultado del motor (`distribucion_estratos`). */
export function filasDesdeResultado(distribucion: readonly CalcMuestraDistribucionEstrato[]): FilaReparto[] {
  return distribucion.map((row) => {
    const N = safeNumber(row.N, 0);
    const nCampo = row.n_campo != null && Number.isFinite(row.n_campo) ? row.n_campo : null;
    return {
      clave: row.estrato,
      etiqueta: etiquetaEstrato(row.estrato),
      N,
      n: Number.isFinite(row.n) ? row.n : null,
      nCampo,
      pi: fraccion(nCampo, N),
    };
  });
}

/** Estratos de una corrida sorteada: N_h, n_h y la π que publicó el motor. */
export function filasDesdeCorrida(corrida: Pick<CalcMuestraGeneralCorrida, "estratos">): FilaReparto[] {
  return corrida.estratos.map((e) => ({
    clave: e.clave,
    etiqueta: etiquetaEstrato(e.clave),
    N: safeNumber(e.N_h, 0),
    n: null,
    nCampo: Number.isFinite(e.n_h) ? e.n_h : null,
    pi: e.pi != null && Number.isFinite(e.pi) ? e.pi : null,
  }));
}

/** Actores de Acreditación con marco y n calculado. */
export function filasDesdeActores(componentes: readonly CalcMuestraComponente[]): FilaReparto[] {
  return componentes
    .filter((c) => safeNumber(c.marco?.marco_validado, 0) > 0 && hayResultado([c]))
    .map((c) => {
      const N = safeNumber(c.marco.marco_validado, 0);
      const nCampo = c.resultado?.n_operativo ?? null;
      return {
        clave: c.id,
        etiqueta: c.actor?.trim() || c.actor_id?.trim() || c.id,
        N,
        n: c.resultado?.n_objetivo ?? null,
        nCampo,
        pi: fraccion(nCampo, N),
        nota: tecnicaCalculadaLabel(c),
      };
    });
}

export type FilaDibujo = FilaReparto & {
  /** Anchos en % del carril. */
  anchoN: number;
  anchoCampo: number | null;
  anchoCompletas: number | null;
  /** Peso base 1/π; `null` sin π. */
  peso: number | null;
  /** N_h / ΣN. */
  participacion: number;
};

/** Un n chico no desaparece: se dibuja con un mínimo visible. */
const ANCHO_MINIMO = 0.6;

function ancho(valor: number | null, escala: number): number | null {
  if (valor == null || !(escala > 0)) return null;
  const pct = (valor / escala) * 100;
  if (valor > 0 && pct < ANCHO_MINIMO) return ANCHO_MINIMO;
  return Math.min(100, Math.max(0, pct));
}

export function dibujarReparto(filas: readonly FilaReparto[], escala: EscalaReparto): FilaDibujo[] {
  const total = filas.reduce((acc, f) => acc + f.N, 0);
  const maximo = filas.reduce((acc, f) => Math.max(acc, f.N), 0);
  return filas.map((f) => {
    const base = escala === "fraccion" ? f.N : maximo;
    return {
      ...f,
      anchoN: escala === "fraccion" ? (f.N > 0 ? 100 : 0) : (ancho(f.N, maximo) ?? 0),
      anchoCampo: ancho(f.nCampo, base),
      anchoCompletas: ancho(f.n, base),
      peso: f.pi != null && f.pi > 0 ? 1 / f.pi : null,
      participacion: total > 0 ? f.N / total : 0,
    };
  });
}

/**
 * Desde qué fracción de su ancho NUEVO arranca una barra al cambiar de escala
 * (E16 · M3). El ancho de verdad sigue siendo el atributo `width`: la
 * transición sólo declara el `from` en `scaleX`, así una captura a mitad no
 * congela un valor falso (F55). Como el ancho anterior nunca pasa del 100 %
 * del carril, el cociente tampoco hace que la barra se salga de él. Sin ancho
 * nuevo (o sin anterior) no hay nada que cruzar: 1.
 */
export function desdeReescala(anterior: number | null, actual: number | null): number {
  if (anterior == null || actual == null || !(actual > 0) || !(anterior >= 0)) return 1;
  return Math.round((anterior / actual) * 1000) / 1000;
}

/** Los anchos de la otra escala por fila: lo que había antes del cambio. */
export function anchosPrevios(
  filas: readonly FilaReparto[],
  escala: EscalaReparto,
): Map<string, Pick<FilaDibujo, "anchoN" | "anchoCampo" | "anchoCompletas">> {
  const otra: EscalaReparto = escala === "tamano" ? "fraccion" : "tamano";
  return new Map(dibujarReparto(filas, otra).map((f) => [f.clave, { anchoN: f.anchoN, anchoCampo: f.anchoCampo, anchoCompletas: f.anchoCompletas }]));
}

/** Lo que el tooltip de una fila publica; sin datos, la fila no miente. */
export function tooltipDeFila(fila: FilaDibujo, origen: OrigenReparto): TooltipDatos {
  const filas: { label: string; valor: string }[] = [
    { label: origen === "actores" ? "N del marco" : "N del estrato", valor: fmtInt(fila.N) },
  ];
  if (fila.n != null) filas.push({ label: "n completas", valor: fmtInt(fila.n) });
  if (fila.nCampo != null) filas.push({ label: origen === "corrida" ? "n sorteado" : "n a campo", valor: fmtInt(fila.nCampo) });
  if (origen === "actores") {
    filas.push({ label: "Fracción a campo", valor: fmtPct(fila.pi) });
  } else {
    filas.push({ label: "π", valor: fila.pi != null ? formatearPi(fila.pi) : "por unidad" });
    filas.push({ label: "Peso base (1/π)", valor: fila.peso != null ? fmtDec(fila.peso, 2) : "—" });
    filas.push({ label: "Del marco", valor: fmtPct(fila.participacion) });
  }
  return { titulo: fila.etiqueta, filas, nota: fila.nota, tono: "acento" };
}

/** Una frase que resume el gráfico para `aria-label`. */
export function resumenReparto(filas: readonly FilaReparto[], origen: OrigenReparto): string {
  if (filas.length === 0) return "Sin reparto que mostrar.";
  const unidad = origen === "actores" ? "actores" : "estratos";
  const N = filas.reduce((acc, f) => acc + f.N, 0);
  const campo = filas.reduce((acc, f) => acc + (f.nCampo ?? f.n ?? 0), 0);
  const conPi = filas.filter((f) => f.pi != null);
  const partes = [
    `Reparto de ${fmtInt(campo)} ${origen === "corrida" ? "sorteados" : "a campo"} entre ${fmtInt(filas.length)} ${unidad} de un marco de ${fmtInt(N)}.`,
  ];
  if (conPi.length >= 2) {
    const orden = [...conPi].sort((a, b) => (a.pi ?? 0) - (b.pi ?? 0));
    const menor = orden[0];
    const mayor = orden[orden.length - 1];
    const etiqueta = origen === "actores" ? "fracción" : "π";
    const valor = (f: FilaReparto) => (origen === "actores" ? fmtPct(f.pi) : formatearPi(f.pi));
    partes.push(`${etiqueta} de ${valor(menor)} en ${menor.etiqueta} a ${valor(mayor)} en ${mayor.etiqueta}.`);
  }
  return partes.join(" ");
}

/** ¿La π es pareja? Diferencia relativa entre la mayor y la menor. */
export function dispersionPi(filas: readonly FilaReparto[]): number | null {
  const pis = filas.map((f) => f.pi).filter((p): p is number => p != null && p > 0);
  if (pis.length < 2) return null;
  const min = Math.min(...pis);
  const max = Math.max(...pis);
  return (max - min) / max;
}

/** Lo mínimo de `window` que usa {@link sostenerTooltipEnFoco}. */
export type ObjetivoScroll = {
  addEventListener: (tipo: "scroll", fn: () => void, captura: boolean) => void;
  removeEventListener: (tipo: "scroll", fn: () => void, captura: boolean) => void;
};

/** `requestAnimationFrame` / `cancelAnimationFrame`, inyectables para el test. */
export type ProgramadorFrame = {
  pedir: (fn: () => void) => number;
  cancelar: (id: number) => void;
};

/**
 * Mantiene abierto el tooltip de la barra enfocada cuando algo hace scroll.
 *
 * El tooltip compartido se cierra en cualquier scroll porque se ancla al
 * cursor. Con teclado no hay cursor: el foco mismo desplaza el dueño de scroll
 * para mostrar la barra, y el tooltip que el foco acababa de abrir moría ahí.
 * Tras el scroll —en el frame siguiente, cuando todos los listeners de scroll
 * ya corrieron, incluido el que lo cierra— se reabre sobre la geometría nueva
 * de la barra si sigue enfocada.
 */
export function sostenerTooltipEnFoco<T>({
  objetivo,
  enfocada,
  reabrir,
  frame,
}: {
  objetivo: ObjetivoScroll;
  /** La barra con el foco, o `null` si el foco no está en una del gráfico. */
  enfocada: () => T | null;
  reabrir: (barra: T) => void;
  frame: ProgramadorFrame;
}): () => void {
  let pendiente: number | null = null;
  const alScroll = () => {
    if (enfocada() == null) return;
    if (pendiente != null) frame.cancelar(pendiente);
    pendiente = frame.pedir(() => {
      pendiente = null;
      const barra = enfocada();
      if (barra != null) reabrir(barra);
    });
  };
  objetivo.addEventListener("scroll", alScroll, true);
  return () => {
    objetivo.removeEventListener("scroll", alScroll, true);
    if (pendiente != null) frame.cancelar(pendiente);
  };
}
