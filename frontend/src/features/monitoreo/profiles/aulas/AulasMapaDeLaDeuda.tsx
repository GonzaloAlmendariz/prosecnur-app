import type { ReactNode } from "react";

import { fmt } from "./kpisDeAulas";
import type { DeudaDeFacultad } from "./deudaPorFacultad";
import "./aulasMapaDeLaDeuda.css";

/**
 * Un punto por facultad: lo que debe en hombres contra lo que debe en mujeres.
 *
 * Gonzalo, 2026-09-10: «no siempre es que le esté yendo mal a nivel general,
 * sino le puede estar yendo mal en un sexo en particular».
 *
 * **Los cuadrantes son la lectura.** Arriba a la derecha, las que van por
 * encima en los dos; abajo a la izquierda, las que deben en los dos; y las dos
 * franjas de los lados son justo el caso que la cifra global esconde: ir bien
 * en un sexo y mal en el otro. Un relevo ahí sólo sirve si trae el que falta.
 *
 * **La escala es de raíz cuadrada con signo**, y se declara al pie. Comprime los
 * extremos —en el corte del 10 de setiembre una facultad va +48 y otra debe 4—
 * para dar aire alrededor del cero, que es donde se decide. A escala lineal, la
 * mitad que importa cabría en un centímetro.
 */
const TOPE = 50;
const AN = 560, AL = 430;
const M = { arriba: 40, abajo: 50, izq: 56, der: 30 };
const UTIL = { an: AN - M.izq - M.der, al: AL - M.arriba - M.abajo };
const MARCAS = [-25, -5, 0, 5, 25];

const comprime = (v: number) => Math.sign(v) * Math.sqrt(Math.abs(v));
const MAX_C = comprime(TOPE);
const ejeX = (v: number) => M.izq + UTIL.an * ((comprime(v) + MAX_C) / (MAX_C * 2));
const ejeY = (v: number) => M.arriba + UTIL.al * (1 - (comprime(v) + MAX_C) / (MAX_C * 2));

/** Los nombres largos no caben sin pisarse; se acortan por su forma conocida. */
function corto(n: string): string {
  return n
    .replace(/^ESTUDIOS GENERALES /i, "EE.GG. ")
    .replace(/CIENCIAS Y ARTES DE LA COMUN.*/i, "CC. y Artes Com.")
    .replace(/GASTRONOM[IÍ]A.*/i, "Gastronomía")
    .replace(/GESTI[OÓ]N Y ALTA DIRECCI[OÓ]N/i, "Gestión")
    .replace(/LETRAS Y CIENCIAS HUMANAS/i, "Letras y CC.HH.")
    .replace(/ARQUITECTURA Y URBANISMO/i, "Arquitectura")
    .replace(/CIENCIAS E INGENIER[IÍ]A/i, "CC. e Ingeniería");
}

type Caja = { x1: number; x2: number; y1: number; y2: number };
const chocan = (a: Caja, b: Caja) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
const ANCHO_LETRA = 5.3;
const ALTO_ETIQUETA = 12;

