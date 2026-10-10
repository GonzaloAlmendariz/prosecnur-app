// Primitivas de dibujo de los íconos por tipo (F6.1b). Todo en `currentColor`; el único color que cambia con el
// contexto entra por el grupo `.pulso-icono-tipo__acento` (iconoTipo.css lo pinta con `--icono-acento`). Regla de
// acento único: cada ícono tiene exactamente un grupo de acento, que agrupa UN rasgo (marco, punto de población,
// cifras, ranura activa o la categoría mayor de un gráfico).

import type { ReactNode } from "react";
import { MARCO, PUNTO_POBLACION, RASGO_MINIMO, TITULO, TONO, type RanuraIcono } from "./geometriaLamina";

const TRAZO = RASGO_MINIMO;

export function Acento({ children }: { children: ReactNode }): JSX.Element {
  return <g className="pulso-icono-tipo__acento">{children}</g>;
}

type Tono = keyof typeof TONO | "pleno";
const opacidad = (tono: Tono): number | undefined => (tono === "pleno" ? undefined : TONO[tono]);

export function Bloque({ x, y, w, h, tono = "lleno", rx = 0.75 }: {
  x: number; y: number; w: number; h: number; tono?: Tono; rx?: number;
}): JSX.Element {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" fillOpacity={opacidad(tono)} />;
}

/** Trazo redondeado. `d` en coordenadas del viewBox 24. */
export function Trazo({ d, tono = "apoyo", ancho = TRAZO }: { d: string; tono?: Tono; ancho?: number }): JSX.Element {
  return (
    <path d={d} fill="none" stroke="currentColor" strokeOpacity={opacidad(tono)} strokeWidth={ancho}
      strokeLinecap="round" strokeLinejoin="round" />
  );
}

export function Circulo({ cx, cy, r, tono = "pleno", hueco = false }: {
  cx: number; cy: number; r: number; tono?: Tono; hueco?: boolean;
}): JSX.Element {
  return hueco
    ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={opacidad(tono)} strokeWidth={TRAZO} />
    : <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={opacidad(tono)} />;
}

export function Marco({ acento = false, lleno = false }: { acento?: boolean; lleno?: boolean }): JSX.Element {
  const borde = (
    <rect x={MARCO.x} y={MARCO.y} width={MARCO.w} height={MARCO.h} rx={MARCO.rx}
      fill="none" stroke="currentColor" strokeWidth={TRAZO} />
  );
  return (
    <>
      {lleno && <Bloque x={MARCO.x} y={MARCO.y} w={MARCO.w} h={MARCO.h} rx={MARCO.rx} />}
      {acento ? <Acento>{borde}</Acento> : borde}
    </>
  );
}

export function LineaTitulo(): JSX.Element {
  return <Trazo d={`M${TITULO.x0} ${TITULO.y}H${TITULO.x1}`} />;
}

export function PuntoPoblacion(): JSX.Element {
  return <Circulo cx={PUNTO_POBLACION.cx} cy={PUNTO_POBLACION.cy} r={PUNTO_POBLACION.r} />;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Ranura de texto: renglones de apoyo; el último más corto. */
export function LineasTexto({ r }: { r: RanuraIcono }): JSX.Element {
  const renglones: string[] = [];
  const paso = 2.25;
  const x0 = r.x + 0.75;
  const ancho = r.w - 1.5;
  const n = Math.max(1, Math.floor((r.h - 1.5) / paso) + 1);
  for (let i = 0; i < n; i += 1) {
    const y = r.y + 0.75 + i * paso;
    const largo = n === 1 ? ancho * 0.7 : i === n - 1 ? ancho * 0.6 : ancho;
    renglones.push(`M${r3(x0)} ${r3(y)}H${r3(x0 + Math.max(0, largo))}`);
  }
  return <Trazo d={renglones.join("")} />;
}

/** Ranura de cifras: tres cifras como trazos cortos, en fila si la ranura es ancha y apiladas si es alta. */
export function trazoCifras(r: RanuraIcono): string {
  const tramos: string[] = [];
  if (r.w >= r.h) {
    const hueco = 2;
    const ancho = (r.w - 2 * hueco) / 3;
    const y = r.y + r.h / 2;
    for (let i = 0; i < 3; i += 1) {
      const x = r.x + 0.75 + i * (ancho + hueco);
      tramos.push(`M${r3(x)} ${r3(y)}H${r3(x + ancho - 1.5)}`);
    }
  } else {
    const paso = (r.h - 1.5) / 2;
    for (let i = 0; i < 3; i += 1) {
      const y = r.y + 0.75 + i * paso;
      tramos.push(`M${r3(r.x + 0.75)} ${r3(y)}H${r3(r.x + r.w - 0.75)}`);
    }
  }
  return tramos.join("");
}

export function Cifras({ r, acento }: { r: RanuraIcono; acento: boolean }): JSX.Element {
  const trazo = <Trazo d={trazoCifras(r)} tono={acento ? "pleno" : "apoyo"} />;
  return acento ? <Acento>{trazo}</Acento> : trazo;
}

/** Ranura punteada del tipo desconocido. */
export function RanuraPunteada(): JSX.Element {
  return (
    <rect x={6} y={9.75} width={12} height={7.5} rx={0.75} fill="none" stroke="currentColor"
      strokeOpacity={TONO.apoyo} strokeWidth={TRAZO} strokeDasharray="1.5 1.5" />
  );
}
