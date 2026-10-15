// Barra del Informe (F6.3; I3 e I7 del rediseño): el título, el resumen clicable por estado, los capítulos y el
// interruptor de «Otros» (`InterruptorOtros`, contrato A5 2b). Las acciones sobre la selección (inventario A0 C31) viven en
// la barra flotante `BarraSeleccion`; aquí, sin láminas elegidas, sólo se explica cómo elegir.

import { InterruptorOtros } from "./InterruptorOtros";
import { ResumenInforme } from "./ResumenInforme";
import type { FiltroInforme } from "./estadoTarjetas";
import type { CoberturaInforme } from "./modeloVistaGeneral";


type Props = {
  cobertura: CoberturaInforme;
  conteos: Record<FiltroInforme, number>;
  filtro: FiltroInforme;
  onFiltro: (f: FiltroInforme) => void;
  seleccionadas: number;
};

export function BarraVistaGeneral({ cobertura, conteos, filtro, onFiltro, seleccionadas }: Props) {
  return (
    <header className="pulso-f6-vg-barra">
      <div className="pulso-f6-vg-cobertura" aria-label="Cobertura del informe"
        data-qa-geometry-group="graficos/f6-vg-cobertura" data-qa-geometry-contract="intrinsic">
        <h2 className="pulso-f6-vg-titulo-vista">Informe</h2>
        {/* I3: el resumen clicable reemplaza los conteos de láminas, con gráfico e incompletas. */}
        <ResumenInforme conteos={conteos} filtro={filtro} onFiltro={onFiltro} />
        <span className="pulso-f6-vg-dato" data-qa-geometry-member><strong>{cobertura.capitulos}</strong> {cobertura.capitulos === 1 ? "capítulo" : "capítulos"}</span>
        <InterruptorOtros />
      </div>
      <span className="pulso-f6-col-sp" />
      {/* I7: las acciones sobre la selección viven en la barra flotante (BarraSeleccion); aquí sólo cómo elegir. */}
      {seleccionadas === 0 && <span className="pulso-f6-vg-seleccion">Clic para elegir · Mayús o Ctrl/⌘ para varias</span>}
    </header>
  );
}
