// Dibujo de un gráfico de barras apiladas en la maqueta, bloque por bloque (Gonzalo 2026-10-11: «cuando tengo dos
// bloques donde uno usa Top Two Box y el otro no, hay que ser robustos a esas posibilidades»). Cada pregunta dibuja sus
// barras con los colores de SUS respuestas y, sólo si ese bloque la tiene, su columna Top Two Box. Respuestas sin color
// salen rayadas, igual que en Identidad. Mismo espacio 160 × 100 que el glifo genérico.

import { useId } from "react";
import { GLIFO } from "../iconos/glifosGrafico";
import { esRespuestaResidual } from "../estilo/modeloColoresRespuestas";
import type { PreguntaMaqueta } from "./modeloMaqueta";
import "../iconos/glifoGrafico.css";

/** Pesos fijos y decrecientes: la forma de una barra apilada típica, sin inventar cifras. */
const PESOS = [0.32, 0.26, 0.18, 0.12, 0.08, 0.06, 0.05, 0.04];
const MAX_BLOQUES = 4;

function anchos(n: number, total: number): number[] {
  const p = PESOS.slice(0, Math.max(1, n));
  while (p.length < n) p.push(0.04);
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => (x / s) * total);
}

/** La columna Top Two Box se pinta con la respuesta más alta de la escala (la última sustantiva con color). */
function colorTop(b: PreguntaMaqueta): string {
  const sust = b.opciones.filter((o) => o.color && !esRespuestaResidual(o.rotulo));
  return sust[sust.length - 1]?.color ?? "var(--glifo-principal)";
}

export function DibujoBloques({ preguntas, className }: { preguntas: readonly PreguntaMaqueta[]; className?: string }) {
  const rayado = useId().replace(/:/g, "");
  const bloques = preguntas.slice(0, MAX_BLOQUES);
  const conColumna = bloques.some((b) => b.ttb);
  const x0 = 34;
  const xFin = conColumna ? 128 : 152;
  const alto = (GLIFO.h - 8) / bloques.length;
  const barras = bloques.length === 1 ? 4 : bloques.length === 2 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${GLIFO.w} ${GLIFO.h}`} className={["pulso-glifo", className].filter(Boolean).join(" ")} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={rayado} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--glifo-papel)" />
          <rect width="1.2" height="4" fill="var(--glifo-neutro)" />
        </pattern>
      </defs>
      {bloques.map((b, i) => {
        const y = 4 + i * alto;
        const hBarra = Math.min(9, (alto - 6) / barras - 2);
        const n = Math.max(1, b.opciones.length);
        return (
          <g key={i}>
            {bloques.length > 1 && i > 0 ? <line x1={6} x2={154} y1={y - 1} y2={y - 1} className="pulso-glifo__rejilla" strokeDasharray="2 2" /> : null}
            {Array.from({ length: barras }, (_, j) => {
              const yb = y + 3 + j * (hBarra + 2.5);
              const ws = anchos(n, xFin - x0).map((w, k) => w * (1 + ((j + k) % 3 - 1) * 0.12));
              const escala = (xFin - x0) / ws.reduce((a, c) => a + c, 0);
              let x = x0;
              return (
                <g key={j}>
                  <rect x={6} y={yb + hBarra / 2 - 1.5} width={22} height={3} rx={1.5} style={{ fill: "var(--glifo-neutro)" }} />
                  {ws.map((w0, k) => {
                    const w = w0 * escala;
                    const color = b.opciones[k]?.color;
                    const r = <rect key={k} x={x} y={yb} width={Math.max(0.5, w - 0.8)} height={hBarra} rx={0.8} style={{ fill: color ?? `url(#${rayado})` }} />;
                    x += w;
                    return r;
                  })}
                  {b.ttb ? (
                    <g>
                      <rect x={134} y={yb} width={20} height={hBarra} rx={1.2} className="pulso-glifo__ttb" />
                      <rect x={136} y={yb + hBarra * 0.25} width={16 * (0.55 + 0.1 * ((j + i) % 3))} height={hBarra * 0.5} rx={0.6} style={{ fill: colorTop(b) }} />
                    </g>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
