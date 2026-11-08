// Ranura con un tipo de gráfico retirado (ADR 0137, fase 1). Ocupa el lugar de la tarjeta de datos: el plan conserva el
// tipo y sus args, pero no se editan; la ranura dice qué tipo era, qué lo reemplaza y, si el reemplazo es un tipo del
// registro, lo cambia con un clic. «Cambiar» de la cabecera sigue abriendo el selector de tipo. Cambiar descarta los
// args viejos. El número del ADR va sólo en el detalle del «?». Superficie intrínseca (C1); su vacío no existe: siempre
// trae el nombre del tipo (C3).

import { Archive } from "../../../../vendor/lucide-react";
import type { GraficadorRetirado } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { AyudaGlobo } from "../AyudaGlobo";
import { detalleRetiro, textoReemplazo } from "../../retirados";
import "./ranuraRetirada.css";

type Props = {
  id: string;
  ficha: GraficadorRetirado;
  /** El tipo por el que se cambia con un clic, o null si el reemplazo no es un tipo del registro. */
  reemplazo: { graficador: string; nombre: string } | null;
  onCambiarPor: (graficador: string) => void;
};

export function RanuraRetirada({ id, ficha, reemplazo, onCambiarPor }: Props) {
  const texto = textoReemplazo(ficha);
  return (
    <div className="pulso-f6-tarjeta is-ruta pulso-f6-ranura-retirada" role="note" aria-labelledby={`${id}-titulo`}
      data-qa="ranura-retirada" data-qa-geometry-group="graficos/f6-ranura-retirada" data-qa-geometry-contract="intrinsic">
      <Archive size={16} className="pulso-f6-tarjeta-icono" aria-hidden="true" />
      <div>
        {/* El «?» va fuera del título: su detalle (el único lugar con el ADR) no entra al nombre de la nota. */}
        <strong id={`${id}-titulo`}>Tipo de gráfico retirado</strong>
        {"\u00a0"}<AyudaGlobo id={`${id}-detalle`} rotulo="Tipo de gráfico retirado" detalle={detalleRetiro(ficha)} />
        <p>&quot;{ficha.titulo_humano}&quot; ya no se ofrece; en el informe esta ranura sale en blanco.</p>
        {texto && <p>{texto}</p>}
        {reemplazo && (
          <div className="pulso-f6-ranura-retirada-acciones">
            <PulsoButton variant="secondary" size="sm" onClick={() => onCambiarPor(reemplazo.graficador)}>
              Cambiar por {reemplazo.nombre}
            </PulsoButton>
          </div>
        )}
      </div>
    </div>
  );
}
