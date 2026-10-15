// Barra de la Vista general (F6.3): la cobertura del informe a la vista (cuántas láminas, cuántas con gráfico, cuántas
// incompletas, cuántos capítulos) y las acciones sobre la selección (inventario A0 C31): mover a un capítulo, duplicar y
// eliminar con confirmación. En el grupo de cobertura va también el interruptor de «Otros» (`InterruptorOtros`, contrato
// A5 2b). El marco no cambia con la selección (C2): sin láminas elegidas, la barra explica cómo
// elegir y las acciones quedan deshabilitadas en su sitio.

import { useState } from "react";
import { Copy, ListTree, Trash2, X } from "../../../vendor/lucide-react";
import { InterruptorOtros } from "./InterruptorOtros";
import { ResumenInforme } from "./ResumenInforme";
import type { FiltroInforme } from "./estadoTarjetas";
import type { CoberturaInforme, FilaVistaGeneral } from "./modeloVistaGeneral";

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = esMac ? "⌘" : "Ctrl+";

type Props = {
  cobertura: CoberturaInforme;
  conteos: Record<FiltroInforme, number>;
  filtro: FiltroInforme;
  onFiltro: (f: FiltroInforme) => void;
  filas: readonly FilaVistaGeneral[];
  seleccionadas: number;
  /** Destinos válidos para la selección (con un separador elegido, sólo otros capítulos: viaja el capítulo entero). */
  destinosHabilitados: ReadonlySet<string>;
  onMoverA: (filaId: string) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onVaciar: () => void;
};

export function BarraVistaGeneral({ cobertura, conteos, filtro, onFiltro, filas, seleccionadas, destinosHabilitados, onMoverA, onDuplicar, onEliminar, onVaciar }: Props) {
  const [destino, setDestino] = useState("");
  const habilitadas = filas.filter((f) => destinosHabilitados.has(f.id));
  const destinoValido = habilitadas.some((f) => f.id === destino) ? destino : habilitadas[0]?.id ?? "";
  const sinSeleccion = seleccionadas === 0;
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
      <div className="pulso-f6-vg-acciones" role="toolbar" aria-label="Acciones sobre las láminas elegidas">
        <span className="pulso-f6-vg-seleccion" aria-live="off">
          {sinSeleccion ? "Clic para elegir · Mayús o Ctrl/⌘ para varias" : `${seleccionadas} ${seleccionadas === 1 ? "elegida" : "elegidas"}`}
        </span>
        <label className="pulso-f6-vg-mover">
          <span className="pulso-sr-only">Capítulo de destino</span>
          <select value={destinoValido} onChange={(e) => setDestino(e.target.value)} disabled={sinSeleccion || !habilitadas.length}>
            {filas.map((f) => <option key={f.id} value={f.id} disabled={!destinosHabilitados.has(f.id)}>{f.rotulo}</option>)}
          </select>
        </label>
        <button type="button" className="pulso-f6-boton" disabled={sinSeleccion || !destinoValido} onClick={() => onMoverA(destinoValido)}>
          <ListTree size={14} aria-hidden="true" />
          Mover al capítulo
        </button>
        <button type="button" className="pulso-f6-icono-boton" disabled={sinSeleccion} onClick={onDuplicar}
          aria-label="Duplicar las elegidas" title={`Duplicar las elegidas (${MOD}D)`}>
          <Copy size={15} aria-hidden="true" />
        </button>
        <button type="button" className="pulso-f6-icono-boton is-peligro" disabled={sinSeleccion} onClick={onEliminar}
          aria-label="Eliminar las elegidas" title="Eliminar las elegidas (Supr)">
          <Trash2 size={15} aria-hidden="true" />
        </button>
        <button type="button" className="pulso-f6-icono-boton" disabled={sinSeleccion} onClick={onVaciar}
          aria-label="Quitar la selección" title="Quitar la selección (Escape)">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
