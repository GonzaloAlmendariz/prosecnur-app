/**
 * La caja "Resultado" del panel de regla (prototipo `pp-rg-prod` y
 * `pp-rg-trat`): qué produce la regla (inconsistencia o caso a revisar), el
 * tratamiento previsto y su alcance. La clase es `ClasificacionHallazgo`; el
 * tratamiento era `TreatmentPlanner` del asistente.
 *
 * "Detalle" no está en el prototipo: es el texto que el asistente pedía junto
 * al nombre y que se muestra con los casos marcados. Se conserva aquí para no
 * perderlo (estado no dibujado; plan de fidelidad, sección 0.4).
 */
import { Panel } from "../../../../components/Panel";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import ClasificacionHallazgo from "../../components/ClasificacionHallazgo";
import type { ReglaTreatmentScope } from "../../types";
import { accionEfectiva, type AccionDeBorrador, type Borrador } from "../borradorDeRegla";
import { ROTULO_DE_TRATAMIENTO, treatmentActionsForTipo } from "../modeloRegla";
import { Segmentado } from "./Segmentado";

const ALCANCES: ReadonlyArray<{ valor: ReglaTreatmentScope; rotulo: string }> = [
  { valor: "all", rotulo: "Todos" },
  { valor: "selected", rotulo: "Selección" },
  { valor: "single", rotulo: "Uno por uno" },
];

export function Resultado({ borrador: b, despachar }: { borrador: Borrador; despachar: (a: AccionDeBorrador) => void }) {
  const acciones = b.tipo ? treatmentActionsForTipo(b.tipo) : [];
  return (
    <Panel noPadding className="pulso-regla-caja pulso-regla-resultado" aria-label="Resultado" title="Resultado">
      <div className="pulso-regla-produce">
        <ClasificacionHallazgo value={b.hallazgoKind} onChange={(valor) => despachar({ tipo: "clase", valor })} />
      </div>
      <div className="pulso-regla-tratamiento">
        <span className="pulso-regla-rotulo" id="pulso-regla-tratamiento-rotulo">
          Tratamiento previsto
        </span>
        <PulsoSelect
          value={accionEfectiva(b)}
          onValueChange={(valor) => {
            const accion = acciones.find((a) => a.value === valor);
            if (accion) despachar({ tipo: "accion", valor: accion.value });
          }}
          ariaLabel="Tratamiento previsto"
          options={acciones.map((a) => ({ value: a.value, label: ROTULO_DE_TRATAMIENTO[a.value] }))}
        />
        <Segmentado<ReglaTreatmentScope>
          etiqueta="Sobre qué casos se aplica"
          valor={b.recommendedScope}
          opciones={ALCANCES}
          onCambio={(valor) => despachar({ tipo: "alcance", valor })}
        />
      </div>
      <div className="pulso-regla-detalle">
        <label className="pulso-regla-rotulo" htmlFor="pulso-regla-detalle">
          Detalle
        </label>
        <PulsoInput
          id="pulso-regla-detalle"
          value={b.mensaje}
          onChange={(e) => despachar({ tipo: "mensaje", valor: e.target.value })}
          placeholder="Se muestra junto a los casos marcados"
        />
      </div>
    </Panel>
  );
}
