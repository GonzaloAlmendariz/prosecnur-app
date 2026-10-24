// Composición de una lámina dibujada en vivo desde las ranuras del estándar (F6.2; dirección F6 §4.3 y §6). Acepta los
// gráficos de la lámina actual por slot y los dibuja acomodados en la composición («así quedaría»). Las láminas de
// estructura (portada, índice, separador, cierre…) se dibujan con su variante. La lámina real, rasterizada por el
// motor, es la del visor; esto explica el tipo.

import { useId } from "react";
import { CuerpoGlifo } from "./GlifoGrafico";
import { GLIFO, type OpcionesGlifo } from "./glifosGrafico";
import { composicionDe, LAMINA_PULGADAS, numeroDeRanura, type RanuraComposicion } from "./composicion";
import { Cabecera, DibujoEstructura } from "./dibujosEstructura";
import type { DatosEstructura } from "../laminas/maqueta/datosEstructura";
import "./composicionLamina.css";

export type ComposicionLaminaProps = {
  /** `p_slide_*` del registro. */
  tipo: string;
  /** Slots de gráfico del tipo (`SLIDE_GRAF_SLOTS`), en el orden que numera las ranuras. */
  slots: readonly string[];
  /** Graficador que llena cada slot (`null` o ausente: ranura vacía). */
  graficos?: Readonly<Record<string, string | null | undefined>>;
  /** Lo que cada gráfico refleja de sus ajustes (por slot; ver `opcionesDeComposicion`); sin él, el dibujo del catálogo. */
  opciones?: Readonly<Record<string, OpcionesGlifo>>;
  /** Variante de las láminas de estructura (portada, índice, separador, cierre). */
  variante?: string | null;
  /** Ranura resaltada (1-based, la de `foco=<slide.id>:gK`). */
  ranuraActiva?: number | null;
  /** Numera las ranuras (vista de detalle; en miniatura no se lee). */
  numerar?: boolean;
  /** Con título: `role="img"` y nombre accesible; sin él, decorativa. */
  titulo?: string;
  className?: string;
  /** Sólo la maqueta del editor: el texto real de la lámina de estructura (título, capítulos, actores…). */
  datos?: Partial<DatosEstructura>;
};

const INSET = 0.1;

function Ranura({ r, k, grafico, opciones, activa, numerar }: {
  r: RanuraComposicion;
  opciones?: OpcionesGlifo;
  k: number | null;
  grafico: string | null;
  activa: boolean;
  numerar: boolean;
}) {
  if (r.tipo === "texto") {
    const renglones = Math.max(1, Math.min(6, Math.floor((r.h - 0.2) / 0.34)));
    return (
      <g className="pulso-composicion__texto">
        <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.06} className="pulso-composicion__narrativa" />
        {Array.from({ length: renglones }, (_, i) => (
          <rect
            key={i}
            x={r.x + 0.18}
            y={r.y + 0.2 + i * 0.34}
            width={Math.max(0.4, (r.w - 0.36) * (i === renglones - 1 && renglones > 1 ? 0.62 : 1))}
            height={0.12}
            rx={0.06}
            className="pulso-composicion__suave"
          />
        ))}
      </g>
    );
  }
  const vacia = !grafico;
  const clase = [
    "pulso-composicion__ranura",
    r.tipo === "cifras" ? "is-cifras" : "",
    vacia ? "is-vacia" : "",
    activa ? "is-activa" : "",
  ].filter(Boolean).join(" ");
  const alto = Math.min(0.46, r.h * 0.42);
  return (
    <g data-ranura={k ?? undefined}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.08} className={clase} />
      {grafico && (
        <svg
          x={r.x + INSET}
          y={r.y + INSET}
          width={Math.max(0, r.w - 2 * INSET)}
          height={Math.max(0, r.h - 2 * INSET)}
          viewBox={`0 0 ${GLIFO.w} ${GLIFO.h}`}
          preserveAspectRatio="xMidYMid meet"
          className={`pulso-glifo-anidado${activa ? " is-activa" : ""}`}
        >
          <CuerpoGlifo tipo={grafico} opciones={opciones} />
        </svg>
      )}
      {!grafico && r.tipo === "cifras" && (
        <>
          <rect x={r.x + r.w / 2 - Math.min(0.8, r.w * 0.32)} y={r.y + r.h / 2 - alto / 2 - 0.1} width={Math.min(1.6, r.w * 0.64)} height={alto} rx={0.06} className="pulso-composicion__cifra" />
          <rect x={r.x + r.w / 2 - Math.min(0.6, r.w * 0.24)} y={r.y + r.h / 2 + alto / 2 + 0.02} width={Math.min(1.2, r.w * 0.48)} height={0.1} rx={0.05} className="pulso-composicion__suave" />
        </>
      )}
      {numerar && k !== null && (
        <g className="pulso-composicion__numero" aria-hidden="true">
          <circle cx={r.x + 0.3} cy={r.y + 0.3} r={0.22} />
          <text x={r.x + 0.3} y={r.y + 0.39} fontSize={0.26} textAnchor="middle">{k}</text>
        </g>
      )}
    </g>
  );
}

export function ComposicionLamina({
  tipo, slots, graficos = {}, opciones, variante = null, ranuraActiva = null, numerar = false, titulo, className, datos,
}: ComposicionLaminaProps): JSX.Element {
  const idTitulo = useId();
  const comp = composicionDe(tipo, slots);
  const estructura = comp.fuente === "estructura";
  return (
    <svg
      viewBox={`0 0 ${LAMINA_PULGADAS.w} ${LAMINA_PULGADAS.h}`}
      className={["pulso-composicion", className].filter(Boolean).join(" ")}
      data-composicion-tipo={tipo}
      data-composicion-fuente={comp.fuente}
      data-composicion-variante={variante ?? undefined}
      role={titulo ? "img" : undefined}
      aria-labelledby={titulo ? idTitulo : undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title id={idTitulo}>{titulo}</title>}
      <rect x={0} y={0} width={LAMINA_PULGADAS.w} height={LAMINA_PULGADAS.h} className="pulso-composicion__papel" />
      {estructura ? (
        <DibujoEstructura tipo={tipo} variante={variante} datos={datos} />
      ) : (
        <>
          <Cabecera />
          {comp.poblacion && <circle cx={12.45} cy={0.82} r={0.32} className="pulso-composicion__acento" />}
          {comp.ranuras.map((r, i) => {
            const k = numeroDeRanura(slots, r.slot);
            return (
              <Ranura
                key={`${r.tipo}-${i}`}
                r={r}
                k={k}
                grafico={r.slot ? graficos[r.slot] ?? null : null}
                opciones={r.slot ? opciones?.[r.slot] : undefined}
                activa={k !== null && k === ranuraActiva}
                numerar={numerar}
              />
            );
          })}
          <rect x={0.495} y={6.72} width={3.2} height={0.11} rx={0.055} className="pulso-composicion__suave" />
        </>
      )}
    </svg>
  );
}
