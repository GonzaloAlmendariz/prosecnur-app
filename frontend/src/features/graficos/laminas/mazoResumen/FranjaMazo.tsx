// La franja del mazo «Resumen ejecutivo» (maqueta graficos-sintesis, Mazo): los públicos que entran (cambian las
// propuestas) y su orden, arrastrando sus chips (el de las filas del panorama y la cobertura), el indicador que suman
// los puntos y la referencia del panorama y de la escala bajo la referencia.

import { useId } from "react";
import type { ArgMetadata } from "../../../../api/graficos";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { AyudaGlobo } from "../AyudaGlobo";
import { NumeroAcotado } from "../NumeroAcotado";
import { ChipsPublicos } from "./ChipsPublicos";
import type { IndicadorMazo } from "./modeloMazo";

const ARG_REFERENCIA: ArgMetadata = {
  name: "referencia", label: "Referencia (%)", tipo_input: "number", grupo: "valores", min: 0, max: 100, step: 5,
};

type Props = {
  bases: readonly string[];
  publicos: readonly string[];
  indicadores: readonly IndicadorMazo[];
  indicador: IndicadorMazo | null;
  referencia: number;
  onPublico: (base: string) => void;
  onMoverPublico: (desde: string, hasta: string) => void;
  onIndicador: (id: string) => void;
  onReferencia: (n: number) => void;
};

export function FranjaMazo({ bases, publicos, indicadores, indicador, referencia, onPublico, onMoverPublico, onIndicador, onReferencia }: Props) {
  const id = useId();
  return (
    <div className="pulso-f6-mazo-franja" data-qa-geometry-group="graficos/f6-mazo-franja" data-qa-geometry-contract="intrinsic">
      <fieldset className="pulso-f6-mazo-campo is-publicos" data-qa-geometry-member>
        <legend className="pulso-f6-mazo-rotulo">
          Públicos
          <AyudaGlobo rotulo="Públicos" detalle="Los que entran y su orden, arrastrando cada uno por su asa: el de las filas del panorama y de la cobertura." />
        </legend>
        <ChipsPublicos bases={bases} publicos={publicos} onPublico={onPublico} onMoverPublico={onMoverPublico} />
      </fieldset>
      <div className="pulso-f6-mazo-campo" data-qa-geometry-member>
        <span className="pulso-f6-mazo-rotulo" id={`${id}-indicador`}>
          Indicador
          <AyudaGlobo rotulo="Indicador" detalle="Las respuestas que suman el porcentaje de cada pregunta, según la escala más repetida del estudio. Se cambia después en Datos de cada lámina." />
        </span>
        {indicadores.length > 0 && indicador ? (
          <PulsoSelect size="sm" value={indicador.id} onValueChange={onIndicador} describedBy={`${id}-indicador`}
            ariaLabel="Indicador" className="pulso-f6-mazo-indicador"
            options={indicadores.map((i) => ({ value: i.id, label: i.rotulo, textValue: i.rotulo }))} />
        ) : (
          <span className="pulso-f6-mazo-sin-dato">Sin escala común: se elige en cada lámina</span>
        )}
      </div>
      <div className="pulso-f6-mazo-campo is-referencia" data-qa-geometry-member>
        <label className="pulso-f6-mazo-rotulo" htmlFor={`${id}-referencia`}>
          Referencia (%)
          <AyudaGlobo rotulo="Referencia" detalle="La línea del panorama y el umbral de la escala bajo la referencia." />
        </label>
        <NumeroAcotado id={`${id}-referencia`} rotulo="Referencia (%)" arg={ARG_REFERENCIA} valor={referencia} placeholder=""
          onCambio={(v) => { if (v !== null) onReferencia(v); }} />
      </div>
    </div>
  );
}
