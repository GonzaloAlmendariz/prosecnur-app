import { useId, useState } from "react";
import { ChevronRight, Wand2 } from "../../../../vendor/lucide-react";
import { textoDePiezas } from "../../reglas/piezas";
import { ArmadorPatron } from "./ArmadorPatron";
import { bloquesDesdePatron, cuerpoDeConstraint, lecturaDe } from "./armadorModelo";

// Entrada «Formato» del editor de la regla en preguntas de texto: abre el armador debajo y, al aplicar, escribe
// regex(., '^…$') en la constraint. Si la regla actual es un patrón que el armador entiende, muestra su lectura.

type Props = {
  constraint: string;
  onAplicar: (constraint: string) => void;
};

export function ArmadorFormatoEntrada({ constraint, onAplicar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const cuerpo = cuerpoDeConstraint(constraint);
  const leido = cuerpo !== null ? bloquesDesdePatron(cuerpo) : null;
  const lectura = leido ? lecturaDe(leido.bloques) : null;

  return (
    <div className="xfa-entrada-caja" data-testid="armador-formato">
      <button type="button" className="xfa-entrada" aria-expanded={abierto} aria-controls={panelId} onClick={() => setAbierto((v) => !v)}>
        <Wand2 aria-hidden="true" />
        <span className="xfa-entrada__nombre">Formato</span>
        <span className="xfa-entrada__lectura">{lectura ? textoDePiezas(lectura) : ""}</span>
        <ChevronRight aria-hidden="true" style={{ transform: abierto ? "rotate(90deg)" : undefined }} />
      </button>
      {abierto && (
        <div id={panelId} className="xfa-entrada__panel">
          <ArmadorPatron
            constraint={constraint}
            onCancelar={() => setAbierto(false)}
            onAplicar={(c) => {
              onAplicar(c);
              setAbierto(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
