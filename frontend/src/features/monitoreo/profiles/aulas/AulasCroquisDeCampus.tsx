/**
 * B32 — el croquis del campus en pantalla: el hermano del verso de la ficha.
 *
 * SVG propio (nada de bitmaps ajenos) con los 21 pabellones en su posición
 * real, las cinco puertas y los hitos de orientación; el pabellón del venue
 * se resalta con anillo y relleno pleno. Acepta venues de DOS pabellones
 * («H404 · A608», 73 casos reales en ULT2): resalta ambos — cualquiera de los
 * dos según el horario — y lo que no tiene edificio lo DICE en el pie, igual
 * que el subtítulo impreso del verso.
 *
 * El color de cada letra es del Sistema Pabellón (`tonoDePabellon` +
 * clases `es-tono-*` sobre tokens): papel y pantalla, mismo tono.
 */

import "./aulasCroquisDeCampus.css";

import {
  BORDE_CAMPUS,
  CROQUIS_ALTO,
  CROQUIS_ANCHO,
  HITOS_CAMPUS,
  PABELLONES_CAMPUS,
  PUERTAS_CAMPUS,
  letrasDeVenue,
  lugaresDeVenue,
  proyectar,
} from "./croquisDeCampus";
import { letraDePabellon, tonoDePabellon } from "./sistemaPabellon";

const LADO_CHIP = 44;

export interface AulasCroquisDeCampusProps {
  /** El aula de la cita, tal como viene del plan («A206», «H404 · A608»). */
  lugarResaltado?: string | null;
}

export function AulasCroquisDeCampus({ lugarResaltado }: AulasCroquisDeCampusProps) {
  const lugares = lugaresDeVenue(lugarResaltado);
  const letras = letrasDeVenue(lugarResaltado);
  const existentes = new Set(PABELLONES_CAMPUS.map((p) => p.letra));
  const resaltadas = new Set(letras.filter((l) => existentes.has(l)));
  // Lo que no tiene edificio se declara, no se elige en silencio (paridad con
  // el «(TAMB fuera del croquis)» del verso impreso).
  const fuera = lugares.filter((lg) => {
    const letra = letraDePabellon(lg);
    return letra.length > 0 && !existentes.has(letra);
  });

  const borde = BORDE_CAMPUS.map(({ lat, lng }) => {
    const { x, y } = proyectar(lat, lng);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <figure className="aulas-croquis">
      <svg
        viewBox={`-8 -8 ${CROQUIS_ANCHO + 16} ${CROQUIS_ALTO + 16}`}
        role="img"
        aria-label={
          resaltadas.size
            ? `Croquis del campus PUCP con el pabellón ${[...resaltadas].join(" y ")} resaltado`
            : "Croquis del campus PUCP"
        }
      >
        <polygon className="aulas-croquis-terreno" points={borde} />

        {PUERTAS_CAMPUS.map((puerta) => {
          const { x, y } = proyectar(puerta.lat, puerta.lng);
          const dx = puerta.lado === "este" ? 14 : puerta.lado === "oeste" ? -14 : 0;
          const dy = puerta.lado === "norte" ? -16 : 4;
          const anchor = puerta.lado === "este" ? "start" : puerta.lado === "oeste" ? "end" : "middle";
          return (
            <g key={puerta.nombre} className="aulas-croquis-puerta">
              <rect x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`} />
              <text x={x + dx} y={y + dy} textAnchor={anchor}>
                {puerta.nombre}
              </text>
            </g>
          );
        })}

        {HITOS_CAMPUS.map((hito) => {
          const { x, y } = proyectar(hito.lat, hito.lng);
          return (
            <text key={hito.nombre} className="aulas-croquis-hito" x={x} y={y} textAnchor="middle">
              {hito.nombre}
            </text>
          );
        })}

        {PABELLONES_CAMPUS.map((p) => {
          const { x, y } = proyectar(p.lat, p.lng);
          const tono = tonoDePabellon(p.letra);
          const resaltado = resaltadas.has(p.letra);
          const aulas = lugares.filter((lg) => letraDePabellon(lg) === p.letra);
          const clase = [
            "aulas-croquis-pabellon",
            tono === null ? "" : `es-tono-${tono}`,
            resaltado ? "es-resaltado" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={p.letra} className={clase}>
              <title>
                {resaltado && aulas.length
                  ? `Pabellón ${p.letra} — aula ${aulas.join(" · ")}`
                  : `Pabellón ${p.letra}`}
              </title>
              {resaltado ? <circle className="aulas-croquis-anillo" cx={x} cy={y} r={LADO_CHIP * 0.92} /> : null}
              <rect
                className="aulas-croquis-caja"
                x={x - LADO_CHIP / 2}
                y={y - LADO_CHIP / 2}
                width={LADO_CHIP}
                height={LADO_CHIP}
                rx={8}
              />
              <text className="aulas-croquis-letra" x={x} y={y} textAnchor="middle" dominantBaseline="central">
                {p.letra}
              </text>
            </g>
          );
        })}
      </svg>
      {lugares.length ? (
        // Los códigos van en el pie, no flotando junto al chip: a tamaño de
        // panel una etiqueta suelta siempre acaba pisando al vecino (medido:
        // «Z111» sobre el chip de H). El anillo señala el edificio; el pie
        // dice el aula — y con dos pabellones, que vale cualquiera según el
        // horario. Lo sin edificio se declara, como en el verso impreso.
        <figcaption className="aulas-croquis-nota">
          {[...resaltadas]
            .map((letra) => {
              const aulas = lugares.filter((lg) => letraDePabellon(lg) === letra);
              return aulas.length ? `Pabellón ${letra} (${aulas.join(" · ")})` : `Pabellón ${letra}`;
            })
            .join(" o ")}
          {resaltadas.size > 1 ? " — según el horario" : ""}
          {fuera.length ? `${resaltadas.size ? " — " : ""}${fuera.join(" · ")} fuera del croquis` : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
