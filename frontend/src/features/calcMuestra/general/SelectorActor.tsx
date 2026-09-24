import type { ReactNode } from "react";
import { CheckCircle2, Circle, CircleSlash2, FileSpreadsheet, History, Loader2 } from "lucide-react";

import type { EstadoDelActor, FaseDelActor, TecnicaDelActor } from "./actores";
import "./general.css";

export type ActorDelSelector = {
  id: string;
  nombre: string;
  tecnica: TecnicaDelActor;
  estado: EstadoDelActor;
  /** Tiene un marco declarado, se sortee o no. */
  conMarco: boolean;
};

const ICONO_FASE: Record<FaseDelActor, ReactNode> = {
  leyendo: <Loader2 size={13} className="pulso-spin" aria-hidden="true" />,
  sin_sorteo: <CircleSlash2 size={13} aria-hidden="true" />,
  sin_marco: <Circle size={13} aria-hidden="true" />,
  marco: <FileSpreadsheet size={13} aria-hidden="true" />,
  sorteado: <CheckCircle2 size={13} aria-hidden="true" />,
  sorteo_viejo: <History size={13} aria-hidden="true" />,
};

/** Id del bloque de trabajo que el selector controla. */
export const ID_TRABAJO_DEL_ACTOR = "cmg-actor-trabajo";

/**
 * Acreditación › Selección: la lista de actores con su técnica en palabras y
 * el estado de su marco y su sorteo. Elegir uno lo pone en foco; el foco lo
 * escribe quien monta el selector (en la dirección, no aquí).
 */
export function SelectorActor({
  actores,
  activoId,
  onElegir,
}: {
  actores: readonly ActorDelSelector[];
  activoId: string | null;
  onElegir: (id: string) => void;
}) {
  return (
    <section className="cmv2-panel cmg-actores" aria-labelledby="cmg-actores-titulo" data-qa-geometry-member>
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Actores</span>
          <h3 className="cmg-panel-titulo" id="cmg-actores-titulo">Marco y sorteo por actor</h3>
        </div>
      </div>
      <ul
        className="cmg-actores-lista"
        aria-label="Actores del estudio"
        data-qa-geometry-group="calc-muestra/acreditacion-actores"
        data-qa-geometry-contract="equal"
      >
        {actores.map((actor) => {
          const activo = actor.id === activoId;
          return (
            <li key={actor.id} className="cmg-actores-item" data-qa-geometry-member>
              <button
                type="button"
                className={`cmg-actor${activo ? " is-active" : ""}`}
                aria-pressed={activo}
                aria-controls={ID_TRABAJO_DEL_ACTOR}
                data-actor={actor.id}
                onClick={() => onElegir(actor.id)}
              >
                <strong className="cmg-actor-nombre">{actor.nombre}</strong>
                <span className={`cmg-actor-tecnica cmg-actor-tecnica--${actor.tecnica.clase}`}>
                  {actor.tecnica.etiqueta}
                </span>
                <span className="cmg-actor-pie">
                  <span className={`cmg-actor-estado cmg-actor-estado--${actor.estado.fase}`}>
                    {ICONO_FASE[actor.estado.fase]}
                    {actor.estado.etiqueta}
                  </span>
                  {actor.estado.detalle && <span className="cmg-actor-cifra">{actor.estado.detalle}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
