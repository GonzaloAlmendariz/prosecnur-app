import { PulsoButton } from "../../../components/PulsoButton";
import { FichaPregunta, type TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import { sinEnfasis } from "../../../lib/enfasisTexto";
import { TextoConEnfasis } from "../../../lib/TextoConEnfasis";
import { ArrowRight, ChevronLeft, ChevronRight } from "../../../vendor/lucide-react";
import { ROTULO_DE_TIPO, type TipoResultante } from "./tipoResultante";

export type CabeceraDePreguntaProps = {
  /** La columna que se codifica: el texto de un "Otro" o la pregunta abierta. */
  codigo: string;
  /** El tipo de esa columna en el formulario. */
  tipoOrigen: TipoDePregunta;
  /** El tipo de la columna que sale de codificarla y de dónde sale. */
  resultante: TipoResultante;
  /** La pregunta, con el énfasis del formulario. */
  etiqueta: string;
  /** Sección del formulario a la que pertenece. */
  seccion?: string;
  /** Etiqueta de la pregunta anterior y de la siguiente; vacío si no hay. */
  anterior: string;
  siguiente: string;
  onAnterior: () => void;
  onSiguiente: () => void;
};

/**
 * La pregunta que se codifica (`pp-preg-cab` del prototipo): su columna, la pregunta y, debajo, el tipo de
 * la columna, la flecha y el tipo que sale con su razón ("Igual que su pregunta D1"). Al final, el paso a
 * la anterior y a la siguiente.
 */
export function CabeceraDePregunta({ codigo, tipoOrigen, resultante, etiqueta, seccion, anterior, siguiente, onAnterior, onSiguiente }: CabeceraDePreguntaProps) {
  const plano = sinEnfasis(etiqueta);
  return (
    <header className="pulso-cc-pregunta">
      <code className="pulso-cc-pregunta-codigo">{codigo}</code>
      <div className="pulso-cc-pregunta-texto">
        <h2 className="pulso-cc-pregunta-titulo" title={seccion ? `${plano} (${seccion})` : plano}>
          <TextoConEnfasis texto={etiqueta} />
        </h2>
        <span className="pulso-cc-pregunta-tipo">
          <FichaPregunta tipo={tipoOrigen} etiqueta={ROTULO_DE_TIPO[tipoOrigen]} />
          <ArrowRight size={12} aria-label="sale como" />
          {resultante.tipo ? (
            <FichaPregunta tipo={resultante.tipo} etiqueta={resultante.rotulo} />
          ) : (
            <span className="pulso-cc-por-definir">{resultante.rotulo}</span>
          )}
          <span className="pulso-cc-pregunta-leyenda">{resultante.leyenda}</span>
        </span>
      </div>
      <span className="pulso-cc-pregunta-paso">
        <PulsoButton
          variant="icon"
          size="sm"
          disabled={!anterior}
          onClick={onAnterior}
          aria-label={anterior ? `Pregunta anterior: ${anterior}` : "Pregunta anterior"}
          title={anterior ? `Anterior: ${anterior}` : undefined}
        >
          <ChevronLeft aria-hidden="true" />
        </PulsoButton>
        <PulsoButton
          variant="icon"
          size="sm"
          disabled={!siguiente}
          onClick={onSiguiente}
          aria-label={siguiente ? `Pregunta siguiente: ${siguiente}` : "Pregunta siguiente"}
          title={siguiente ? `Siguiente: ${siguiente}` : undefined}
        >
          <ChevronRight aria-hidden="true" />
        </PulsoButton>
      </span>
    </header>
  );
}
