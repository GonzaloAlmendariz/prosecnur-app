// La franja del mazo plegada en pantallas bajas (menos de 700 px de alto, o el preset de layout «short»): en una línea,
// los públicos que entran, el indicador y la referencia, y «Ajustar» para desplegar la franja completa. En pantallas
// altas la línea no se muestra y la franja va siempre abierta: el pliegue lo decide el CSS, no un medidor.

import { useId } from "react";
import { ChevronDown } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { FranjaMazo } from "./FranjaMazo";
import { publicoEnFrase, type IndicadorMazo } from "./modeloMazo";

type Props = Parameters<typeof FranjaMazo>[0] & {
  abierta: boolean;
  onAlternar: () => void;
};

export function ResumenFranja({ abierta, onAlternar, ...franja }: Props) {
  const id = useId();
  const indicador: IndicadorMazo | null = franja.indicador;
  return (
    <div className={`pulso-f6-mazo-plegable${abierta ? " is-abierta" : ""}`}>
      <div className="pulso-f6-mazo-resumen">
        <ul className="pulso-f6-mazo-resumen-publicos" aria-label="Públicos que entran">
          {franja.publicos.map((b) => <li key={b} className="pulso-f6-mazo-resumen-chip">{nombrePublico(publicoEnFrase(b))}</li>)}
        </ul>
        <span className="pulso-f6-mazo-resumen-dato">{indicador ? indicador.etiqueta : "Sin indicador común"}</span>
        <span className="pulso-f6-mazo-resumen-dato">Referencia {formatoConteo(franja.referencia)}%</span>
        <PulsoButton variant="ghost" size="sm" className="pulso-f6-mazo-resumen-ajustar" onClick={onAlternar}
          aria-expanded={abierta} aria-controls={`${id}-franja`}>
          {abierta ? "Plegar" : "Ajustar"}
          <ChevronDown size={13} aria-hidden="true" />
        </PulsoButton>
      </div>
      <div id={`${id}-franja`} className="pulso-f6-mazo-plegable-franja">
        <FranjaMazo {...franja} />
      </div>
    </div>
  );
}
