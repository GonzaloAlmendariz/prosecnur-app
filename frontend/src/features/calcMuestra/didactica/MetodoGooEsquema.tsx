/**
 * Mini-goo ilustrativos de la pestaña Método (iteración 2026-08-07).
 *
 * Distinción conceptual CONGELADA: aquí NO hay selección — cada loop es un
 * ESQUEMA DEL MECANISMO con un dataset ilustrativo CONSTANTE (posiciones y
 * tamaños fijos, deterministas; cero azar), y lo declara visible: «esquema
 * ilustrativo · no son aulas reales» (C1). No viola el ADR 0067 porque no
 * finge ser una corrida; el relato de la corrida real vive en la pestaña
 * Relato, a la que la tarjeta enlaza cuando la selección existe.
 *
 * La animación es CSS en loop (~5.6 s); con `prefers-reduced-motion` el CSS
 * apaga los keyframes y queda el CUADRO FINAL (los estilos base codifican el
 * estado resuelto de cada mecanismo), con la misma declaración.
 *
 * Las CONEXIONES son la esencia del lenguaje (corrección 2026-08-07): cada
 * esquema muestra su estructura ATÁNDOSE con tirantes visibles. La topología
 * se pre-computa de los datasets constantes con las primitivas del relato
 * (`vecinasMasCercanas`/`membranaGoo`) y se exporta como constante testeable.
 */
import {
  membranaGoo,
  vecinasMasCercanas,
} from "../universidad/aulas/relato/escenas/goo";
import "./metodoGooEsquema.css";

export type MetodoGooId =
  | "sistematico_pps"
  | "cube_balanceado"
  | "local_pivotal_balanceado"
  | "pool_controlado";

type RolBola =
  | "sorteada"
  | "estructura"
  | "resto"
  | "descontada"
  | "repelida"
  | "gemela"
  | "ganadora"
  | "perdedora";

