import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { CheckCircle2, Inbox, Search } from "../../../vendor/lucide-react";

/** Por qué no hay respuestas a la vista. */
export type MotivoSinRespuestas = "sin-respuestas" | "sin-coincidencias" | "todas-con-codigo";

/**
 * El vacío de la lista de respuestas, dentro de su propio marco (que llega al pie del panel). Lo usan
 * la vista de tarjetas y la de tabla.
 */
export function SinRespuestas({ motivo, onVerTodas }: { motivo: MotivoSinRespuestas; onVerTodas: () => void }) {
  return (
    <div className="pulso-cc-lista-marco" data-qa-geometry-capacity="owned">
      {motivo === "sin-respuestas" ? (
        <EstadoVacio tamano="normal" icono={<Inbox size={18} />} titulo="Esta pregunta no tiene respuestas" />
      ) : motivo === "sin-coincidencias" ? (
        <EstadoVacio tamano="normal" icono={<Search size={18} />} titulo="No hay respuestas que coincidan" />
      ) : (
        <EstadoVacio
          tamano="normal"
          icono={<CheckCircle2 size={18} />}
          titulo="Todas las respuestas tienen código"
          accion={<PulsoButton variant="secondary" size="sm" onClick={onVerTodas}>Ver todas</PulsoButton>}
        />
      )}
    </div>
  );
}
