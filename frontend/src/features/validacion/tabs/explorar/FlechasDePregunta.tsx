import { ChevronLeft, ChevronRight } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";

/** Pregunta anterior y siguiente, a la derecha de la cabecera de la pregunta (también con las flechas del teclado). */
export default function FlechasDePregunta({
  posicion,
  total,
  anterior,
  siguiente,
  onAnterior,
  onSiguiente,
}: {
  posicion: number;
  total: number;
  anterior: string | null;
  siguiente: string | null;
  onAnterior?: () => void;
  onSiguiente?: () => void;
}) {
  const donde = posicion > 0 ? `, pregunta ${posicion} de ${total}` : "";
  return (
    <span className="vx-flechas">
      <PulsoButton
        variant="icon"
        size="sm"
        aria-label={anterior ? `Pregunta anterior: ${anterior}` : "Pregunta anterior"}
        title={anterior ? `Anterior: ${anterior} (←)${donde}` : `Ya estás en la primera pregunta${donde}`}
        disabled={!onAnterior}
        onClick={onAnterior}
      >
        <ChevronLeft size={14} aria-hidden />
      </PulsoButton>
      <PulsoButton
        variant="icon"
        size="sm"
        aria-label={siguiente ? `Pregunta siguiente: ${siguiente}` : "Pregunta siguiente"}
        title={siguiente ? `Siguiente: ${siguiente} (→)${donde}` : `Ya estás en la última pregunta${donde}`}
        disabled={!onSiguiente}
        onClick={onSiguiente}
      >
        <ChevronRight size={14} aria-hidden />
      </PulsoButton>
    </span>
  );
}
