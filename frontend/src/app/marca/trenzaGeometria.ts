/**
 * Geometría del isotipo «Trenza», versión Cuerda abierta (7 nov 2026, ADR 0132). Fuente única: la app la dibuja
 * con `IsotipoTrenza` y `branding/logo/generar-isotipo.mjs` la exporta a los SVG de marca. Por eso este archivo no
 * importa nada y sólo usa TypeScript borrable (Node lo carga sin compilar).
 *
 * Siete hilos (los siete módulos) sobre una hélice, en un huso cruzado en diagonal dentro de un cuadro de 100.
 * Cada hilo es una cinta continua de ancho variable; se parte sólo donde cruza el plano medio (z = 0). Las partes
 * de atrás se pintan primero, encima un filo del color de fondo recortado a los hilos de atrás de los OTROS hilos
 * (así el cruce se lee y el hilo no se muerde a sí mismo), y al final las partes de adelante. El tono de cada
 * tramo es una proporción `k` de tinta sobre el fondo (opaco: dos hilos superpuestos nunca suman transparencia).
 */

export type TrenzaGeo = {
  /** Hilos. */ N: number;
  /** Medias vueltas a lo largo del huso. */ K: number;
  x0: number;
  L: number;
  cy: number;
  /** Semiancho del huso. */ A: number;
  wmax: number;
  wmin: number;
  /** Forma del huso: exponente de la envolvente. */ ex: number;
  /** Tinta mínima de un hilo en el fondo de la hélice. */ back: number;
  /** Ancho del filo que separa adelante de atrás. */ halo: number;
  th0: number;
};

/** Cuerda abierta: dos medias vueltas, hilos que dejan ver el trenzado de atrás. */
export const GEO_CUERDA_ABIERTA: TrenzaGeo = {
  N: 7, K: 2, x0: 6, L: 88, cy: 50, A: 20, wmax: 4.9, wmin: 2.2, ex: 0.85, back: 0.2, halo: 1.05, th0: 0.35,
};

/** Desde 32 px hacia abajo: cinco hilos más gruesos para que no se empaste. */
export const GEO_CHICA: TrenzaGeo = {
  N: 5, K: 2.2, x0: 6, L: 88, cy: 50, A: 20, wmax: 9, wmin: 4.4, ex: 0.85, back: 0.42, halo: 1.8, th0: 0.35,
};

/** Giro del huso dentro del cuadro: sube de abajo a la izquierda hacia arriba a la derecha. */
export const ROTACION_TRENZA = -35;

export type TrenzaParada = { offset: number; k: number };
export type TrenzaCinta = { hilo: number; d: string; x1: number; x2: number; paradas: TrenzaParada[] };
export type TrenzaFilo = { hilo: number; recorte: string[]; lineas: string[] };
export type TrenzaGeometria = {
  atras: TrenzaCinta[];
  filos: TrenzaFilo[];
  adelante: TrenzaCinta[];
  /** Silueta del huso que recorta las puntas de las cintas. */
  huso: string;
  anchoFilo: number;
  rotacion: number;
};

export type TrenzaOpciones = {
  chica?: boolean;
  /** 0 = hilos rectos, 1 = trenzados. */
  m?: number;
  /** Giro de la hélice, en radianes. */
  om?: number;
  geo?: Partial<TrenzaGeo>;
  /** Muestras por hilo; menos durante la animación. */
  pasos?: number;
  /** Paradas del degradado de cada tramo. */
  paradas?: number;
};

type Punto = { x: number; y: number; z: number; w: number };
type Tramo = { hilo: number; lado: number; pts: Punto[] };

const TAU = Math.PI * 2;
const f = (n: number) => String(Math.round(n * 100) / 100);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const linea = (arr: Array<[number, number]>) => "M" + arr.map((p) => f(p[0]) + " " + f(p[1])).join("L");