type GooBolaEsquema = {
  /** Posición inicial del loop (candidata) y final (resuelta), en unidades del viewBox. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  rol: RolBola;
};

/** Rol visual del tirante: cómo nace y si sobrevive al resolverse el loop. */
export type RolTirante = "estructura" | "snap" | "red" | "ganador" | "perdedor";

export type GooTiranteEsquema = {
  /** Índices de las bolas que ata, sobre el dataset del esquema. */
  de: number;
  a: number;
  rol: RolTirante;
};

type MetodoGooEsquemaDef = {
  aria: string;
  bolas: GooBolaEsquema[];
  tirantes: GooTiranteEsquema[];
  /** Mini-barras de balance (fracción final 0–1); solo cube/pivotal. */
  barras?: number[];
  /** Aro del cluster ganador; solo pool. */
  anillo?: { x: number; y: number; r: number };
};

/** Bola quieta (mecanismos sin desplazamiento): destino = origen. */
function quieta(x: number, y: number, r: number, rol: RolBola): GooBolaEsquema {
  return { x0: x, y0: y, x1: x, y1: y, r, rol };
}

/**
 * Red de tirantes de un subconjunto de bolas: cada una se ata a sus DOS
 * vecinas más cercanas del layout FINAL (misma topología que el relato).
 * Pre-computada de constantes: determinista, sin física en runtime.
 */
function redDeTirantes(
  indices: number[],
  bolas: GooBolaEsquema[],
  rol: RolTirante,
): GooTiranteEsquema[] {
  const posiciones = indices.map((i) => ({ x: bolas[i].x1, y: bolas[i].y1 }));
  const tirantes: GooTiranteEsquema[] = [];
  indices.forEach((_, k) => {
    for (const vecina of vecinasMasCercanas(k, posiciones)) {
      tirantes.push({ de: indices[vecina], a: indices[k], rol });
    }
  });
  return tirantes;
}

/**
 * Dataset ilustrativo CONSTANTE de los cuatro mecanismos. Nada aquí es un
 * aula real ni sale de una corrida: son coordenadas fijas elegidas para que
 * el loop cuente el mecanismo (grandes más probables, ensamblaje simultáneo,
 * repulsión de gemelas, clusters candidatos en paralelo).
 */
/** PPS: una estructura ya atada arriba y la recta de candidatas abajo; la
 *  bola grande seleccionada VIAJA y se ATA con 2 tirantes visibles. */
const PPS_BOLAS: GooBolaEsquema[] = [
  quieta(20, 14, 4.5, "estructura"),
  quieta(31, 11, 5.5, "estructura"),
  quieta(25, 23, 4, "estructura"),
  { x0: 63, y0: 48, x1: 36, y1: 20, r: 6.5, rol: "sorteada" },
  quieta(9, 48, 3.5, "resto"),
  quieta(25, 48, 5, "resto"),
  quieta(41, 48, 4, "resto"),
  quieta(80, 48, 7.5, "descontada"),
  quieta(93, 48, 4, "resto"),
];

/** Los 2 tirantes con los que la viajera se ata: vecinas del layout final. */
const PPS_TIRANTES_SNAP: GooTiranteEsquema[] = vecinasMasCercanas(
  3,
  [0, 1, 2, 3].map((i) => ({ x: PPS_BOLAS[i].x1, y: PPS_BOLAS[i].y1 })),
).map((vecina) => ({ de: vecina, a: 3, rol: "snap" as const }));

const CUBE_BOLAS: GooBolaEsquema[] = [
  { x0: 8, y0: 10, x1: 24, y1: 22, r: 6, rol: "sorteada" },
  { x0: 50, y0: 8, x1: 36, y1: 23, r: 4.5, rol: "sorteada" },
  { x0: 14, y0: 50, x1: 22, y1: 34, r: 5, rol: "sorteada" },
  { x0: 44, y0: 52, x1: 34, y1: 37, r: 6.5, rol: "sorteada" },
  { x0: 30, y0: 30, x1: 29, y1: 29, r: 3.5, rol: "sorteada" },
  { x0: 55, y0: 30, x1: 43, y1: 30, r: 4, rol: "sorteada" },
  quieta(8, 30, 3.5, "resto"),
  quieta(52, 44, 3, "resto"),
  quieta(46, 16, 4, "resto"),
  quieta(26, 8, 3, "resto"),
];

const PIVOTAL_BOLAS: GooBolaEsquema[] = [
  { x0: 8, y0: 10, x1: 24, y1: 22, r: 6, rol: "sorteada" },
  { x0: 50, y0: 8, x1: 36, y1: 23, r: 4.5, rol: "sorteada" },
  { x0: 14, y0: 50, x1: 22, y1: 34, r: 5, rol: "sorteada" },
  { x0: 44, y0: 52, x1: 34, y1: 37, r: 6.5, rol: "sorteada" },
  // Las gemelas: casi idénticas y vecinas; una entra, la otra sale repelida.
  { x0: 47, y0: 27, x1: 43, y1: 30, r: 4, rol: "gemela" },
  { x0: 52, y0: 30, x1: 88, y1: 10, r: 4, rol: "repelida" },
  quieta(8, 30, 3.5, "resto"),
  quieta(52, 44, 3, "resto"),
  quieta(26, 8, 3, "resto"),
];

const POOL_BOLAS: GooBolaEsquema[] = [
  // Cluster A (pierde)
  quieta(14, 24, 4.5, "perdedora"),
  quieta(23, 27, 3.5, "perdedora"),
  quieta(16, 34, 3, "perdedora"),
  quieta(25, 36, 4, "perdedora"),
  // Cluster B (gana: mejor cobertura)
  quieta(47, 22, 5.5, "ganadora"),
  quieta(57, 26, 4, "ganadora"),
  quieta(48, 34, 4.5, "ganadora"),
  quieta(58, 37, 3.5, "ganadora"),
  // Cluster C (pierde)
  quieta(81, 24, 4, "perdedora"),
  quieta(90, 28, 3.5, "perdedora"),
  quieta(83, 35, 4.5, "perdedora"),
  quieta(91, 38, 3, "perdedora"),
];

export const METODO_GOO_ESQUEMAS: Record<MetodoGooId, MetodoGooEsquemaDef> = {
  sistematico_pps: {
    aria:
      "Esquema ilustrativo de Sistemático por facultad: las aulas ordenadas en una recta, y una elegida cada cierto salto fijo. Las aulas con más alumnos se dibujan más grandes.",
    bolas: PPS_BOLAS,
    tirantes: [
      ...redDeTirantes([0, 1, 2], PPS_BOLAS, "estructura"),
      // La seleccionada SE ATA: preview punteado → snap sólido vibrante.
      ...PPS_TIRANTES_SNAP,
    ],
  },
  cube_balanceado: {
    aria:
      "Esquema ilustrativo de Balance por cuotas y tamaño: las aulas elegidas forman un grupo cuyo reparto se parece al del marco. Las barras muestran cuánto se parece en cada variable. No son aulas reales.",
    bolas: CUBE_BOLAS,
    // La RED completa nace en cascada rapidísima al resolverse (rol "red").
    tirantes: redDeTirantes([0, 1, 2, 3, 4, 5], CUBE_BOLAS, "red"),
    barras: [0.64, 0.52, 0.76],
  },
  local_pivotal_balanceado: {
    aria:
      "Esquema ilustrativo de Balance + dispersión: hace lo mismo que el balanceado y además, de dos aulas casi idénticas, elige una sola para no amontonar la muestra. No son aulas reales.",
    bolas: PIVOTAL_BOLAS,
    // La gemela aceptada (índice 4) entra a la red; la repelida (5) NO tiene
    // tirante: ese contraste ES el mecanismo.
    tirantes: redDeTirantes([0, 1, 2, 3, 4], PIVOTAL_BOLAS, "red"),
    barras: [0.64, 0.52, 0.76],
  },
  pool_controlado: {
    aria:
      "Esquema ilustrativo de Optimizar repetidos: varios grupos de aulas candidatos, de los que se conserva el que menos estudiantes repite entre aulas. No son aulas reales.",
    bolas: POOL_BOLAS,
    tirantes: [
      ...redDeTirantes([0, 1, 2, 3], POOL_BOLAS, "perdedor"),
      ...redDeTirantes([4, 5, 6, 7], POOL_BOLAS, "ganador"),
      ...redDeTirantes([8, 9, 10, 11], POOL_BOLAS, "perdedor"),
    ],
    anillo: { x: 52.5, y: 29.5, r: 13.5 },
  },
};

/** La declaración C1 de estos esquemas; visible siempre, también en estático. */
export const METODO_GOO_DECLARACION = "esquema ilustrativo · no son aulas reales";

/**
 * Qué representa cada elemento del dibujo.
 *
 * El esquema traía descripción, pero sólo en `aria-label`: quien lo MIRA no la
 * lee, y lo que ve son bolas negras de tamaños distintos unidas por hilos.
 * Gonzalo, 2026-08-22: «elementos no diagramados de explicación ilustrativa».
 * Un dibujo sin leyenda es decoración; con leyenda es un diagrama. Los cuatro
 * esquemas usan el mismo vocabulario visual, así que la leyenda es una sola.
 */
export const METODO_GOO_LEYENDA =
  "Cada bola es un aula y su tamaño son los alumnos que tiene. Los hilos unen las aulas que el método mira juntas al decidir.";

export function MetodoGooEsquema({
  metodo,
  leyenda = true,
}: {
  metodo: MetodoGooId;
  /**
   * Los cuatro esquemas comparten vocabulario visual, así que en una grilla que
   * los muestra juntos la leyenda se dice UNA vez sobre la grilla y no cuatro
   * veces, una por tarjeta. Suelto —un esquema solo, en otra superficie— la
   * leyenda viaja con él.
   */
  leyenda?: boolean;
}) {
  const esquema = METODO_GOO_ESQUEMAS[metodo];
  return (
    <figure className={`cmv2-mgoo is-${metodo}`}>
      <svg className="cmv2-mgoo-lienzo" viewBox="0 0 100 62" role="img" aria-label={esquema.aria}>
        {metodo === "sistematico_pps" && (
          <line className="cmv2-mgoo-recta" x1="3" y1="48" x2="97" y2="48" />
        )}
        {esquema.anillo && (
          <circle
            className="cmv2-mgoo-anillo-ganador"
            cx={esquema.anillo.x}
            cy={esquema.anillo.y}
            r={esquema.anillo.r}
          />
        )}
        {/* Los tirantes: la estructura se ve ATÁNDOSE. Topología constante
            pre-computada (misma primitiva de vecinas del relato). */}
        {esquema.tirantes.map((tirante, index) => {
          const de = esquema.bolas[tirante.de];
          const a = esquema.bolas[tirante.a];
          const membrana = membranaGoo(
            { x: de.x1, y: de.y1, r: de.r },
            { x: a.x1, y: a.y1, r: a.r },
          );
          return (
            <path
              key={`tirante-${tirante.de}-${tirante.a}`}
              className={`cmv2-mgoo-tirante is-${tirante.rol}`}
              d={membrana.d}
              style={{
                strokeWidth: (membrana.grosor * 0.55).toFixed(2),
                ["--tir-i" as string]: String(index),
              }}
            />
          );
        })}
        {esquema.bolas.map((bola, index) => (
          <g
            key={index}
            className={`cmv2-mgoo-bola is-${bola.rol}`}
            style={{
              ["--gx0" as string]: `${bola.x0}px`,
              ["--gy0" as string]: `${bola.y0}px`,
              ["--gx1" as string]: `${bola.x1}px`,
              ["--gy1" as string]: `${bola.y1}px`,
              ["--mgoo-i" as string]: String(index),
            }}
          >
            <circle className="cmv2-mgoo-cuerpo" r={bola.r} />
            {bola.rol === "sorteada" && (
              <circle className="cmv2-mgoo-halo" r={bola.r + 1.6} />
            )}
          </g>
        ))}
        {esquema.barras && (
          <g className="cmv2-mgoo-barras">
            {esquema.barras.map((fraccion, index) => (
              <g key={index} transform={`translate(62 ${16 + index * 11})`}>
                <rect className="cmv2-mgoo-barra-pista" width="34" height="5" rx="2.5" />
                <rect
                  className="cmv2-mgoo-barra-valor"
                  width="34"
                  height="5"
                  rx="2.5"
                  style={{ ["--mgoo-fill" as string]: String(fraccion) }}
                />
              </g>
            ))}
          </g>
        )}
      </svg>
      <figcaption className="cmv2-mgoo-declaracion">
        {leyenda && <span className="cmv2-mgoo-leyenda">{METODO_GOO_LEYENDA}</span>}
        <span className="cmv2-mgoo-marca">{METODO_GOO_DECLARACION}</span>
      </figcaption>
    </figure>
  );
}
