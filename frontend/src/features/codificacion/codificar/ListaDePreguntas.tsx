import type { PreguntaAbierta, PreguntaStatus } from "../../../api/codificacion";
import { EstadoChip } from "../../../components/EstadoChip";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { sinEnfasis } from "../../../lib/enfasisTexto";
import { formatoConteo } from "../../../lib/formatoNumero";
import { TextoConEnfasis } from "../../../lib/TextoConEnfasis";
import { ArrowLeft } from "../../../vendor/lucide-react";
import { tipoDeFicha } from "../preguntas/modeloUnidades";

export type ListaDePreguntasProps = {
  preguntas: readonly PreguntaAbierta[];
  /** `parent` de la pregunta que se está codificando. */
  activa: string | null;
  etiquetaDe: (pregunta: PreguntaAbierta) => string;
  onElegir: (parent: string) => void;
  onVolver: () => void;
};

type TonoDeEstado = "success" | "info" | "neutral" | "warn";

function estadoDe(status: PreguntaStatus): { rotulo: string; tono: TonoDeEstado } {
  if (status === "completo") return { rotulo: "Codificada", tono: "success" };
  if (status === "en-curso") return { rotulo: "En curso", tono: "info" };
  if (status === "sin-datos") return { rotulo: "Sin datos", tono: "neutral" };
  return { rotulo: "Pendiente", tono: "warn" };
}

/**
 * Las preguntas incluidas en la codificación, en el orden del formulario. El cuerpo es el dueño del
 * desplazamiento; el pie lleva la vuelta a la pestaña donde se eligen.
 */
export function ListaDePreguntas({ preguntas, activa, etiquetaDe, onElegir, onVolver }: ListaDePreguntasProps) {
  return (
    <Panel noPadding className="pulso-cc-panel pulso-cc-preguntas" aria-label="Preguntas para codificar">
      <div className="pulso-cc-panel-cab">
        <h3 className="pulso-cc-panel-titulo">Preguntas</h3>
        <span className="pulso-cc-cuenta" title={preguntas.length === 1 ? "1 pregunta para codificar" : `${formatoConteo(preguntas.length)} preguntas para codificar`}>
          {formatoConteo(preguntas.length)}
        </span>
      </div>
      {/* C1: una fila por pregunta; mide lo que su etiqueta. */}
      <ul className="pulso-cc-preguntas-lista" data-qa-geometry-group="codificacion/preguntas-codificar" data-qa-geometry-contract="intrinsic" data-qa-geometry-capacity="owned">
        {preguntas.map((p) => {
          const etiqueta = etiquetaDe(p);
          const estado = estadoDe(p.status);
          const esActiva = p.parent === activa;
          return (
            <li key={p.parent} data-qa-geometry-member="">
              <button
                type="button"
                className="pulso-cc-preguntas-fila"
                onClick={() => onElegir(p.parent)}
                aria-current={esActiva ? "true" : undefined}
                title={`${sinEnfasis(etiqueta)} (${p.parent})`}
              >
                <span className="pulso-cc-preguntas-meta">
                  <FichaPregunta tipo={tipoDeFicha(p.tipo)} etiqueta={p.parent} className="pulso-cc-preguntas-codigo" />
                  <EstadoChip label={estado.rotulo} tone={estado.tono} />
                </span>
                <span className="pulso-cc-preguntas-etiqueta">
                  <TextoConEnfasis texto={etiqueta} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="pulso-cc-panel-pie">
        <PulsoButton variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft size={13} aria-hidden="true" />
          Volver a Preguntas
        </PulsoButton>
      </div>
    </Panel>
  );
}
