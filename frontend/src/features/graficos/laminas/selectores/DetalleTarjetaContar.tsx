// Detalle de una tarjeta de «¿Qué quieres contar?» (ADR 0135; maqueta graficos-sintesis, Main): la miniatura del gráfico,
// el nombre, su clase, qué responde, qué pide y el botón. Sin título sugerido (lo escribe siempre el analista) ni
// párrafos explicativos. Si la tarjeta reemplaza el gráfico de la lámina, lo dice antes y pide confirmarlo.

import { useId } from "react";
import { Check } from "../../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { AvisoCambio } from "./AvisoCambio";
import type { CambioTipoLamina } from "./cambioTipoLamina";
import { etiquetaBotonTarjeta } from "./detalleLamina";
import { ROTULO_CLASE, type TarjetaContar } from "./intencionesContar";
import type { ModoSelectorLamina } from "./selectoresStore";

type Props = {
  tarjeta: TarjetaContar;
  modo: ModoSelectorLamina;
  actual: boolean;
  cambio: CambioTipoLamina | null;
  confirmando: boolean;
  nombreGrafico: (g: GraficadorRef) => string;
  nombreSlot: (slot: string) => string;
  nombreCampo: (clave: string) => string;
  onAplicar: () => void;
  onVolver: () => void;
};

export function DetalleTarjetaContar({
  tarjeta, modo, actual, cambio, confirmando, nombreGrafico, nombreSlot, nombreCampo, onAplicar, onVolver,
}: Props) {
  const idAviso = useId();
  const sobrantes = cambio && !actual ? cambio.sobrantes : [];
  const textos = cambio && !actual ? cambio.textosSobrantes : [];
  const hayPerdida = sobrantes.length > 0 || textos.length > 0;
  const boton = etiquetaBotonTarjeta({ modo, actual, sobrantes: sobrantes.length, confirmando });
  return (
    <div className="pulso-f6-detalle" data-tarjeta-contar={tarjeta.clave}>
      <div className="pulso-f6-detalle-lienzo is-grafico">
        <GlifoGrafico tipo={tarjeta.grafico.graficador} titulo={`Esquema de “${tarjeta.nombre}”`} />
      </div>
      <div className="pulso-f6-detalle-texto">
        <h3>{tarjeta.nombre}</h3>
        <span className="pulso-f6-detalle-clase" data-clase-tarjeta={tarjeta.clase}>{ROTULO_CLASE[tarjeta.clase]}</span>
        <p>{tarjeta.uso}.</p>
      </div>
      <dl className="pulso-f6-ficha">
        <dt>Qué pide</dt>
        <dd>{tarjeta.pide}</dd>
      </dl>
      <div className="pulso-f6-selector-pie">
        <AvisoCambio id={idAviso} sobrantes={sobrantes} textos={textos} confirmando={confirmando}
          nombreGrafico={nombreGrafico} nombreSlot={nombreSlot} nombreCampo={nombreCampo} />
        <div className="pulso-f6-selector-acciones">
          {confirmando && <PulsoButton variant="secondary" onClick={onVolver}>Elegir otra</PulsoButton>}
          <PulsoButton
            variant="primary"
            className="pulso-f6-selector-aplicar"
            disabled={boton.deshabilitado}
            aria-describedby={hayPerdida ? idAviso : undefined}
            onClick={onAplicar}
          >
            {boton.deshabilitado && <Check size={14} aria-hidden="true" />}
            {boton.texto}
          </PulsoButton>
        </div>
      </div>
    </div>
  );
}
