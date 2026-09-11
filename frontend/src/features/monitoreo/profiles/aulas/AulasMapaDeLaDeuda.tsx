import type { ReactNode } from "react";

import { facultadCorta } from "./facultadEnPalabras";
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
const M = { arriba: 30, abajo: 62, izq: 74, der: 28 };
const UTIL = { an: AN - M.izq - M.der, al: AL - M.arriba - M.abajo };
const MARCAS = [-25, -5, 0, 5, 25];

const comprime = (v: number) => Math.sign(v) * Math.sqrt(Math.abs(v));
const MAX_C = comprime(TOPE);
const ejeX = (v: number) => M.izq + UTIL.an * ((comprime(v) + MAX_C) / (MAX_C * 2));
const ejeY = (v: number) => M.arriba + UTIL.al * (1 - (comprime(v) + MAX_C) / (MAX_C * 2));

type Caja = { x1: number; x2: number; y1: number; y2: number };
const chocan = (a: Caja, b: Caja) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
const ANCHO_LETRA = 5.6;
const ALTO_ETIQUETA = 12;

export function AulasMapaDeLaDeuda({ filas, onFacultad, enFoco = "" }: {
  filas: ReadonlyArray<DeudaDeFacultad>;
  /** Pulsar un punto abre esa facultad abajo: el mapa es el índice, no un adorno. */
  onFacultad?: (facultad: string) => void;
  /**
   * **La facultad elegida se destaca; las demás NO se van.**
   *
   * Gonzalo, 2026-09-10: «todo eso es robusto ante el filtro, porque puedes
   * tenerlo para todas las facultades, pero también puedes tenerlo para una
   * facultad en particular». Filtrar el mapa a una sola dejaría una burbuja
   * suelta en un plano vacío, que no compara nada: lo que hace útil este
   * gráfico es justamente dónde cae la tuya respecto de las otras. Así que con
   * una elegida se apagan las demás y la suya se marca con su anillo, que es
   * «para una en particular» sin perder el «respecto de todas».
   */
  enFoco?: string;
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
    const texto = facultadCorta(f.facultad);
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
    const suya = !!enFoco && f.facultad === enFoco;
    const apagada = !!enFoco && !suya;
    return (
      <g
        key={f.clave || f.facultad}
        className={`aulas-mapa-punto${suya ? " es-foco" : ""}${apagada ? " es-apagada" : ""}`}
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
        {/* El anillo de la elegida va DETRÁS de su burbuja y con su mismo tono:
            marca sin cambiarle el color, que aquí significa en qué sexo debe. */}
        {suya ? (
          <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={(r + 5).toFixed(1)}
            className="aulas-mapa-anillo" fill="none" stroke={tono} strokeWidth={1.2} />
        ) : null}
        {/* **El foco se marca con este halo, no con el `outline` del navegador.**
            Gonzalo, 2026-09-10: «este borde amarillo se ve fatal». Y lo era: el
            grupo lleva `role="button"` y `tabIndex`, así que el navegador le
            dibujaba su anillo alrededor del BOUNDING BOX del `<g>` entero —el
            círculo MÁS su etiqueta—, una cápsula amarilla de 300 px cruzando el
            gráfico. Un halo concéntrico dice lo mismo, señala el punto y no el
            rectángulo que lo contiene, y sigue siendo un indicador visible. */}
        <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={(r + 4).toFixed(1)}
          className="aulas-mapa-halo" fill="none" />
        <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={r.toFixed(1)} fill={tono}
          fillOpacity={suya ? 0.34 : 0.22} stroke={tono} strokeWidth={suya ? 2.2 : 1.6} />
        <text x={puesto.cx.toFixed(1)} y={puesto.cy.toFixed(1)} textAnchor={puesto.anchor}>{texto}</text>
      </g>
    );
  });

  return (
    <div className="aulas-mapa" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <svg className="aulas-mapa-lienzo" viewBox={`0 0 ${AN} ${AL}`} role="img"
        aria-label={`Deuda por sexo de las ${fmt(conCampo.length)} facultades con campo`}>
        {/* **El cuadrante que duele, teñido.** Gonzalo, 2026-09-10: «el eje de
            coordenadas no termina de verse bien». Lo que fallaba era el marco,
            no los puntos: los cuatro nombres de cuadrante vivían FUERA del área
            —dos arriba y dos abajo— y los de abajo caían encima de las marcas
            del eje y del rótulo, tres renglones de texto apilados donde debía
            haber uno. Y sin fondo, «arriba a la derecha es bueno» había que
            deducirlo leyendo cuatro rótulos.

            Ahora el cuadrante inferior izquierdo —el que debe en los dos— lleva
            un tinte de aviso, y las etiquetas se apoyan DENTRO, en sus esquinas,
            donde nunca hay puntos porque los puntos gravitan hacia el cero. */}
        <rect className="aulas-mapa-zona es-debe"
          x={M.izq} y={ejeY(0).toFixed(1)}
          width={(ejeX(0) - M.izq).toFixed(1)} height={(M.arriba + UTIL.al - ejeY(0)).toFixed(1)} />
        <rect className="aulas-mapa-zona es-bien"
          x={ejeX(0).toFixed(1)} y={M.arriba}
          width={(M.izq + UTIL.an - ejeX(0)).toFixed(1)} height={(ejeY(0) - M.arriba).toFixed(1)} />

        {MARCAS.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "aulas-mapa-cero" : "aulas-mapa-reja"}
              x1={ejeX(v).toFixed(1)} y1={M.arriba} x2={ejeX(v).toFixed(1)} y2={M.arriba + UTIL.al} />
            <line className={v === 0 ? "aulas-mapa-cero" : "aulas-mapa-reja"}
              x1={M.izq} y1={ejeY(v).toFixed(1)} x2={M.izq + UTIL.an} y2={ejeY(v).toFixed(1)} />
            <text className="aulas-mapa-marca" x={ejeX(v).toFixed(1)} y={M.arriba + UTIL.al + 15} textAnchor="middle">
              {v > 0 ? `+${v}` : v}
            </text>
            <text className="aulas-mapa-marca" x={M.izq - 8} y={(ejeY(v) + 3.5).toFixed(1)} textAnchor="end">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}

        {/* El marco del área, para que el gráfico tenga borde y no flote. */}
        <rect className="aulas-mapa-borde" x={M.izq} y={M.arriba} width={UTIL.an} height={UTIL.al} />

        {puntos}

        {/* **Los rótulos viven en los MÁRGENES, no dentro del área.**

            Gonzalo, 2026-09-10: «el gráfico de coordenadas tiene muchos
            márgenes a los lados […] hay cosas que están dentro de los ejes que
            se topan con los puntos por una cuestión de límites. Para no quitar
            espacio a los límites, muchas de las etiquetas pueden ir a los
            bordes o a los márgenes de una forma bastante elegante, y así
            asegurarnos que tampoco se vea completamente vacío en los márgenes».

            Las dos mitades de cada eje ya son la lectura de los cuadrantes —a
            la izquierda se debe, a la derecha sobra—, así que los cuatro
            rótulos de cuadrante se sustituyen por dos ejes con dirección. El
            texto sale del área, el margen deja de estar en blanco, y lo que
            antes eran cuatro etiquetas compitiendo con las burbujas son ahora
            dos renglones que nadie pisa. El cuadrante sigue distinguiéndose por
            su tinte, que no ocupa sitio. */}
        <text className="aulas-mapa-eje es-debe" x={M.izq} y={AL - 24}>← debe hombres</text>
        <text className="aulas-mapa-eje" x={M.izq + UTIL.an} y={AL - 24} textAnchor="end">
          va por encima →
        </text>
        <text className="aulas-mapa-eje es-titulo" x={M.izq + UTIL.an / 2} y={AL - 8} textAnchor="middle">
          HOMBRES
        </text>

        <text className="aulas-mapa-eje es-debe" x={22} y={M.arriba + UTIL.al} textAnchor="start"
          transform={`rotate(-90 22 ${M.arriba + UTIL.al})`}>
          ← debe mujeres
        </text>
        <text className="aulas-mapa-eje" x={22} y={M.arriba} textAnchor="end"
          transform={`rotate(-90 22 ${M.arriba})`}>
          va por encima →
        </text>
        <text className="aulas-mapa-eje es-titulo" x={11} y={M.arriba + UTIL.al / 2} textAnchor="middle"
          transform={`rotate(-90 11 ${M.arriba + UTIL.al / 2})`}>
          MUJERES
        </text>
      </svg>

      <p className="aulas-mapa-pie">
        La escala comprime los extremos para dar aire alrededor del cero, que es
        donde se decide. {onFacultad ? "Pulsa una facultad para ver qué la hundió." : null}
      </p>
    </div>
  );
}
