import { Link2 } from "../../../vendor/lucide-react";

export type LazoUnidadProps = {
  /** `unido`: las dos preguntas ya son pareja. `suelto`: aquí se suelta la otra, o se pulsa para elegirla. */
  forma: "unido" | "suelto";
  /** La pareja se acaba de formar: el nodo se asienta una vez. */
  reciente?: boolean;
  /** Solo en el nodo suelto: lo que hace al pulsarlo y su nombre para el lector de pantalla. */
  onPulsar?: () => void;
  rotulo?: string;
};

/**
 * El nodo de una unidad. Entre las dos fichas de una pareja es un dibujo; en una suelta es el sitio
 * punteado donde se suelta la otra pregunta, y también un botón que abre el selector para elegirla.
 * No es parada del tabulador: con teclado se empareja desde el inspector.
 */
export function LazoUnidad({ forma, reciente = false, onPulsar, rotulo }: LazoUnidadProps) {
  if (onPulsar) {
    return (
      <button type="button" className="pulso-preg-lazo" data-lazo={forma} tabIndex={-1} aria-label={rotulo} title="Emparejar con" onClick={onPulsar}>
        <Link2 size={14} aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className="pulso-preg-lazo" data-lazo={forma} data-reciente={reciente ? "" : undefined} aria-hidden="true">
      <Link2 size={14} />
    </span>
  );
}
