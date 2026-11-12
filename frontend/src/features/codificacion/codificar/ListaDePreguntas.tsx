import { useLayoutEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import { arquetipoOf, type PreguntaAbierta } from "../../../api/codificacion";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { sinEnfasis } from "../../../lib/enfasisTexto";
import { formatoConteo } from "../../../lib/formatoNumero";
import { TextoConEnfasis } from "../../../lib/TextoConEnfasis";
import { origenDeLista, tipoResultanteDeLista } from "./tipoResultante";

export type ListaDePreguntasProps = {
  preguntas: readonly PreguntaAbierta[];
  /** `parent` de la pregunta que se está codificando. */
  activa: string | null;
  etiquetaDe: (pregunta: PreguntaAbierta) => string;
  onElegir: (parent: string) => void;
  /**
   * El avance de cada pregunta en respuestas con código, el mismo del anillo de Preguntas (`avanceStore.ts`): en una pareja cuenta
   * los textos distintos del texto que aporta las respuestas, no los de la pregunta cerrada.
   */
  avanceDe: (pregunta: PreguntaAbierta) => { porcentaje: number; codificadas: number; total: number } | null;
  /**
   * El desplazamiento de la lista, guardado por la pestaña: al cambiar de pregunta la mesa se vuelve a
   * montar y la lista vuelve a donde estaba en vez de al principio.
   */
  posicion?: MutableRefObject<number>;
};

/** Mueve lo justo el contenedor para que el elemento quede a la vista. */
function dejarALaVista(cuerpo: HTMLElement, elemento: HTMLElement) {
  const c = cuerpo.getBoundingClientRect();
  const e = elemento.getBoundingClientRect();
  if (e.top < c.top) cuerpo.scrollTop -= c.top - e.top;
  else if (e.bottom > c.bottom) cuerpo.scrollTop += e.bottom - c.bottom;
}

/**
 * Las preguntas incluidas en la codificación, en el orden del formulario (`colaCod` del prototipo): la
 * pregunta, su avance en porcentaje y en barra, el tipo de la columna que sale y de dónde viene. El avance
 * cuenta textos distintos con código sobre los textos distintos, la misma base de "respuestas con código"
 * en la cabecera. Va dentro del contenedor "Preguntas" de la mesa, que es el dueño del desplazamiento.
 */
export function ListaDePreguntas({ preguntas, activa, etiquetaDe, onElegir, avanceDe, posicion }: ListaDePreguntasProps) {
  const lista = useRef<HTMLUListElement | null>(null);

  // El dueño del desplazamiento es el cuerpo del contenedor (PanelDeMesa): se le devuelve la posición
  // guardada, se deja a la vista la pregunta elegida y cada desplazamiento se vuelve a guardar.
  useLayoutEffect(() => {
    const cuerpo = lista.current?.closest<HTMLElement>(".pulso-panel-de-mesa-cuerpo");
    if (!cuerpo || !posicion) return undefined;
    cuerpo.scrollTop = posicion.current;
    const elegida = lista.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (elegida) dejarALaVista(cuerpo, elegida);
    const guardar = () => {
      posicion.current = cuerpo.scrollTop;
    };
    guardar();
    cuerpo.addEventListener("scroll", guardar, { passive: true });
    return () => cuerpo.removeEventListener("scroll", guardar);
  }, [posicion, activa]);

  return (
    // C1: una fila por pregunta; cada una mide lo que su etiqueta (una o dos líneas).
    <ul ref={lista} className="pulso-cc-preguntas-lista" data-qa-geometry-group="codificacion/preguntas-codificar" data-qa-geometry-contract="intrinsic">
      {preguntas.map((p) => {
        const etiqueta = etiquetaDe(p);
        const arquetipo = arquetipoOf(p);
        const resultante = tipoResultanteDeLista(p, arquetipo);
        const avance = avanceDe(p);
        const esActiva = p.parent === activa;
        const detalleAvance = avance
          ? `${formatoConteo(avance.codificadas)} de ${formatoConteo(avance.total)} ${avance.total === 1 ? "respuesta" : "respuestas"} con código`
          : "Sin respuestas";
        return (
          <li key={p.parent} data-qa-geometry-member="">
            <button
              type="button"
              className="pulso-cc-preguntas-fila"
              onClick={() => onElegir(p.parent)}
              aria-current={esActiva ? "true" : undefined}
              title={`${sinEnfasis(etiqueta)} (${p.parent}). ${detalleAvance}`}
            >
              <span className="pulso-cc-preguntas-etiqueta">
                <TextoConEnfasis texto={etiqueta} />
              </span>
              <span className="pulso-cc-preguntas-pct" data-completa={avance?.porcentaje === 100 ? "" : undefined}>
                {avance ? `${avance.porcentaje} %` : null}
              </span>
              <span className="pulso-cc-preguntas-tipo">
                {resultante?.tipo ? (
                  <FichaPregunta tipo={resultante.tipo} etiqueta={resultante.rotulo} className="pulso-cc-preguntas-ficha" />
                ) : resultante ? (
                  <span className="pulso-cc-por-definir">{resultante.rotulo}</span>
                ) : null}
                <span className="pulso-cc-preguntas-origen">{origenDeLista(p, arquetipo)}</span>
              </span>
              <span className="pulso-cc-preguntas-barra" aria-hidden="true" data-completa={avance?.porcentaje === 100 ? "" : undefined}>
                <span style={{ "--cc-avance": String((avance?.porcentaje ?? 0) / 100) } as CSSProperties} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
