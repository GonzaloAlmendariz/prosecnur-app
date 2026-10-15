// Barra del Informe (F6.3; I3 e I7 del rediseño): el título, el resumen clicable por estado, los capítulos y el
// interruptor de «Otros» (`InterruptorOtros`, contrato A5 2b). Las acciones sobre la selección (inventario A0 C31) viven en
// la barra flotante `BarraSeleccion`; aquí, sin láminas elegidas, sólo se explica cómo elegir.

import { InterruptorOtros } from "./InterruptorOtros";
import { ResumenInforme } from "./ResumenInforme";
import type { FiltroInforme } from "./estadoTarjetas";
import type { CoberturaInforme } from "./modeloVistaGeneral";
import type { TamanoTarjeta } from "./vistaGeneralStore";

const TAMANOS: readonly { clave: TamanoTarjeta; rotulo: string }[] = [
  { clave: "grande", rotulo: "Grande" },
  { clave: "medio", rotulo: "Medio" },
  { clave: "chico", rotulo: "Chico" },
];


type Props = {
  cobertura: CoberturaInforme;
  conteos: Record<FiltroInforme, number>;
  filtro: FiltroInforme;
  onFiltro: (f: FiltroInforme) => void;
  seleccionadas: number;
  tamano: TamanoTarjeta;
  onTamano: (t: TamanoTarjeta) => void;
  modo: "maquetas" | "word";
  onModo: (m: "maquetas" | "word") => void;
  /** I11: en la vista Word, cuántas páginas y gráficos lleva el documento. */
  paginasWord: { paginas: number; graficos: number };
};

export function BarraVistaGeneral({ cobertura, conteos, filtro, onFiltro, seleccionadas, tamano, onTamano, modo, onModo, paginasWord }: Props) {
  const word = modo === "word";
  return (
    <header className="pulso-f6-vg-barra">
      <div className="pulso-f6-vg-cobertura" aria-label="Cobertura del informe"
        data-qa-geometry-group="graficos/f6-vg-cobertura" data-qa-geometry-contract="intrinsic">
        <h2 className="pulso-f6-vg-titulo-vista">Informe</h2>
        {/* I11: maquetas de lámina o de página del Word (D2: el Word real, sólo en la pestaña Word). */}
        <div className="pulso-f6-vg-tamano" role="radiogroup" aria-label="Cómo ver el informe">
          {(["maquetas", "word"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m}
              className={`pulso-f6-vg-tamano-op${modo === m ? " is-activo" : ""}`} onClick={() => onModo(m)}>
              {m === "maquetas" ? "Maquetas" : "Word"}
            </button>
          ))}
        </div>
        {/* I3: el resumen clicable reemplaza los conteos de láminas, con gráfico e incompletas. */}
        {word
          ? <span className="pulso-f6-vg-dato">≈ <strong>{paginasWord.paginas}</strong> páginas · <strong>{paginasWord.graficos}</strong> gráficos</span>
          : <ResumenInforme conteos={conteos} filtro={filtro} onFiltro={onFiltro} />}
        <span className="pulso-f6-vg-dato" data-qa-geometry-member><strong>{cobertura.capitulos}</strong> {cobertura.capitulos === 1 ? "capítulo" : "capítulos"}</span>
        <InterruptorOtros />
      </div>
      <span className="pulso-f6-col-sp" />
      {/* I7: las acciones sobre la selección viven en la barra flotante (BarraSeleccion); aquí sólo cómo elegir. */}
      {seleccionadas === 0 && !word && <span className="pulso-f6-vg-seleccion">Clic para elegir · Mayús o Ctrl/⌘ para varias</span>}
      {/* I10: el tamaño de las tarjetas; la maqueta escala sola (cqw) y las filas de un capítulo se llenan solas. */}
      {!word && <div className="pulso-f6-vg-tamano" role="radiogroup" aria-label="Tamaño de las tarjetas">
        {TAMANOS.map(({ clave, rotulo }) => (
          <button key={clave} type="button" role="radio" aria-checked={tamano === clave}
            className={`pulso-f6-vg-tamano-op${tamano === clave ? " is-activo" : ""}`} onClick={() => onTamano(clave)}>
            {rotulo}
          </button>
        ))}
      </div>}
    </header>
  );
}
