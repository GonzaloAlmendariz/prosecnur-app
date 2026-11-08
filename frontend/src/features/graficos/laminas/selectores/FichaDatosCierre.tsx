// Ficha «Datos» de una tarjeta sin gráfico de partida (S8): el cierre con hallazgos no lee preguntas del estudio sino
// cifras de otras láminas de resumen del informe. Dos filas fijas: «Usa» (lo que la tarjeta declara) y «Tu informe»
// (cuántas láminas de resumen tiene o, en una línea, que no tiene ninguna). Como la ficha de un gráfico, no bloquea.

import { useId } from "react";
import { CircleAlert } from "../../../../vendor/lucide-react";
import { Panel } from "../../../../components/Panel";
import { informeParaCierre } from "./fichaDatos";
import "./fichaDatos.css";

type Props = {
  usa: string;
  /** Láminas de resumen del informe (laminasDeResumen). */
  laminasResumen: number;
  /** Sufijo del grupo C1 cuando hay dos fichas en pantalla (la vista Comparar). */
  grupo?: string;
};

export function FichaDatosCierre({ usa, laminasResumen, grupo }: Props) {
  const id = useId();
  const informe = informeParaCierre(laminasResumen);
  return (
    <Panel variant="subtle" className="pulso-f6-datos" aria-labelledby={`${id}-titulo`} data-ficha-datos="">
      <h4 id={`${id}-titulo`} className="pulso-f6-datos-titulo">Datos</h4>
      <dl
        className="pulso-f6-datos-filas"
        data-qa-geometry-group={`graficos/f6-ficha-datos${grupo ? `-${grupo}` : ""}`}
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-f6-datos-fila" data-fila-datos="usa" data-qa-geometry-member>
          <dt>Usa</dt>
          <dd><p className="pulso-f6-datos-resumen">{usa}</p></dd>
        </div>
        <div className="pulso-f6-datos-fila" data-fila-datos="informe" data-qa-geometry-member>
          <dt>Tu informe</dt>
          <dd>
            {informe.resumen && <p className="pulso-f6-datos-resumen">{informe.resumen}</p>}
            {informe.falta && (
              <p className="pulso-f6-datos-falta" data-falta="">
                <CircleAlert size={13} aria-hidden="true" />
                {informe.falta}
              </p>
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
