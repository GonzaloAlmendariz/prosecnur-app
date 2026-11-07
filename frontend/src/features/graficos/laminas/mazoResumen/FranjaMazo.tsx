// La franja del mazo «Resumen ejecutivo» (maqueta graficos-sintesis, Mazo): los públicos que entran (cambian las
// propuestas) y su orden (el de las filas del panorama y la cobertura), el indicador que suman los puntos y la referencia
// del panorama y de la escala bajo la referencia.

import { useId } from "react";
import type { ArgMetadata } from "../../../../api/graficos";
import { ChevronLeft, ChevronRight } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { AyudaGlobo } from "../AyudaGlobo";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { NumeroAcotado } from "../NumeroAcotado";
import { publicoEnFrase, type IndicadorMazo } from "./modeloMazo";

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
  onMoverPublico: (base: string, d: -1 | 1) => void;
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
          <AyudaGlobo rotulo="Públicos" detalle="Los que entran y su orden: el de las filas del panorama y de la cobertura." />
        </legend>
        <ol className="pulso-f6-mazo-publicos">
          {bases.map((b, i) => {
            const nombre = nombrePublico(publicoEnFrase(b));
            return (
              <li key={b} className="pulso-f6-mazo-publico">
                <PulsoSwitch size="sm" label={nombre} checked={publicos.includes(b)}
                  disabled={publicos.length === 1 && publicos.includes(b)} onCheckedChange={() => onPublico(b)} />
                {bases.length > 1 && (
                  <span className="pulso-f6-mazo-publico-orden">
                    <PulsoButton variant="icon" size="sm" aria-label={`Mover ${nombre} antes`} disabled={i === 0}
                      onClick={() => onMoverPublico(b, -1)}>
                      <ChevronLeft size={13} aria-hidden="true" />
                    </PulsoButton>
                    <PulsoButton variant="icon" size="sm" aria-label={`Mover ${nombre} después`} disabled={i === bases.length - 1}
                      onClick={() => onMoverPublico(b, 1)}>
                      <ChevronRight size={13} aria-hidden="true" />
                    </PulsoButton>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
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