export function trenzaGeometria(op: TrenzaOpciones = {}): TrenzaGeometria {
  const P: TrenzaGeo = { ...(op.chica ? GEO_CHICA : GEO_CUERDA_ABIERTA), ...(op.chica ? {} : op.geo ?? {}) };
  const m = op.m ?? 1;
  const om = op.om ?? 0;
  const pasos = op.pasos ?? (op.chica ? 120 : 220);
  const nParadas = op.paradas ?? 10;

  const hilos: Punto[][] = [];
  for (let i = 0; i < P.N; i++) {
    const phi = (i * TAU) / P.N;
    const pts: Punto[] = [];
    for (let j = 0; j <= pasos; j++) {
      const s = j / pasos;
      const x = P.x0 + P.L * s;
      const sn = Math.sin(Math.PI * s);
      const th = P.th0 + P.K * Math.PI * s + phi + om;
      const yRecto = P.cy + (i - (P.N - 1) / 2) * ((2 * P.A) / P.N) * Math.pow(sn, 0.55);
      const yTrenza = P.cy + P.A * Math.pow(sn, P.ex) * Math.sin(th);
      const z = Math.cos(th) * m * Math.pow(sn, 0.35);
      const afinado = 0.32 + 0.68 * Math.pow(sn, 0.6);
      const w = (P.wmin + (P.wmax - P.wmin) * (z + 1) / 2) * afinado * (0.5 + 0.5 * m);
      pts.push({ x, y: yRecto + (yTrenza - yRecto) * m, z, w });
    }
    hilos.push(pts);
  }

  // tramos por signo de z, compartiendo el punto de corte para que no quede costura
  const tramos: Tramo[] = [];
  hilos.forEach((pts, hilo) => {
    let actual: Tramo | null = null;
    pts.forEach((q, j) => {
      const lado = m < 0.02 ? 1 : q.z >= 0 ? 1 : -1;
      if (!actual || actual.lado !== lado) {
        if (actual) actual.pts.push(q);
        actual = { hilo, lado, pts: actual ? [pts[j - 1], q] : [q] };
        tramos.push(actual);
      } else actual.pts.push(q);
    });
  });

  const bordes = (pts: Punto[]) => {
    const izq: Array<[number, number]> = [];
    const der: Array<[number, number]> = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(pts.length - 1, k + 1)];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const h = pts[k].w / 2;
      izq.push([pts[k].x - dy * h, pts[k].y + dx * h]);
      der.push([pts[k].x + dy * h, pts[k].y - dx * h]);
    }
    return { izq, der };
  };
  const tinta = (z: number) => P.back + (1 - P.back) * (z + 1) / 2;
  const cinta = (t: Tramo) => {
    const { izq, der } = bordes(t.pts);
    const d = linea(izq) + "L" + der.slice().reverse().map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";
    const x1 = t.pts[0].x;
    const x2 = t.pts[t.pts.length - 1].x;
    const n = Math.min(nParadas, t.pts.length - 1);
    const paradas: TrenzaParada[] = [];
    for (let k = 0; k <= n; k++) {
      const q = t.pts[Math.round((k / n) * (t.pts.length - 1))];
      paradas.push({ offset: x2 - x1 > 0.01 ? (q.x - x1) / (x2 - x1) : 0, k: Math.round(tinta(q.z) * 1000) / 1000 });
    }
    return { cinta: { hilo: t.hilo, d, x1, x2, paradas } as TrenzaCinta, izq, der };
  };

  const atras = tramos.filter((t) => t.lado < 0 && t.pts.length > 1).map(cinta);
  const adelante = tramos.filter((t) => t.lado > 0 && t.pts.length > 1).map(cinta);

  const filos: TrenzaFilo[] = [];
  if (m > 0.02 && atras.length) {
    for (let i = 0; i < P.N; i++) {
      const otros = atras.filter((r) => r.cinta.hilo !== i);
      const mios = adelante.filter((r) => r.cinta.hilo === i);
      if (!otros.length || !mios.length) continue;
      filos.push({ hilo: i, recorte: otros.map((r) => r.cinta.d), lineas: mios.flatMap((r) => [linea(r.izq), linea(r.der)]) });
    }
  }

  // silueta: entre la de los hilos rectos y la del huso, según cuán trenzados estén
  const arriba: Array<[number, number]> = [];
  const abajo: Array<[number, number]> = [];
  const margen = P.wmax * (op.chica ? 0.3 : 0.42);
  for (let j = 0; j <= 80; j++) {
    const s = j / 80;
    const sn = Math.sin(Math.PI * s);
    const x = P.x0 + P.L * s + (j === 0 ? -2 : j === 80 ? 2 : 0);
    const eHuso = P.A * Math.pow(sn, P.ex) + margen * Math.pow(sn, 0.3);
    const eRecto = ((P.A * (P.N - 1)) / P.N) * Math.pow(sn, 0.55) + P.wmax;
    const e = eRecto + (eHuso - eRecto) * clamp01((m - 0.35) / 0.65);
    arriba.push([x, P.cy - e]);
    abajo.push([x, P.cy + e]);
  }
  const huso = linea(arriba) + "L" + abajo.slice().reverse().map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";

  return {
    atras: atras.map((r) => r.cinta),
    filos,
    adelante: adelante.map((r) => r.cinta),
    huso,
    anchoFilo: P.halo * 2,
    rotacion: ROTACION_TRENZA,
  };
}

/* ------------------------------------------------------------------ movimiento ----------------------------------- */

/** Dos séptimos de vuelta cada 3,4 s: con siete hilos la forma se repite cada 1,7 s, así que el giro no tiene corte. */
export const GIRO_RAD_POR_MS = (TAU / 7) / 1700;
/** La cuerda se suelta y se vuelve a apretar en un ciclo propio, que no coincide con el giro. */
export const RESPIRACION_MS = 5200;
/** Entrada: de hilos rectos a cuerda. */
export const ENTRADA_MS = 1400;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Pose de giro continuo en el instante `t` (ms). En t = 0 es la pose quieta del logo. */
export function poseGiro(t: number): { m: number; om: number } {
  return { m: 0.86 + 0.14 * Math.cos((TAU * t) / RESPIRACION_MS), om: GIRO_RAD_POR_MS * t };
}

/**
 * Pose con entrada: los hilos pasan de rectos a cuerda mientras el giro acelera de forma pareja, y llegan a la
 * velocidad del giro justo al terminar la entrada (sin salto de posición ni de velocidad).
 */
export function poseConEntrada(t: number): { m: number; om: number } {
  if (t >= ENTRADA_MS) {
    const giro = poseGiro(t - ENTRADA_MS);
    return { m: giro.m, om: GIRO_RAD_POR_MS * (t - ENTRADA_MS / 2) };
  }
  const tt = Math.max(0, t);
  return { m: easeInOut(tt / ENTRADA_MS), om: (GIRO_RAD_POR_MS * tt * tt) / (2 * ENTRADA_MS) };
}

/**
 * Firma de arranque (selector de proyecto): la misma entrada, pero el giro termina exactamente en la pose quieta
 * —recorre dos séptimos de vuelta hacia atrás mientras se tuerce— y ahí se queda.
 */
export function poseFirma(t: number): { m: number; om: number; termino: boolean } {
  const p = Math.min(1, Math.max(0, t / ENTRADA_MS));
  const e = easeInOut(p);
  return { m: e, om: -((TAU * 2) / 7) * (1 - e), termino: p >= 1 };
}
