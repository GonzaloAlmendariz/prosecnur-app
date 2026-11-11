import { nombreDeAtajo } from "../../../lib/teclado";
import { ArrowDown, ArrowUp } from "../../../vendor/lucide-react";

/** Las teclas de la lista de respuestas, en una línea. Con poco alto se oculta (lo decide la hoja). */
export function AyudaDeTeclas({ id, permiteVarios }: { id: string; permiteVarios: boolean }) {
  return (
    <p id={id} className="pulso-ct-teclas pulso-cc-teclas">
      <span>
        <kbd>
          <ArrowUp size={11} aria-hidden="true" />
          <span className="pulso-sr-only">Flecha arriba</span>
        </kbd>
        <kbd>
          <ArrowDown size={11} aria-hidden="true" />
          <span className="pulso-sr-only">Flecha abajo</span>
        </kbd>
        Mover
      </span>
      <span>
        <kbd>Mayús</kbd>
        Tramo
      </span>
      <span>
        <kbd>1</kbd>
        <kbd>2</kbd>
        Asignar el código
      </span>
      {permiteVarios ? (
        <span>
          <kbd>Mayús</kbd>
          <kbd>1</kbd>
          Sumar otro
        </span>
      ) : null}
      <span>
        <kbd>Enter</kbd>
        Elegir código
      </span>
      <span>
        <kbd>Supr</kbd>
        Quitar
      </span>
      <span>
        <kbd>{nombreDeAtajo("Z")}</kbd>
        Deshacer asignación
      </span>
    </p>
  );
}
