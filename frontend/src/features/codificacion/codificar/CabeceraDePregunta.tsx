import type { ReactNode } from "react";
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

/** Una pieza de la frase del tipo: una ficha o la flecha. El aire alrededor de su dibujo es suyo (C3). */
function Pieza({ children }: { children: ReactNode }) {
  return <span className="pulso-cc-pieza" data-qa-geometry-member="" data-qa-geometry-capacity="owned">{children}</span>;
}

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
        {/* C1: las piezas de una frase (tipo de la columna, flecha, tipo resultante y su razón), no pares: cada una mide lo suyo. */}
        <span className="pulso-cc-pregunta-tipo" data-qa-geometry-group="codificacion/pregunta-tipos" data-qa-geometry-contract="intrinsic">
          <Pieza><FichaPregunta tipo={tipoOrigen} etiqueta={ROTULO_DE_TIPO[tipoOrigen]} /></Pieza>
          <Pieza><ArrowRight size={12} aria-label="sale como" /></Pieza>
          {resultante.tipo ? (
            <Pieza><FichaPregunta tipo={resultante.tipo} etiqueta={resultante.rotulo} /></Pieza>
          ) : (
            <span className="pulso-cc-por-definir" data-qa-geometry-member="">{resultante.rotulo}</span>
          )}
          <span className="pulso-cc-pregunta-leyenda" data-qa-geometry-member="">{resultante.leyenda}</span>
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