export function AulasMapaDeLaDeuda({ filas, onFacultad }: {
  filas: ReadonlyArray<DeudaDeFacultad>;
  /** Pulsar un punto abre esa facultad abajo: el mapa es el índice, no un adorno. */
  onFacultad?: (facultad: string) => void;
}): ReactNode {
  const conCampo = filas.filter((f) => f.veredicto !== "sin_campo");
  if (conCampo.length < 2) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        Hacen falta al menos dos facultades con campo para comparar su deuda; hoy
        hay {fmt(conCampo.length)}.
      </p>
    );
  }

  /**
   * **Las etiquetas no se pisan.** Cada una prueba ocho posiciones alrededor de
   * su punto y se queda con la primera libre; si se aleja, sale un hilo hasta su
   * punto para no perder de quién es. Las de los extremos colocan primero,
   * porque son las que menos sitio tienen para moverse.
   */
  const ocupadas: Caja[] = [];
  const orden = [...conCampo].sort(
    (a, b) => (Math.abs(b.mujeres) + Math.abs(b.hombres)) - (Math.abs(a.mujeres) + Math.abs(a.hombres)),
  );

  const puntos = orden.map((f) => {
    const debeM = f.mujeres < 0, debeH = f.hombres < 0;
    const tono = debeM && debeH ? "var(--pulso-danger-fg)"
      : (debeM || debeH) ? "var(--pulso-warn-accent)"
      : "var(--pulso-success-fg)";
    const r = 4 + Math.min(6, Math.sqrt(f.aulas) * 1.6);
    const px = ejeX(f.hombres), py = ejeY(f.mujeres);
    const texto = corto(f.facultad);
    const an = texto.length * ANCHO_LETRA;

    const sitios = [
      { dx: r + 6, dy: 3.6, anchor: "start" as const },
      { dx: -(r + 6), dy: 3.6, anchor: "end" as const },
      { dx: 0, dy: -(r + 7), anchor: "middle" as const },
      { dx: 0, dy: r + 14, anchor: "middle" as const },
      { dx: r + 6, dy: -(r + 5), anchor: "start" as const },
      { dx: -(r + 6), dy: -(r + 5), anchor: "end" as const },
      { dx: r + 6, dy: r + 13, anchor: "start" as const },
      { dx: -(r + 6), dy: r + 13, anchor: "end" as const },
    ];

    let puesto: { dx: number; dy: number; anchor: "start" | "end" | "middle"; cx: number; cy: number; caja: Caja } | null = null;
    for (const s of sitios) {
      const cx = px + s.dx, cy = py + s.dy;
      const x1 = s.anchor === "start" ? cx : s.anchor === "end" ? cx - an : cx - an / 2;
      const caja: Caja = { x1, x2: x1 + an, y1: cy - ALTO_ETIQUETA + 3, y2: cy + 3 };
      const dentro = caja.x1 > 4 && caja.x2 < AN - 4 && caja.y1 > 6 && caja.y2 < AL - 30;
      if (dentro && !ocupadas.some((o) => chocan(caja, o))) { puesto = { ...s, cx, cy, caja }; break; }
    }
    if (!puesto) {
      let cy = py + r + 14;
      for (let i = 0; i < 14; i += 1) {
        const caja: Caja = { x1: px + r + 6, x2: px + r + 6 + an, y1: cy - ALTO_ETIQUETA + 3, y2: cy + 3 };
        if (caja.y2 < AL - 30 && !ocupadas.some((o) => chocan(caja, o))) {
          puesto = { dx: r + 6, dy: cy - py, anchor: "start", cx: px + r + 6, cy, caja };
          break;
        }
        cy += ALTO_ETIQUETA + 2;
      }
    }
    if (!puesto) return null;
    ocupadas.push(puesto.caja);
    const lejos = Math.abs(puesto.dy) > r + 16;

    const signo = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : "0");
    return (
      <g
        key={f.clave || f.facultad}
        className="aulas-mapa-punto"
        role={onFacultad ? "button" : "img"}
        tabIndex={onFacultad ? 0 : undefined}
        aria-label={`${f.facultad}: ${signo(f.mujeres)} en mujeres, ${signo(f.hombres)} en hombres.${onFacultad ? " Abre su detalle." : ""}`}
        onClick={() => onFacultad?.(f.facultad)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFacultad?.(f.facultad); }
        }}
      >
        <title>
          {f.facultad} · {fmt(f.aulas)} aplicados · {signo(f.mujeres)} mujeres · {signo(f.hombres)} hombres
        </title>
        {lejos ? (
          <line
            x1={px.toFixed(1)} y1={py.toFixed(1)}
            x2={(puesto.anchor === "end" ? puesto.cx + 3 : puesto.cx - 3).toFixed(1)}
            y2={(puesto.cy - 3.4).toFixed(1)}
            className="aulas-mapa-hilo"
          />
        ) : null}
        <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={r.toFixed(1)} fill={tono} fillOpacity={0.22} stroke={tono} strokeWidth={1.6} />
        <text x={puesto.cx.toFixed(1)} y={puesto.cy.toFixed(1)} textAnchor={puesto.anchor}>{texto}</text>
      </g>
    );
  });

  return (
    <div className="aulas-mapa" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <svg className="aulas-mapa-lienzo" viewBox={`0 0 ${AN} ${AL}`} role="img"
        aria-label={`Deuda por sexo de las ${fmt(conCampo.length)} facultades con campo`}>
        {MARCAS.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "aulas-mapa-cero" : "aulas-mapa-reja"}
              x1={ejeX(v).toFixed(1)} y1={M.arriba} x2={ejeX(v).toFixed(1)} y2={M.arriba + UTIL.al} />
            <line className={v === 0 ? "aulas-mapa-cero" : "aulas-mapa-reja"}
              x1={M.izq} y1={ejeY(v).toFixed(1)} x2={M.izq + UTIL.an} y2={ejeY(v).toFixed(1)} />
            <text className="aulas-mapa-marca" x={ejeX(v).toFixed(1)} y={M.arriba + UTIL.al + 16} textAnchor="middle">
              {v > 0 ? `+${v}` : v}
            </text>
            <text className="aulas-mapa-marca" x={M.izq - 9} y={(ejeY(v) + 3.5).toFixed(1)} textAnchor="end">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}

        {/* Los nombres de cuadrante van FUERA del área de puntos: dentro chocan
            con la facultad que más lejos llega, que es la que más se quiere leer. */}
        <text className="aulas-mapa-cuadrante" x={M.izq} y={M.arriba - 14}>debe hombres</text>
        <text className="aulas-mapa-cuadrante" x={M.izq + UTIL.an} y={M.arriba - 14} textAnchor="end">por encima en los dos</text>
        <text className="aulas-mapa-cuadrante" x={M.izq} y={M.arriba + UTIL.al + 32}>debe en los dos</text>
        <text className="aulas-mapa-cuadrante" x={M.izq + UTIL.an} y={M.arriba + UTIL.al + 32} textAnchor="end">debe mujeres</text>

        {puntos}

        <text className="aulas-mapa-marca" x={M.izq + UTIL.an / 2} y={AL - 6} textAnchor="middle">
          respuestas de más o de menos · HOMBRES
        </text>
        <text className="aulas-mapa-marca" x={16} y={M.arriba + UTIL.al / 2} textAnchor="middle"
          transform={`rotate(-90 16 ${M.arriba + UTIL.al / 2})`}>
          respuestas · MUJERES
        </text>
      </svg>

      <p className="aulas-mapa-pie">
        La escala comprime los extremos para dar aire alrededor del cero, que es
        donde se decide. {onFacultad ? "Pulsa una facultad para ver qué la hundió." : null}
      </p>
    </div>
  );
}
