import { ChevronDown, ChevronUp, List, Search } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";

/**
 * E12 — al cruzar, la lista de variables se pliega en un riel: desplegarla,
 * buscar, anterior/siguiente y la posición («14/94»). Es navegación, no
 * pestañas: los botones dicen a dónde van, sin roles de tab.
 */
export default function RielVariables({
  posicion,
  total,
  onDesplegar,
  onBuscar,
  onAnterior,
  onSiguiente,
  nombreAnterior,
  nombreSiguiente,
}: {
  posicion: number;
  total: number;
  onDesplegar: () => void;
  onBuscar: () => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  nombreAnterior: string | null;
  nombreSiguiente: string | null;
}) {
  return (
    <nav className="vx-tarjeta vx-riel" aria-label="Variables, lista plegada">
      <PulsoButton variant="icon" aria-label="Desplegar la lista de variables" title="Desplegar la lista" onClick={onDesplegar}>
        <List size={16} aria-hidden />
      </PulsoButton>
      <PulsoButton variant="icon" aria-label="Buscar variable" title="Buscar variable" onClick={onBuscar}>
        <Search size={16} aria-hidden />
      </PulsoButton>
      <span className="vx-riel-sep" aria-hidden />
      <PulsoButton
        variant="icon"
        aria-label={nombreAnterior ? `Variable anterior: ${nombreAnterior}` : "Variable anterior"}
        title={nombreAnterior ? `Anterior: ${nombreAnterior} (←)` : "Ya estás en la primera variable"}
        disabled={!onAnterior}
        onClick={onAnterior}
      >
        <ChevronUp size={16} aria-hidden />
      </PulsoButton>
      <span className="vx-riel-pos vx-mono" aria-label={`Variable ${posicion} de ${total}`}>
        {posicion}/{total}
      </span>
      <PulsoButton
        variant="icon"
        aria-label={nombreSiguiente ? `Variable siguiente: ${nombreSiguiente}` : "Variable siguiente"}
        title={nombreSiguiente ? `Siguiente: ${nombreSiguiente} (→)` : "Ya estás en la última variable"}
        disabled={!onSiguiente}
        onClick={onSiguiente}
      >
        <ChevronDown size={16} aria-hidden />
      </PulsoButton>
    </nav>
  );
}
