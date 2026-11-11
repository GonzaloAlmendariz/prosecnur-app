import { PulsoButton } from "../../../components/PulsoButton";
import { FichaPregunta, type TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import { sinEnfasis } from "../../../lib/enfasisTexto";
import { TextoConEnfasis } from "../../../lib/TextoConEnfasis";
import { ChevronLeft, ChevronRight } from "../../../vendor/lucide-react";

export type CabeceraDePreguntaProps = {
  /** Nombre de la variable en el formulario. */
  codigo: string;
  tipo: TipoDePregunta;
  /** Cómo se codifica: "Texto abierto", "Opción única, texto aparte". */
  rotuloDeTipo: string;
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
 * La identidad de la pregunta en una línea: su variable con el color de su tipo, cómo se codifica, la
 * pregunta y, al final, el paso a la anterior y a la siguiente. La pregunta completa va en el `title`.
 */
export function CabeceraDePregunta({ codigo, tipo, rotuloDeTipo, etiqueta, seccion, anterior, siguiente, onAnterior, onSiguiente }: CabeceraDePreguntaProps) {
  const plano = sinEnfasis(etiqueta);
  return (
    <header className="pulso-cc-pregunta">
      <FichaPregunta tipo={tipo} codigo={codigo} etiqueta={rotuloDeTipo} className="pulso-cc-pregunta-ficha" />
      <h2 className="pulso-cc-pregunta-titulo" title={seccion ? `${plano} (${seccion})` : plano}>
        <TextoConEnfasis texto={etiqueta} />
      </h2>
      <span className="pulso-cc-pregunta-paso">
        <PulsoButton
          variant="icon"
          tone="framed"
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
          tone="framed"
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
