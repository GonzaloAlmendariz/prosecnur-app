// La ficha visual de una ranura en la maqueta (contrato M1–M8): dibuja la escena de `geometriaFicha` en un SVG con las
// pulgadas de la ranura como unidad. Los íconos son los de la app (IconoTipo); los tipos que no son barras apiladas usan su
// glifo (glifosGrafico). Las barras transitan por su clave (M8).

import { useMemo } from "react";
import { CuerpoGlifo } from "../../iconos/GlifoGrafico";
import { dibujoGrafico, PRESET_DICOTOMICA } from "../../iconos/iconosGrafico";
import type { FichaInfo } from "./fichaModelo";
import { escenaFicha, type Pieza } from "./geometriaFicha";
import "../../iconos/glifoGrafico.css";
import "../../iconos/iconoTipo.css";
import "./fichaRanura.css";

type Props = { info: FichaInfo; w: number; h: number; clave: string };

export function FichaRanura({ info, w, h, clave }: Props) {
  const escena = useMemo(() => escenaFicha(info, w, h, clave), [info, w, h, clave]);
  const icono = info.tipo === "Dicotómica" ? PRESET_DICOTOMICA : info.graficador;
  return (
    <svg className="pulso-ficha" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"
      data-ficha-nivel={escena.nivel} data-ficha-horizontal={escena.horizontal ? "true" : undefined}>
      {escena.piezas.map((p, i) => <PiezaFicha key={p.tipo === "barra" ? p.clave : `${p.tipo}-${i}`} p={p} icono={icono} graficador={info.graficador} />)}
    </svg>
  );
}

function PiezaFicha({ p, icono, graficador }: { p: Pieza; icono: string | null; graficador: string | null }) {
  switch (p.tipo) {
    case "cabecera": {
      const dibujo = icono ? dibujoGrafico(icono) : null;
      return (
        <g className="pulso-ficha-cabecera">
          <rect className="pulso-ficha-icono-fondo" x={p.x} y={p.y} width={p.lado} height={p.lado} rx={p.fs * 0.3} />
          {dibujo && (
            <svg className="pulso-icono-tipo pulso-ficha-icono" x={p.x + p.lado * 0.14} y={p.y + p.lado * 0.14} width={p.lado * 0.72} height={p.lado * 0.72} viewBox="0 0 24 24" fill="none">
              {dibujo()}
            </svg>
          )}
          <text className="pulso-ficha-tipo" x={p.x + p.lado + p.fs * 0.4} y={p.y + p.fs * 0.98} fontSize={p.fs}>{p.texto}</text>
        </g>
      );
    }
    case "texto":
      return <text className={p.estilo === "pregunta" ? "pulso-ficha-pregunta" : "pulso-ficha-suave"} x={p.x} y={p.y} fontSize={p.fs}>{p.texto}</text>;
    case "chip":
      return (
        <g className={`pulso-ficha-chip is-${p.tono}`}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.h / 2} />
          <text x={p.x + p.fs * 0.6} y={p.y + p.h * 0.68} fontSize={p.fs}>{p.texto}</text>
        </g>
      );
    case "leyenda":
      return (
        <g className={`pulso-ficha-leyenda is-${p.modo}`}>
          <rect className="pulso-ficha-leyenda-caja" x={p.x} y={p.y} width={p.w} height={p.h} rx={p.fs * 0.5} />
          {p.titulo && (
            <text className="pulso-ficha-leyenda-titulo" x={p.x + p.fs * 0.62} y={p.modo === "linea" ? p.y + p.h * 0.66 : p.y + p.fs * 1.55} fontSize={p.fs}>{p.titulo}</text>
          )}
          {p.items.map((it, k) => (
            <g key={k}>
              <rect x={it.x} y={it.y} width={it.lado} height={it.lado} rx={it.lado * 0.2} style={{ fill: it.color }} />
              {it.texto && <text className="pulso-ficha-leyenda-texto" x={it.x + it.lado + 0.06} y={it.y + it.lado * 0.85} fontSize={p.fs}>{it.texto}</text>}
            </g>
          ))}
        </g>
      );
    case "barra":
      return (
        <rect className={`pulso-ficha-barra is-${p.rol}`} rx={p.rol === "segmento" ? 0.02 : p.h / 2}
          style={{ x: p.x, y: p.y, width: p.w, height: p.h, ...(p.rol === "segmento" ? { fill: p.color } : {}) }} />
      );
    case "separador":
      return <line className="pulso-ficha-separador" x1={p.x1} x2={p.x2} y1={p.y} y2={p.y} />;
    case "glifo":
      return (
        <svg className={`pulso-glifo pulso-ficha-glifo${p.tenue ? " is-tenue" : ""}`} x={p.x} y={p.y} width={p.w} height={p.h} viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
          {graficador ? <CuerpoGlifo tipo={graficador} /> : null}
        </svg>
      );
    case "vacia":
      return <text className="pulso-ficha-vacia" x={p.x} y={p.y} fontSize={p.fs} textAnchor="middle">+ {p.texto}</text>;
    default:
      return null;
  }
}
