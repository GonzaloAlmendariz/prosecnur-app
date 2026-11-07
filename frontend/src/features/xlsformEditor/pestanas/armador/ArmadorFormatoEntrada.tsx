import { useId, useState } from "react";
import { Wand2 } from "../../../../vendor/lucide-react";
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
  const tituloId = useId();
  const cuerpo = cuerpoDeConstraint(constraint);
  const leido = cuerpo !== null ? bloquesDesdePatron(cuerpo) : null;
  const lectura = leido ? lecturaDe(leido.bloques) : null;

  return (
    // Tarjeta sin triángulo (E20): el armador es grande, así que se abre con un botón con verbo, no queda abierto.
    <section className="xfa-bloque" data-testid="armador-formato" aria-labelledby={tituloId}>
      <header className="xfa-bloque__cabeza">
        <span className="xfa-bloque__icono" aria-hidden="true"><Wand2 /></span>
        <div className="xfa-bloque__titulos">
          <h4 id={tituloId} className="xfa-bloque__titulo">Formato</h4>
          <p className="xfa-bloque__sub">{lectura ? textoDePiezas(lectura) : "Sin formato."}</p>
        </div>
        <button type="button" className="xfa-bloque__accion" aria-expanded={abierto} aria-controls={panelId} onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar" : lectura ? "Cambiar formato" : "Armar formato"}
        </button>
      </header>
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
    </section>
  );
}
