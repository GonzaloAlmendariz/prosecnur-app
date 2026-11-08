// Detalle de una tarjeta de «¿Qué quieres contar?» (ADR 0135; maqueta graficos-sintesis, Main): la lámina con los datos
// del estudio (o, mientras llega o si al estudio le falta algo, el glifo del gráfico),
// el nombre, su clase, qué responde, la ficha «Datos» (o qué pide, si la tarjeta no trae gráfico) y el botón. Sin
// título sugerido (lo escribe siempre el analista) ni párrafos explicativos. Si la tarjeta reemplaza el gráfico de la lámina, lo dice antes y pide confirmarlo.

import { useId, type ReactNode } from "react";
import { Check } from "../../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS } from "../../store";
import { AvisoCambio } from "./AvisoCambio";
import type { CambioTipoLamina } from "./cambioTipoLamina";
import { etiquetaBotonTarjeta } from "./detalleLamina";
import { atributosHueco, HuecoMiniatura } from "./HuecoMiniatura";
import { ROTULO_CLASE, type TarjetaContar } from "./intencionesContar";
import type { MiniaturaSelector } from "./modeloMiniaturasSelector";
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
  /** Ficha «Datos» (FichaDatosTarjeta): qué usa el gráfico y qué tiene el estudio. Sin ella, «Qué pide». */
  ficha?: ReactNode;
  /** La lámina con los datos del estudio (useMiniaturasSelector); sin ella, el glifo. */
  miniatura?: MiniaturaSelector;
  onAplicar: () => void;
  onVolver: () => void;
};

export function DetalleTarjetaContar({
  tarjeta, modo, actual, cambio, confirmando, nombreGrafico, nombreSlot, nombreCampo, ficha, miniatura, onAplicar, onVolver,
}: Props) {
  const idAviso = useId();
  const sobrantes = cambio && !actual ? cambio.sobrantes : [];
  const textos = cambio && !actual ? cambio.textosSobrantes : [];
  const hayPerdida = sobrantes.length > 0 || textos.length > 0;
  const boton = etiquetaBotonTarjeta({ modo, actual, sobrantes: sobrantes.length, confirmando });
  return (
    <div className="pulso-f6-detalle" data-tarjeta-contar={tarjeta.clave}>
      <div className="pulso-f6-detalle-lienzo is-grafico" data-hueco-miniatura="" {...atributosHueco(miniatura)}>
        <HuecoMiniatura miniatura={miniatura} nombre={tarjeta.nombre}>
          {tarjeta.grafico
            ? <GlifoGrafico tipo={tarjeta.grafico.graficador} titulo={`Esquema de “${tarjeta.nombre}”`} />
            : <ComposicionLamina tipo={tarjeta.tipo} slots={SLIDE_GRAF_SLOTS[tarjeta.tipo] ?? []} />}
        </HuecoMiniatura>
      </div>
      <div className="pulso-f6-detalle-texto">
        <h3>{tarjeta.nombre}</h3>
        <span className="pulso-f6-detalle-clase" data-clase-tarjeta={tarjeta.clase}>{ROTULO_CLASE[tarjeta.clase]}</span>
        <p>{tarjeta.uso}.</p>
      </div>
      {ficha ?? (
        <dl className="pulso-f6-ficha">
          <dt>Qué pide</dt>
          <dd>{tarjeta.pide}</dd>
        </dl>
      )}
      <div className="pulso-f6-selector-pie">
        <AvisoCambio id={idAviso} sobrantes={sobrantes} textos={textos} confirmando={confirmando}
          nombreGrafico={nombreGrafico} nombreSlot={nombreSlot} nombreCampo={nombreCampo} />
        <div className="pulso-f6-selector-acciones">
          {confirmando && <PulsoButton variant="secondary" size="lg" onClick={onVolver}>Elegir otra</PulsoButton>}
          <PulsoButton
            variant="primary"
            size="lg"
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
