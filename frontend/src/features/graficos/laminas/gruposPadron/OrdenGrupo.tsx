// X5: el lugar de un grupo incluido en la lámina («1», «2»…) con Subir y Bajar. Con dos grupos el orden decide la
// diferencia (el primero menos el segundo), así que va a la vista y se cambia aquí, con efecto inmediato. Alt+Flecha
// arriba/abajo hace lo mismo desde cualquier control de la fila (GruposPadron). En el borde, el botón queda
// `aria-disabled` y no `disabled`: el foco no se pierde al llegar arriba con el teclado.

import { ArrowDown, ArrowUp } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";

type Props = {
  etiqueta: string;
  posicion: number;
  total: number;
  onMover: (delta: -1 | 1) => void;
};

export function OrdenGrupo({ etiqueta, posicion, total, onMover }: Props) {
  const arriba = posicion <= 1;
  const abajo = posicion >= total;
  return (
    <span className="pulso-f6-grupos-orden">
      <span className="pulso-f6-grupos-posicion" aria-label={`Lugar ${posicion} de ${total} en la lámina`} title="Lugar en la lámina">
        {posicion}
      </span>
      {total > 1 && (
        <>
          <PulsoButton variant="icon" tone="quiet" size="sm" className="pulso-f6-grupos-mover" aria-label={`Subir ${etiqueta}`}
            aria-keyshortcuts="Alt+ArrowUp" aria-disabled={arriba} onClick={() => { if (!arriba) onMover(-1); }}>
            <ArrowUp aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="quiet" size="sm" className="pulso-f6-grupos-mover" aria-label={`Bajar ${etiqueta}`}
            aria-keyshortcuts="Alt+ArrowDown" aria-disabled={abajo} onClick={() => { if (!abajo) onMover(1); }}>
            <ArrowDown aria-hidden="true" />
          </PulsoButton>
        </>
      )}
    </span>
  );
}
